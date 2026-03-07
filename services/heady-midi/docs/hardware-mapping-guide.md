# Heady MIDI Hardware Mapping Guide

> **Version:** 2.0.0  
> **Author:** HeadySystems™  
> **Last Updated:** 2026-03-07  

---

## 1. Supported Controllers

HeadyMIDI works with any class-compliant MIDI controller. Tested and recommended:

| Controller             | Type        | Notes                                       |
|------------------------|-------------|---------------------------------------------|
| Generic MIDI CC        | Knobs/Faders| Any USB or DIN MIDI controller              |
| Ableton Push 2/3       | Grid + Knobs| Full integration via Remote Script           |
| Novation Launchpad     | Grid        | Clip triggering, scene launch                |
| Novation Launch Control| Knobs/Faders| 16 knobs + 8 faders — ideal for CC mapping  |
| Arturia BeatStep Pro   | Pads + Knobs| Drum pads for events, knobs for metrics     |
| AKAI APC40 / APC Mini  | Grid + Faders| Faders for volume/metrics, grid for clips   |
| Korg nanoKONTROL2      | Faders/Knobs| 8 faders + 8 knobs — compact control        |
| DJ controllers         | Mixed       | Jog wheels → latency, faders → volume       |
| iPad (via USB/BLE)     | Touch       | TouchOSC or Lemur sending MIDI              |

**Requirements:**
- USB MIDI or DIN MIDI (via interface)
- Bluetooth MIDI supported on macOS/iOS
- Controller must send standard CC or Note messages
- No special drivers needed — class-compliant USB

---

## 2. Quick Start

### Connect in 4 Steps

1. **Connect** your MIDI controller via USB (or enable Bluetooth MIDI).
2. **Open** the HeadyMIDI Dashboard at `http://localhost:8089`.
3. **Click** the "MIDI Learn" button next to any parameter.
4. **Move** a knob, fader, or press a button on your controller — done.

```
    ┌──────────────────────────────────┐
    │  HeadyMIDI Dashboard             │
    │                                  │
    │  CPU Load  [▓▓▓▓▓░░░░░] 52%     │
    │            [ MIDI Learn ]  ◀── Click this
    │                                  │
    │  Then move a knob on your        │
    │  controller...                   │
    │                                  │
    │  ✓ Mapped: CC 2 → CPU Load       │
    │    Curve: Logarithmic            │
    │    Dead Zone: 0-3                │
    └──────────────────────────────────┘
```

The mapping is saved automatically and persists across sessions.

**MIDI Learn timeout:** ~13 seconds (φ-derived). If no MIDI input is received, the learn mode cancels.

---

## 3. CC Curve Types

Each CC mapping can use a different response curve to shape how physical knob movement translates to parameter values.

### LINEAR
```
  1.0 ┤                        ╱
      │                      ╱
      │                    ╱
  0.5 ┤                  ╱
      │                ╱
      │              ╱
  0.0 ┤────────────╱
      └──┬───┬───┬───┬───┬───┬──
         0   21  42  64  85  106 127
```
Direct 1:1 mapping. Best for: volume faders, pan controls.

### LOGARITHMIC
```
  1.0 ┤                  ╱──────
      │               ╱
      │            ╱
  0.5 ┤         ╱
      │       ╱
      │     ╱
  0.0 ┤───╱
      └──┬───┬───┬───┬───┬───┬──
         0   21  42  64  85  106 127
```
More resolution at the bottom. Best for: audio levels (matches human perception), budget thresholds.

### EXPONENTIAL
```
  1.0 ┤                        ╱
      │                       ╱
      │                     ╱
  0.5 ┤                   ╱
      │                ╱
      │           ╱╱
  0.0 ┤──────╱╱
      └──┬───┬───┬───┬───┬───┬──
         0   21  42  64  85  106 127
```
More resolution at the top. Uses φ-exponential scaling. Best for: latency mapping, fine-tuning high values.

### S_CURVE
```
  1.0 ┤                    ╱────
      │                  ╱
      │                ╱
  0.5 ┤              ╱
      │            ╱
      │          ╱
  0.0 ┤────────╱
      └──┬───┬───┬───┬───┬───┬──
         0   21  42  64  85  106 127
```
Sigmoid curve with steepness derived from φ³ × 3. Gentle at extremes, responsive in the middle. Best for: parameters where you want a center detent feel.

### BEZIER
```
  1.0 ┤                      ╱──
      │                    ╱
      │                 ╱╱
  0.5 ┤              ╱╱
      │           ╱╱
      │        ╱╱
  0.0 ┤────╱╱
      └──┬───┬───┬───┬───┬───┬──
         0   21  42  64  85  106 127
```
Cubic bezier with control points at ψ² (≈ 0.382) and ψ (≈ 0.618). Smooth, organic response. Best for: creative parameters, EQ sweeps.

---

## 4. Dead Zone Configuration

Dead zones prevent jitter from noisy potentiometers. Values in the dead zone are clamped to the zone boundary.

**When to use:**
- Cheap controllers with noisy pots (random ±1 jitter)
- Parameters where accidental movement is dangerous (e.g., transport)
- Faders that don't reach true 0 or 127

**Configuration:**

| Setting      | Default | Range  | Description                           |
|--------------|---------|--------|---------------------------------------|
| `minDeadZone`| 0       | 0–10   | Values below this → 0                 |
| `maxDeadZone`| 127     | 117–127| Values above this → 127               |
| `noiseGate`  | 1       | 0–5    | Ignore changes smaller than this      |

```javascript
// Example: Set dead zones for a noisy fader
mapping.minDeadZone = 3;    // Values 0-3 → treated as 0
mapping.maxDeadZone = 124;  // Values 124-127 → treated as 127
mapping.noiseGate   = 2;    // Ignore jitter < 2
```

---

## 5. Multi-Device Profiles

HeadyMIDI supports multiple MIDI controllers simultaneously, each with its own mapping profile.

### Creating a Profile

1. Connect your controller.
2. Open **Settings → MIDI Profiles → New Profile**.
3. Name the profile (e.g., "Live Performance", "Studio Mix").
4. Map your controls using MIDI Learn.
5. Save.

### Switching Profiles

Profiles can be switched:
- Via the Dashboard UI dropdown
- Via SysEx: send `LOAD_PRESET` command
- Via Program Change on Channel 0

### Export / Import

Profiles are stored as JSON and can be shared:

```bash
# Export
cp ~/.heady/midi-profiles/live-performance.json ./backup/

# Import
cp ./backup/live-performance.json ~/.heady/midi-profiles/
```

Profile format:
```json
{
  "name": "Live Performance",
  "version": "2.0.0",
  "controller": "Launch Control XL",
  "mappings": [
    {
      "cc": 1,
      "channel": 0,
      "target": "BUDGET_USAGE",
      "curve": "logarithmic",
      "minDeadZone": 0,
      "maxDeadZone": 127,
      "noiseGate": 1
    }
  ]
}
```

---

## 6. Default CC Mappings

Out of the box, HeadyMIDI maps standard CC numbers to system metrics:

| CC # | Standard Name  | Heady Mapping   | Description                        |
|------|----------------|-----------------|------------------------------------|
| 1    | Mod Wheel      | BUDGET_USAGE    | Budget consumption level           |
| 2    | Breath         | CPU_LOAD        | CPU utilization                    |
| 3    | —              | MEMORY_PRESSURE | Memory pressure                    |
| 4    | Foot           | TASK_QUEUE_DEPTH| Task queue depth                   |
| 5    | Portamento     | LATENCY_MS      | System latency (φ-curve mapped)    |
| 6    | Data Entry     | SUCCESS_RATE    | Task success rate                  |
| 7    | Volume         | ACTIVE_AGENTS   | Active agent count                 |
| 8    | Balance        | BREAKERS_OPEN   | Open circuit breakers              |
| 9    | —              | DISK_IO         | Disk I/O utilization               |
| 10   | Pan            | NETWORK_BW      | Network bandwidth usage            |
| 11   | Expression     | GPU_UTIL        | GPU utilization                    |
| 12   | Effect 1       | TOKEN_BUDGET    | LLM token budget remaining         |
| 13   | Effect 2       | CACHE_HIT_RATE  | Cache hit rate                     |
| 14   | —              | QUEUE_LATENCY   | Queue wait time                    |
| 15   | —              | ERROR_RATE      | Error rate                         |
| 16   | General 1      | THROUGHPUT      | System throughput                  |

These defaults can be overridden per-profile.

---

## 7. Custom Mapping Examples

### Example 1: Monitoring Dashboard with Korg nanoKONTROL2

Map 8 faders to core health metrics:

| Fader | CC  | Target         | Curve       | Use Case                  |
|-------|-----|----------------|-------------|---------------------------|
| 1     | 1   | BUDGET_USAGE   | Linear      | Visual budget monitor     |
| 2     | 2   | CPU_LOAD       | Logarithmic | CPU with audio-like feel  |
| 3     | 3   | MEMORY_PRESSURE| Linear      | Memory usage              |
| 4     | 5   | LATENCY_MS     | Exponential | Latency (φ-mapped)       |
| 5     | 6   | SUCCESS_RATE   | S-Curve     | Success rate centering    |
| 6     | 7   | ACTIVE_AGENTS  | Linear      | Agent count               |
| 7     | 15  | ERROR_RATE     | Logarithmic | Error monitoring          |
| 8     | 16  | THROUGHPUT     | Linear      | Throughput gauge          |

### Example 2: Ableton Push — Live Performance

Use Push's 8 encoders + touch strip:

| Control       | CC  | Target             | Notes                         |
|---------------|-----|--------------------|-------------------------------|
| Encoder 1     | 71  | BUDGET_USAGE       | Visual ring on Push display   |
| Encoder 2     | 72  | CPU_LOAD           | Changes color at thresholds   |
| Encoder 3     | 73  | MEMORY_PRESSURE    | φ-threshold color coding      |
| Encoder 4     | 74  | LATENCY_MS         | Exponential curve             |
| Encoder 5–8   | —   | Device macro 1–4   | Via SET_MACRO SysEx           |
| Touch Strip   | —   | TRANSPORT          | Swipe for play/stop           |
| Pads (grid)   | —   | TRIGGER_CLIP       | Scene/clip grid               |

### Example 3: DJ Controller — System Operations

Creative mapping for a DJ controller:

| Control     | Action              | Mapping                          |
|-------------|---------------------|----------------------------------|
| Jog Wheel L | Navigate queue      | CC 4 → TASK_QUEUE_DEPTH         |
| Jog Wheel R | Adjust latency      | CC 5 → LATENCY_MS (exponential) |
| Channel Fader 1 | Budget control  | CC 1 → BUDGET_USAGE             |
| Channel Fader 2 | Agent scaling   | CC 7 → ACTIVE_AGENTS            |
| Crossfader  | Regime blend        | CC 8 → BREAKERS_OPEN            |
| Play/Pause  | Transport           | Note 86 → TRANSPORT_PLAY        |
| Cue         | Task trigger        | Note 36 → TASK_INGEST           |
| Sync        | Clock sync          | MIDI Clock → CloudSequencer     |

---

## 8. Troubleshooting

### Controller Not Detected

| Symptom | Fix |
|---------|-----|
| Controller not in device list | Check USB connection. Try a different port. |
| Bluetooth MIDI not pairing | Open Audio MIDI Setup (macOS) → Bluetooth Configuration. |
| Controller detected but no data | Ensure controller is sending on the correct channel (0–7). |
| "No MIDI devices" error | Restart the HeadyMIDI server. Check `node` has MIDI permissions. |

### MIDI Learn Not Working

| Symptom | Fix |
|---------|-----|
| Learn times out (13s) | Move the knob/fader during the timeout window. |
| Wrong CC captured | Cancel and retry. Move only the target knob. |
| Learn captures note instead of CC | Switch controller to CC mode (check controller manual). |
| Multiple controllers conflict | Use Profile selector to target a specific device. |

### Jitter / Noise

| Symptom | Fix |
|---------|-----|
| Value flickers ±1 | Increase `noiseGate` to 2 or 3. |
| Fader doesn't reach 0 or 127 | Adjust `minDeadZone` / `maxDeadZone`. |
| Smooth movement appears stepped | Switch to a higher-resolution curve (Bezier or S-Curve). |

### Network / Latency Issues

| Symptom | Fix |
|---------|-----|
| High latency (> 25ms) | Switch from WebSocket to UDP (port 5504). |
| WebSocket disconnects | Check `BACKOFF_BASE_MS` / `BACKOFF_MAX_MS` settings. Server auto-reconnects. |
| Clock drift between devices | Enable MIDI Clock sync from CloudSequencer. |
| Events dropping | Check ring buffer isn't full (1597 event capacity). |

### Common Error Messages

| Error | Meaning | Fix |
|-------|---------|-----|
| `UNKNOWN_MANUFACTURER` | SysEx from non-Heady device | Check manufacturer ID is 0x7D. |
| `INVALID` parse result | Malformed SysEx frame | Ensure frame starts with F0 and ends with F7. |
| `Version mismatch` | V2 command sent to V1 server | Run VERSION_NEGOTIATE first. |

---

> ⚡ Made with 💜 by HeadySystems™ & HeadyConnection™ — Sacred Geometry :: Organic Systems :: Breathing Interfaces
