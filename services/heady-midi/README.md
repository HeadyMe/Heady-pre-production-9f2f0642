# HeadyMIDI — MIDI Transfer Schema for the Heady Latent OS

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-Proprietary-red)
![MIDI 2.0](https://img.shields.io/badge/MIDI%202.0-UMP%20Support-green)
![φ-Powered](https://img.shields.io/badge/φ--Powered-1.618-gold)

---

## What Is This?

HeadyMIDI is a **MIDI transfer schema** that turns the MIDI protocol into a universal sub-millisecond event bus for the Heady Latent OS. Instead of just carrying music, MIDI carries **system events, metrics, task lifecycle signals, and AI orchestration commands** — all at sub-ms latency with zero HTTP in the hot path.

Every constant in the system derives from **φ ≈ 1.618** or the **Fibonacci sequence**. No magic numbers. Sacred geometry from the ground up.

```
  MIDI is the nervous system.
  Events are the impulses.
  φ is the heartbeat.
```

---

## Architecture Overview

```
┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  System      │───▶│   MidiEventBus   │◀──▶│ CloudSequencer  │
│  Channels    │    │  ring buffer     │    │  BPM=89         │
│  (8 lanes)   │    │  size=1597       │    │  φ-swing=0.618  │
└─────────────┘    └────────┬─────────┘    └────────┬────────┘
                            │                       │
           ┌────────────────┼───────────────────────┤
           │                │                       │
           ▼                ▼                       ▼
   ┌──────────────┐  ┌───────────────┐    ┌──────────────────┐
   │ SysEx Recv.  │  │ MIDI-to-MCP   │    │ WebSocket Proxy  │
   │ (M4L, 0x7D)  │  │ Bridge        │    │ port 8089        │
   │ Ableton Live │  │ Gestures→MCP  │    │ 55 clients max   │
   └──────────────┘  └───────────────┘    └──────────────────┘
           │                                        │
           ▼                                        ▼
   ┌──────────────┐                       ┌──────────────────┐
   │ Network MIDI │                       │ MIDI Bee (Swarm) │
   │ UDP 5504     │                       │ TCP 11411        │
   └──────────────┘                       └──────────────────┘
```

| Component            | Role                                                     |
|----------------------|----------------------------------------------------------|
| **MidiEventBus**     | Internal event ring buffer (1597 events). Sub-ms dispatch. JSONL audit log. |
| **CloudSequencer**   | BPM engine (default 89), φ-swing timing, WebSocket broadcast, bars:beats:ticks. |
| **SysEx Receiver**   | Max4Live device listening on manufacturer ID 0x7D. Bridges to Ableton Live. |
| **MIDI-to-MCP Bridge** | Translates MIDI events into MCP (Model Context Protocol) calls via gesture recognition. |
| **NetworkMidiTransport** | UDP port 5504, MIDI 2.0 UMP packets for LAN transport. |
| **WebSocket Proxy**  | Real-time MIDI over WebSocket for browser clients. Port 8089. |
| **MIDI Bee**         | Swarm worker agent. TCP JSON-newline on port 11411. |

---

## File Structure

```
HeadyMIDI/
├── _build-context.md                        # Build context and design requirements
├── README.md                                # This file
│
├── src/
│   ├── shared/
│   │   ├── midi-constants.js                # φ-derived constants, enums, curve functions
│   │   └── sysex-codec.js                   # 34 SysEx command encoders/decoders
│   │
│   ├── services/
│   │   ├── midi-mapping-service.js          # CC mapping, MIDI learn, profile management
│   │   ├── ai-arrangement-pipeline.js       # AI-powered arrangement generation
│   │   └── midi-websocket-proxy.js          # WebSocket MIDI proxy server
│   │
│   ├── routes/
│   │   └── midi-routes-v2.js                # REST + WebSocket API routes (v2)
│   │
│   ├── edge/
│   │   └── heady-sysex-protocol-v2.js       # Edge-optimized SysEx protocol handler
│   │
│   └── client/
│       └── hooks/
│           ├── useMidiWebSocket.js           # React hook: WebSocket MIDI connection
│           ├── useMidiLearn.js               # React hook: MIDI learn mode
│           └── useSequencer.js               # React hook: sequencer state & transport
│
├── tests/
│   └── midi-transfer-schema.test.js         # 128 tests — run with node (no framework)
│
└── docs/
    ├── midi-protocol-spec.md                # Full protocol specification
    └── hardware-mapping-guide.md            # Hardware controller mapping guide
```

---

## Setup

### Prerequisites

- Node.js 20+ (ESM support required)
- No external dependencies for core modules

### Install & Run

```bash
# Clone the repository
git clone https://github.com/HeadySystems/HeadyMIDI.git
cd HeadyMIDI

# No install needed for core — zero external dependencies
# For optional services:
npm install

# Start the WebSocket proxy server
node src/services/midi-websocket-proxy.js

# Open the dashboard
open http://localhost:8089
```

### Run Tests

```bash
node tests/midi-transfer-schema.test.js
```

Output:
```
━━━ midi-constants — φ Foundation ━━━
  ✓ PHI ≈ 1.618
  ✓ PSI ≈ 0.618
  ✓ PHI * PSI ≈ 1
  ...

━━━ Results: 128/128 passed, 0 failed ━━━
```

---

## API Endpoints

### REST API (via `midi-routes-v2.js`)

| Method | Endpoint                         | Description                         |
|--------|----------------------------------|-------------------------------------|
| GET    | `/api/midi/status`               | System status + channel states      |
| GET    | `/api/midi/channels`             | All 8 channel states                |
| GET    | `/api/midi/channels/:id`         | Single channel state                |
| POST   | `/api/midi/channels/:id/cc`      | Send CC value to channel            |
| POST   | `/api/midi/channels/:id/note`    | Send note on/off to channel         |
| POST   | `/api/midi/sysex`                | Send raw SysEx command              |
| POST   | `/api/midi/transport`            | Transport control (play/stop/rec)   |
| GET    | `/api/midi/mappings`             | List all CC mappings                |
| POST   | `/api/midi/mappings`             | Create/update CC mapping            |
| DELETE | `/api/midi/mappings/:id`         | Delete CC mapping                   |
| POST   | `/api/midi/learn/start`          | Start MIDI learn mode               |
| POST   | `/api/midi/learn/cancel`         | Cancel MIDI learn mode              |
| GET    | `/api/midi/sequencer`            | Sequencer state (BPM, position)     |
| POST   | `/api/midi/ai/arrangement`       | Generate AI arrangement             |

### WebSocket Endpoints

| Endpoint                  | Protocol   | Description                              |
|---------------------------|------------|------------------------------------------|
| `ws://host:8089/midi`     | Binary     | Real-time MIDI event stream              |
| `ws://host:8089/sequencer`| JSON       | Sequencer state updates (BPM, position)  |

---

## SysEx Command Quick Reference

| Byte   | Command              | Byte   | Command              |
|--------|----------------------|--------|----------------------|
| `0x00` | VERSION_NEGOTIATE    | `0x11` | GET_TRACK_NAMES      |
| `0x01` | SET_TEMPO            | `0x12` | GET_DEVICE_CHAIN     |
| `0x02` | SET_TRACK_VOLUME     | `0x13` | SET_MACRO            |
| `0x03` | TRIGGER_CLIP         | `0x14` | LOAD_PRESET          |
| `0x04` | SET_DEVICE_PARAM     | `0x15` | CC_RECORD_ENABLE     |
| `0x05` | TRANSPORT            | `0x16` | SET_LOOP_REGION      |
| `0x06` | CREATE_MIDI_TRACK    | `0x17` | SET_TIME_SIGNATURE   |
| `0x07` | CREATE_AUDIO_TRACK   | `0x18` | SET_TRACK_ROUTING    |
| `0x08` | SET_TRACK_SEND       | `0x19` | SOLO_TRACK           |
| `0x09` | SET_TRACK_EQ         | `0x1A` | MUTE_TRACK           |
| `0x0A` | ARM_TRACK            | `0x1B` | SET_SCENE_NAME       |
| `0x0B` | SET_CLIP_COLOR       | `0x1C` | FIRE_SCENE           |
| `0x0C` | SET_CLIP_NAME        | `0x1D` | CAPTURE_MIDI         |
| `0x0D` | QUANTIZE_CLIP        | `0x1E` | CONSOLIDATE_CLIP     |
| `0x0E` | DUPLICATE_CLIP       | `0x1F` | UNDO                 |
| `0x0F` | DELETE_CLIP          | `0x20` | AI_ARRANGEMENT       |
| `0x10` | STATUS_REQUEST       | `0x21` | AI_GENERATE_PATTERN  |

All frames: `F0 7D <cmd> [payload] F7`. Manufacturer ID `0x7D` (non-commercial).

---

## Key Constants

| Constant            | Value   | Derivation                     |
|---------------------|---------|--------------------------------|
| PHI                 | 1.618…  | `(1 + √5) / 2`               |
| PSI                 | 0.618…  | `1 / PHI`                    |
| DEFAULT_BPM         | 89      | Fibonacci number              |
| DEFAULT_PPQ         | 480     | Pulses per quarter            |
| PHI_SWING           | 0.618…  | Golden ratio swing offset     |
| EVENT_BUFFER_SIZE   | 1597    | `FIB[16]`                     |
| MAX_WS_CLIENTS      | 55      | `FIB[10]`                     |
| NETWORK_MIDI_PORT   | 5504    | Network MIDI 2.0              |
| WS_MIDI_PORT        | 8089    | WebSocket proxy               |
| ABLETON_TCP_PORT    | 11411   | Remote Script TCP             |
| MANUFACTURER_ID     | 0x7D    | MIDI non-commercial           |
| SYSEX_VERSION       | 2       | Protocol version              |

---

## Development

### Running Tests

```bash
# Run the full test suite (128 tests, no framework needed)
node tests/midi-transfer-schema.test.js

# Tests cover:
# - φ math validation (PHI, PSI, Fibonacci)
# - MIDI constants (channels, CCs, notes, velocity)
# - SysEx codec (encode/decode roundtrips for all 34 commands)
# - Protocol structure (7-bit safety, frame validation)
# - Curve functions (linear, log, exp, s-curve, bezier)
```

### Code Style

- ESM modules (`import`/`export`)
- JSDoc on all exports
- No external dependencies in core
- All constants from φ or Fibonacci — no magic numbers

### Documentation

- [Protocol Specification](docs/midi-protocol-spec.md) — complete protocol reference
- [Hardware Mapping Guide](docs/hardware-mapping-guide.md) — controller setup and mapping

---

## License

Proprietary — HeadySystems™ & HeadyConnection™. All rights reserved.

---

> ⚡ Made with 💜 by HeadySystems™ & HeadyConnection™ — Sacred Geometry :: Organic Systems :: Breathing Interfaces
