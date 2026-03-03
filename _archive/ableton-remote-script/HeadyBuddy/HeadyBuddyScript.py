# © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
# HeadyBuddyScript — Main Control Surface for Ableton Live
#
# Architecture:
#   - TCP server on port 11411 (configurable) receives JSON commands from Buddy
#   - Translates JSON → LOM (Live Object Model) API calls
#   - Sends events back to Buddy when Ableton state changes (listeners)
#   - Non-blocking: uses Ableton's scheduler for I/O so we never freeze the UI

import json
import socket
import errno
import time
import traceback

try:
    from _Framework.ControlSurface import ControlSurface
except ImportError:
    # Fallback for testing outside Ableton
    class ControlSurface:
        def __init__(self, c_instance=None):
            self._c_instance = c_instance
        def log_message(self, msg): print(msg)
        def schedule_message(self, delay, callback): callback()
        def disconnect(self): pass
        def song(self):
            return None


# ═══════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════
HOST = "127.0.0.1"
PORT = 11411
POLL_INTERVAL_TICKS = 1  # Ableton scheduler ticks (~100ms)
BUFFER_SIZE = 65536
HEARTBEAT_INTERVAL = 5.0  # seconds


class HeadyBuddyScript(ControlSurface):
    """
    Ableton Live Control Surface that bridges Buddy's DAW MCP Bridge
    to Ableton's Live Object Model via a local TCP socket.
    """

    def __init__(self, c_instance):
        super(HeadyBuddyScript, self).__init__(c_instance)
        self._server_socket = None
        self._client_socket = None
        self._recv_buffer = ""
        self._connected = False
        self._last_heartbeat = 0
        self._command_handlers = {}
        self._listeners_installed = False
        self._last_tempo = None
        self._last_playing = None
        self._last_recording = None

        self._register_command_handlers()
        self._start_server()
        self._install_listeners()

        self.log_message("═══ HeadyBuddy Remote Script initialized ═══")
        self.log_message(f"    TCP Server on {HOST}:{PORT}")
        self.log_message("    Waiting for Buddy connection...")

    # ═══════════════════════════════════════════════════════════════
    # TCP Server — Non-blocking socket using Ableton's scheduler
    # ═══════════════════════════════════════════════════════════════

    def _start_server(self):
        """Start non-blocking TCP server."""
        try:
            self._server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self._server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self._server_socket.setblocking(False)
            self._server_socket.bind((HOST, PORT))
            self._server_socket.listen(1)
            self.log_message(f"[HeadyBuddy] TCP server listening on {HOST}:{PORT}")
        except Exception as e:
            self.log_message(f"[HeadyBuddy] Server start error: {e}")
            return

        # Schedule the poll loop via Ableton's scheduler (never blocks UI)
        self._schedule_poll()

    def _schedule_poll(self):
        """Schedule next poll cycle via Ableton's internal scheduler."""
        try:
            self.schedule_message(POLL_INTERVAL_TICKS, self._poll)
        except Exception:
            pass

    def _poll(self):
        """Non-blocking poll: accept connections, read data, process commands."""
        try:
            self._accept_connection()
            self._read_data()
            self._check_heartbeat()
        except Exception as e:
            self.log_message(f"[HeadyBuddy] Poll error: {e}")

        # Re-schedule
        self._schedule_poll()

    def _accept_connection(self):
        """Accept incoming connection from Buddy's DAW MCP Bridge."""
        if self._connected:
            return
        try:
            client, addr = self._server_socket.accept()
            client.setblocking(False)
            self._client_socket = client
            self._connected = True
            self._recv_buffer = ""
            self.log_message(f"[HeadyBuddy] ✅ Buddy connected from {addr}")
            # Send initial session state
            self._send_event("session.state_updated", self._get_full_session_state())
        except socket.error as e:
            if e.errno not in (errno.EAGAIN, errno.EWOULDBLOCK):
                self.log_message(f"[HeadyBuddy] Accept error: {e}")

    def _read_data(self):
        """Read newline-delimited JSON messages from Buddy."""
        if not self._connected or not self._client_socket:
            return

        try:
            data = self._client_socket.recv(BUFFER_SIZE)
            if not data:
                self._handle_disconnect()
                return
            self._recv_buffer += data.decode("utf-8")
        except socket.error as e:
            if e.errno not in (errno.EAGAIN, errno.EWOULDBLOCK):
                self._handle_disconnect()
            return

        # Parse newline-delimited JSON
        while "\n" in self._recv_buffer:
            line, self._recv_buffer = self._recv_buffer.split("\n", 1)
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
                self._handle_message(msg)
            except json.JSONDecodeError as e:
                self.log_message(f"[HeadyBuddy] JSON parse error: {e}")

    def _handle_disconnect(self):
        """Handle client disconnection."""
        self.log_message("[HeadyBuddy] Buddy disconnected.")
        self._connected = False
        if self._client_socket:
            try:
                self._client_socket.close()
            except Exception:
                pass
            self._client_socket = None

    def _send(self, data):
        """Send JSON message to Buddy."""
        if not self._connected or not self._client_socket:
            return False
        try:
            msg = json.dumps(data) + "\n"
            self._client_socket.sendall(msg.encode("utf-8"))
            return True
        except Exception as e:
            self.log_message(f"[HeadyBuddy] Send error: {e}")
            self._handle_disconnect()
            return False

    def _send_event(self, event_type, data):
        """Send an event notification to Buddy."""
        self._send({"event": event_type, "data": data, "ts": int(time.time() * 1000)})

    def _check_heartbeat(self):
        """Respond to heartbeat pings."""
        now = time.time()
        if now - self._last_heartbeat >= HEARTBEAT_INTERVAL and self._connected:
            self._last_heartbeat = now

    # ═══════════════════════════════════════════════════════════════
    # Message Router — dispatch incoming commands to handlers
    # ═══════════════════════════════════════════════════════════════

    def _handle_message(self, msg):
        """Route incoming messages to the appropriate handler."""
        msg_type = msg.get("type", "")
        msg_id = msg.get("id")

        # Heartbeat
        if msg_type == "heartbeat":
            self._send({"type": "heartbeat_ack", "ts": int(time.time() * 1000)})
            return

        # Command
        if msg_type == "command":
            command = msg.get("command", "")
            params = msg.get("params", {})
            try:
                result = self._execute_command(command, params)
                self._send({"id": msg_id, "result": result})
            except Exception as e:
                self.log_message(f"[HeadyBuddy] Command error ({command}): {e}")
                self._send({"id": msg_id, "error": str(e)})

    def _execute_command(self, command, params):
        """Execute a LOM command and return the result."""
        handler = self._command_handlers.get(command)
        if not handler:
            raise ValueError(f"Unknown command: {command}")
        return handler(params)

    # ═══════════════════════════════════════════════════════════════
    # Command Handlers — LOM API wrappers
    # ═══════════════════════════════════════════════════════════════

    def _register_command_handlers(self):
        """Register all LOM command handlers."""
        h = self._command_handlers

        # Transport
        h["transport.play"] = self._cmd_play
        h["transport.stop"] = self._cmd_stop
        h["transport.record"] = self._cmd_record
        h["transport.set_tempo"] = self._cmd_set_tempo
        h["transport.get_tempo"] = self._cmd_get_tempo

        # Tracks
        h["track.create_midi"] = self._cmd_create_midi_track
        h["track.create_audio"] = self._cmd_create_audio_track
        h["track.delete"] = self._cmd_delete_track
        h["track.set_volume"] = self._cmd_set_track_volume
        h["track.set_pan"] = self._cmd_set_track_pan
        h["track.set_mute"] = self._cmd_set_track_mute
        h["track.set_solo"] = self._cmd_set_track_solo
        h["track.set_arm"] = self._cmd_set_track_arm
        h["track.set_name"] = self._cmd_set_track_name
        h["track.get_state"] = self._cmd_get_track_state

        # Devices / Plugins
        h["device.add"] = self._cmd_add_device
        h["device.set_param"] = self._cmd_set_device_param
        h["device.get_params"] = self._cmd_get_device_params
        h["device.set_macro"] = self._cmd_set_macro

        # Clips
        h["clip.create"] = self._cmd_create_clip
        h["clip.delete"] = self._cmd_delete_clip
        h["clip.set_notes"] = self._cmd_set_clip_notes
        h["clip.fire"] = self._cmd_fire_clip
        h["clip.stop"] = self._cmd_stop_clip

        # Scene
        h["scene.fire"] = self._cmd_fire_scene

        # Session
        h["session.get_state"] = self._cmd_get_session_state
        h["session.get_tracks"] = self._cmd_get_tracks
        h["session.get_routing"] = self._cmd_get_routing

    # ─── Transport ────────────────────────────────────────────────

    def _cmd_play(self, params):
        song = self.song()
        song.start_playing()
        return {"playing": True}

    def _cmd_stop(self, params):
        song = self.song()
        song.stop_playing()
        return {"playing": False}

    def _cmd_record(self, params):
        song = self.song()
        song.record_mode = not song.record_mode
        return {"recording": song.record_mode}

    def _cmd_set_tempo(self, params):
        song = self.song()
        tempo = float(params.get("tempo", 120))
        tempo = max(20.0, min(999.0, tempo))
        song.tempo = tempo
        return {"tempo": song.tempo}

    def _cmd_get_tempo(self, params):
        return {"tempo": self.song().tempo}

    # ─── Tracks ───────────────────────────────────────────────────

    def _cmd_create_midi_track(self, params):
        song = self.song()
        index = params.get("index", -1)
        song.create_midi_track(index)
        track = song.tracks[-1] if index == -1 else song.tracks[index]
        name = params.get("name")
        if name:
            track.name = name
        return {"created": True, "index": len(song.tracks) - 1, "name": track.name}

    def _cmd_create_audio_track(self, params):
        song = self.song()
        index = params.get("index", -1)
        song.create_audio_track(index)
        track = song.tracks[-1] if index == -1 else song.tracks[index]
        name = params.get("name")
        if name:
            track.name = name
        return {"created": True, "index": len(song.tracks) - 1, "name": track.name}

    def _cmd_delete_track(self, params):
        song = self.song()
        index = int(params.get("trackIndex", 0))
        if 0 <= index < len(song.tracks):
            song.delete_track(index)
            return {"deleted": True, "index": index}
        return {"deleted": False, "error": "Invalid track index"}

    def _cmd_set_track_volume(self, params):
        track = self._get_track(params)
        value = float(params.get("value", 0.85))
        track.mixer_device.volume.value = max(0.0, min(1.0, value))
        return {"volume": track.mixer_device.volume.value}

    def _cmd_set_track_pan(self, params):
        track = self._get_track(params)
        value = float(params.get("value", 0.0))
        track.mixer_device.panning.value = max(-1.0, min(1.0, value))
        return {"pan": track.mixer_device.panning.value}

    def _cmd_set_track_mute(self, params):
        track = self._get_track(params)
        track.mute = bool(params.get("mute", not track.mute))
        return {"mute": track.mute}

    def _cmd_set_track_solo(self, params):
        track = self._get_track(params)
        track.solo = bool(params.get("solo", not track.solo))
        return {"solo": track.solo}

    def _cmd_set_track_arm(self, params):
        track = self._get_track(params)
        if track.can_be_armed:
            track.arm = bool(params.get("arm", not track.arm))
            return {"arm": track.arm}
        return {"arm": False, "error": "Track cannot be armed"}

    def _cmd_set_track_name(self, params):
        track = self._get_track(params)
        name = params.get("name", "Buddy Track")
        track.name = name
        return {"name": track.name}

    def _cmd_get_track_state(self, params):
        track = self._get_track(params)
        return self._serialize_track(track, int(params.get("trackIndex", 0)))

    # ─── Devices / Plugins ────────────────────────────────────────

    def _cmd_add_device(self, params):
        track = self._get_track(params)
        # Ableton doesn't have a direct "add device by name" API from Remote Script
        # This would need browser navigation — return the available devices instead
        device_count = len(track.devices)
        return {"trackDevices": device_count, "note": "Use Ableton browser to add devices"}

    def _cmd_set_device_param(self, params):
        track = self._get_track(params)
        device_index = int(params.get("deviceIndex", 0))
        param_name = params.get("paramName", "")
        value = float(params.get("value", 0.5))

        if 0 <= device_index < len(track.devices):
            device = track.devices[device_index]
            for param in device.parameters:
                if param.name.lower() == param_name.lower():
                    # Clamp to parameter range
                    clamped = max(param.min, min(param.max, value * (param.max - param.min) + param.min))
                    param.value = clamped
                    return {"param": param.name, "value": param.value, "normalized": value}
            return {"error": f"Parameter '{param_name}' not found"}
        return {"error": "Invalid device index"}

    def _cmd_get_device_params(self, params):
        track = self._get_track(params)
        result = []
        for di, device in enumerate(track.devices):
            dev_info = {
                "index": di,
                "name": device.name,
                "class_name": device.class_name,
                "params": {}
            }
            for param in device.parameters:
                if param.is_enabled:
                    range_size = param.max - param.min
                    normalized = (param.value - param.min) / range_size if range_size > 0 else 0
                    dev_info["params"][param.name] = round(normalized, 4)
            result.append(dev_info)
        return result

    def _cmd_set_macro(self, params):
        track = self._get_track(params)
        device_index = int(params.get("deviceIndex", 0))
        macro_index = int(params.get("macroIndex", 0))
        value = float(params.get("value", 0.5))

        if 0 <= device_index < len(track.devices):
            device = track.devices[device_index]
            if hasattr(device, "macros_mapped") and len(device.parameters) > macro_index + 1:
                param = device.parameters[macro_index + 1]  # +1 because param 0 is Device On/Off
                param.value = max(param.min, min(param.max, value * (param.max - param.min) + param.min))
                return {"macro": macro_index, "value": param.value}
        return {"error": "Invalid device or macro index"}

    # ─── Clips ────────────────────────────────────────────────────

    def _cmd_create_clip(self, params):
        track = self._get_track(params)
        slot_index = int(params.get("slotIndex", 0))
        length = float(params.get("length", 4.0))

        if slot_index < len(track.clip_slots):
            clip_slot = track.clip_slots[slot_index]
            if not clip_slot.has_clip:
                clip_slot.create_clip(length)
                return {"created": True, "slotIndex": slot_index, "length": length}
            return {"created": False, "error": "Slot already has a clip"}
        return {"created": False, "error": "Invalid slot index"}

    def _cmd_delete_clip(self, params):
        track = self._get_track(params)
        slot_index = int(params.get("slotIndex", 0))

        if slot_index < len(track.clip_slots):
            clip_slot = track.clip_slots[slot_index]
            if clip_slot.has_clip:
                clip_slot.delete_clip()
                return {"deleted": True}
        return {"deleted": False}

    def _cmd_set_clip_notes(self, params):
        """Set MIDI notes in a clip. Notes format: [{pitch, start, duration, velocity}]"""
        track = self._get_track(params)
        slot_index = int(params.get("slotIndex", 0))
        notes = params.get("notes", [])

        if slot_index < len(track.clip_slots):
            clip_slot = track.clip_slots[slot_index]
            if clip_slot.has_clip:
                clip = clip_slot.clip
                # Remove existing notes
                clip.remove_notes(0, 0, clip.length, 128)
                # Add new notes
                # Ableton API: set_notes expects tuple of tuples
                note_tuples = tuple(
                    (n.get("pitch", 60),
                     n.get("start", 0.0),
                     n.get("duration", 0.25),
                     n.get("velocity", 100),
                     False)  # muted
                    for n in notes
                )
                clip.set_notes(note_tuples)
                return {"set": len(notes), "clipLength": clip.length}
        return {"error": "No clip at specified slot"}

    def _cmd_fire_clip(self, params):
        track = self._get_track(params)
        slot_index = int(params.get("slotIndex", 0))

        if slot_index < len(track.clip_slots):
            track.clip_slots[slot_index].fire()
            return {"fired": True, "slotIndex": slot_index}
        return {"fired": False}

    def _cmd_stop_clip(self, params):
        track = self._get_track(params)
        slot_index = int(params.get("slotIndex", 0))

        if slot_index < len(track.clip_slots):
            track.clip_slots[slot_index].stop()
            return {"stopped": True}
        return {"stopped": False}

    # ─── Scene ────────────────────────────────────────────────────

    def _cmd_fire_scene(self, params):
        song = self.song()
        scene_index = int(params.get("sceneIndex", 0))
        if 0 <= scene_index < len(song.scenes):
            song.scenes[scene_index].fire()
            return {"fired": True, "sceneIndex": scene_index}
        return {"fired": False, "error": "Invalid scene index"}

    # ─── Session Queries ──────────────────────────────────────────

    def _cmd_get_session_state(self, params):
        return self._get_full_session_state()

    def _cmd_get_tracks(self, params):
        song = self.song()
        return [self._serialize_track(t, i) for i, t in enumerate(song.tracks)]

    def _cmd_get_routing(self, params):
        song = self.song()
        routing = []
        for i, track in enumerate(song.tracks):
            routing.append({
                "index": i,
                "name": track.name,
                "input_routing": str(track.input_routing_type.display_name) if hasattr(track, "input_routing_type") else "unknown",
                "output_routing": str(track.output_routing_type.display_name) if hasattr(track, "output_routing_type") else "unknown",
            })
        return routing

    # ═══════════════════════════════════════════════════════════════
    # LOM Listeners — Push state changes to Buddy in real-time
    # ═══════════════════════════════════════════════════════════════

    def _install_listeners(self):
        """Install LOM listeners for real-time state change notifications."""
        if self._listeners_installed:
            return
        try:
            song = self.song()
            if song is None:
                return

            song.add_tempo_listener(self._on_tempo_changed)
            song.add_is_playing_listener(self._on_playing_changed)
            song.add_record_mode_listener(self._on_record_changed)
            song.add_tracks_listener(self._on_tracks_changed)
            song.add_scenes_listener(self._on_scenes_changed)

            self._listeners_installed = True
            self.log_message("[HeadyBuddy] LOM listeners installed.")
        except Exception as e:
            self.log_message(f"[HeadyBuddy] Listener install error: {e}")

    def _on_tempo_changed(self):
        tempo = self.song().tempo
        if tempo != self._last_tempo:
            self._last_tempo = tempo
            self._send_event("tempo.changed", {"tempo": tempo})

    def _on_playing_changed(self):
        playing = self.song().is_playing
        if playing != self._last_playing:
            self._last_playing = playing
            self._send_event("transport.changed", {
                "playing": playing,
                "recording": self.song().record_mode
            })

    def _on_record_changed(self):
        recording = self.song().record_mode
        if recording != self._last_recording:
            self._last_recording = recording
            self._send_event("transport.changed", {
                "playing": self.song().is_playing,
                "recording": recording
            })

    def _on_tracks_changed(self):
        song = self.song()
        tracks = [self._serialize_track(t, i) for i, t in enumerate(song.tracks)]
        self._send_event("session.state_updated", {"tracks": tracks})

    def _on_scenes_changed(self):
        song = self.song()
        self._send_event("session.state_updated", {
            "scenes": [{"index": i, "name": s.name} for i, s in enumerate(song.scenes)]
        })

    # ═══════════════════════════════════════════════════════════════
    # Serialization Helpers
    # ═══════════════════════════════════════════════════════════════

    def _get_track(self, params):
        """Get a track by index from params."""
        song = self.song()
        index = int(params.get("trackIndex", 0))
        if 0 <= index < len(song.tracks):
            return song.tracks[index]
        raise ValueError(f"Track index {index} out of range (0-{len(song.tracks) - 1})")

    def _serialize_track(self, track, index):
        """Serialize a track to a JSON-safe dict."""
        devices = []
        for di, device in enumerate(track.devices):
            params = {}
            for param in device.parameters:
                if param.is_enabled:
                    range_size = param.max - param.min
                    normalized = (param.value - param.min) / range_size if range_size > 0 else 0
                    params[param.name] = round(normalized, 4)
            devices.append({
                "index": di,
                "name": device.name,
                "class_name": device.class_name,
                "params": params
            })

        clip_slots = []
        for si, slot in enumerate(track.clip_slots):
            cs = {"index": si, "hasClip": slot.has_clip}
            if slot.has_clip and slot.clip:
                cs["clipName"] = slot.clip.name
                cs["clipLength"] = slot.clip.length
                cs["isPlaying"] = slot.clip.is_playing
                cs["isTriggered"] = slot.clip.is_triggered
            clip_slots.append(cs)

        return {
            "index": index,
            "name": track.name,
            "volume": track.mixer_device.volume.value,
            "pan": track.mixer_device.panning.value,
            "mute": track.mute,
            "solo": track.solo,
            "arm": track.arm if track.can_be_armed else False,
            "canBeArmed": track.can_be_armed,
            "isMidi": track.has_midi_input,
            "isAudio": track.has_audio_input,
            "devices": devices,
            "clipSlots": clip_slots[:16],  # Limit to first 16 slots for perf
        }

    def _get_full_session_state(self):
        """Get the complete session state."""
        song = self.song()
        if song is None:
            return {"error": "No song loaded"}

        tracks = [self._serialize_track(t, i) for i, t in enumerate(song.tracks)]
        scenes = [{"index": i, "name": s.name} for i, s in enumerate(song.scenes)]

        return {
            "tempo": song.tempo,
            "playing": song.is_playing,
            "recording": song.record_mode,
            "timeSignature": [song.signature_numerator, song.signature_denominator],
            "tracks": tracks,
            "scenes": scenes,
            "selectedTrack": song.view.selected_track.name if song.view.selected_track else None,
            "masterVolume": song.master_track.mixer_device.volume.value,
            "playheadPosition": song.current_song_time,
        }

    # ═══════════════════════════════════════════════════════════════
    # Lifecycle
    # ═══════════════════════════════════════════════════════════════

    def disconnect(self):
        """Called by Ableton when the script is unloaded."""
        self.log_message("[HeadyBuddy] Disconnecting...")

        # Remove listeners
        try:
            song = self.song()
            if song:
                song.remove_tempo_listener(self._on_tempo_changed)
                song.remove_is_playing_listener(self._on_playing_changed)
                song.remove_record_mode_listener(self._on_record_changed)
                song.remove_tracks_listener(self._on_tracks_changed)
                song.remove_scenes_listener(self._on_scenes_changed)
        except Exception:
            pass

        # Close sockets
        if self._client_socket:
            try:
                self._client_socket.close()
            except Exception:
                pass
        if self._server_socket:
            try:
                self._server_socket.close()
            except Exception:
                pass

        self.log_message("[HeadyBuddy] Disconnected cleanly.")
        super(HeadyBuddyScript, self).disconnect()
