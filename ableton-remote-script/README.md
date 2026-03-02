# HeadyBuddy — Ableton Live Remote Script

**Bridges Buddy ↔ Ableton Live** via TCP socket on port 11411.

## Install

### Mac

```bash
cp -r HeadyBuddy ~/Library/Preferences/Ableton/Live\ 12/User\ Remote\ Scripts/
```

### Windows

```powershell
Copy-Item -Recurse HeadyBuddy "$env:APPDATA\Ableton\Live 12\Preferences\User Remote Scripts\"
```

## Enable in Ableton

1. Open Ableton Live
2. Go to **Preferences → Link/Tempo/MIDI**
3. Under **Control Surface**, add **HeadyBuddy**
4. The script opens a TCP server on `127.0.0.1:11411`

## Connect Buddy

On the same machine, run:

```bash
cd /path/to/Heady-pre-production
DAW_REMOTE_HOST=127.0.0.1 DAW_REMOTE_PORT=11411 node heady-manager.js
```

The DAW MCP Bridge auto-connects and you can:

- Talk to Ableton via semantic intents ("make the bass heavier")
- Inject MIDI notes in real-time
- Control mixer, transport, devices, clips
- Get real-time session state pushed to Buddy

## Architecture

```
Ableton Live ←→ HeadyBuddyScript.py (TCP:11411) ←→ daw-mcp-bridge.js ←→ Buddy AI
      ↕                    ↕                              ↕
   LOM API          JSON over TCP                   Semantic Intent
   Listeners        Newline-delimited               Vector Memory
```

## Supported Commands

| Category | Commands |
|----------|----------|
| **Transport** | play, stop, record, set_tempo, get_tempo |
| **Tracks** | create_midi, create_audio, delete, volume, pan, mute, solo, arm, name |
| **Devices** | set_param, get_params, set_macro |
| **Clips** | create, delete, set_notes, fire, stop |
| **Scenes** | fire |
| **Session** | get_state, get_tracks, get_routing |
