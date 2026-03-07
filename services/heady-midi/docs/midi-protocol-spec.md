# Heady MIDI Transfer Schema — Protocol Specification v2.0

> **Version:** 2.0.0  
> **Author:** HeadySystems™  
> **Status:** Production  
> **Last Updated:** 2026-03-07  

---

## 1. Overview

The Heady MIDI Transfer Schema treats MIDI not as a music protocol, but as a **universal sub-millisecond event bus** — the latent operating system's nervous system. Every system event (task lifecycle, agent health, scaling decisions, financial operations) is encoded as a MIDI message and dispatched through a ring buffer at sub-ms latency.

**Core principles:**

- **No magic numbers.** Every constant derives from φ ≈ 1.618 or the Fibonacci sequence.
- **MIDI 1.0 + MIDI 2.0 UMP** dual support for backward/forward compatibility.
- **SysEx V2** protocol with 34 typed commands for Ableton Live integration.
- **φ-swing timing** for humanized, organic event cadence.
- **Sub-millisecond dispatch** on the hot path — no HTTP, no polling.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Heady Latent OS                                 │
│                                                                     │
│  ┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐    │
│  │  Pipelines   │───▶│   MidiEventBus   │◀──▶│ CloudSequencer  │    │
│  │  FinOps      │    │  (ring buffer    │    │  BPM=89, PPQ=480│    │
│  │  Dispatcher  │    │   size=1597)     │    │  φ-swing=0.618  │    │
│  │  Health      │    └────────┬─────────┘    └────────┬────────┘    │
│  │  Trading     │             │                       │             │
│  │  Security    │             │ JSONL audit log        │ WebSocket   │
│  │  Swarm       │             ▼                       ▼ broadcast   │
│  │  Telemetry   │    ┌────────────────┐     ┌──────────────────┐   │
│  └─────────────┘    │ data/midi-      │     │  WS Proxy        │   │
│                      │ events.jsonl    │     │  port 8089       │   │
│                      └────────────────┘     └────────┬─────────┘   │
│                                                       │             │
│  ┌─────────────────────────────────────────────────────┤             │
│  │                                                     │             │
│  │  ┌──────────────────┐    ┌───────────────────┐     │             │
│  │  │  SysEx Receiver   │    │  MIDI-to-MCP       │     │             │
│  │  │  (M4L, 0x7D)     │◀──▶│  Bridge            │     │             │
│  │  │                   │    │  MidiParser →       │     │             │
│  │  │  Ableton Live     │    │  GestureRecognizer→ │     │             │
│  │  │  Integration      │    │  McpTranslator     │     │             │
│  │  └──────────────────┘    └───────────────────┘     │             │
│  │                                                     │             │
│  │  ┌──────────────────┐    ┌───────────────────┐     │             │
│  │  │ NetworkMidi       │    │  MIDI Bee          │     │             │
│  │  │ Transport         │◀──▶│  (Swarm worker)    │◀────┘             │
│  │  │ UDP port 5504     │    │  TCP port 11411    │                   │
│  │  │ UMP packets       │    │  JSON-newline      │                   │
│  │  └──────────────────┘    └───────────────────┘                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Channel Allocation

| Channel | Enum Name     | Description                                    |
|---------|---------------|------------------------------------------------|
| 0       | `PIPELINE`    | Pipeline orchestration — task flow events       |
| 1       | `FINOPS`      | Financial operations — budget, cost, billing    |
| 2       | `DISPATCHER`  | Task dispatch — routing, scheduling             |
| 3       | `HEALTH`      | System health — heartbeats, circuit breakers    |
| 4       | `TRADING`     | Trading signals — market events, positions      |
| 5       | `SECURITY`    | Security events — auth, audit, threats          |
| 6       | `SWARM`       | Swarm coordination — agent management           |
| 7       | `TELEMETRY`   | Telemetry & metrics — system observability      |

Channels 8–15 are reserved for future expansion.

---

## 4. Status Byte Reference

| Status Byte | Hex    | Name              | Data Bytes | Description                          |
|-------------|--------|-------------------|------------|--------------------------------------|
| NOTE_OFF    | `0x80` | Note Off          | 2          | Key release — task/event end         |
| NOTE_ON     | `0x90` | Note On           | 2          | Key press — task/event begin         |
| POLY_PRESS  | `0xA0` | Polyphonic AT     | 2          | Per-note pressure                    |
| CC          | `0xB0` | Control Change    | 2          | Continuous metric value              |
| PROG_CHANGE | `0xC0` | Program Change    | 1          | Mode/preset switch                   |
| CHAN_PRESS   | `0xD0` | Channel Pressure  | 1          | Channel-wide pressure                |
| PITCH_BEND  | `0xE0` | Pitch Bend        | 2          | 14-bit continuous value              |
| SYSEX_START | `0xF0` | SysEx Start       | variable   | System Exclusive message begin       |
| MTC_QUARTER | `0xF1` | MTC Quarter Frame | 1          | MIDI Time Code                       |
| SONG_POS    | `0xF2` | Song Position     | 2          | 14-bit song position pointer         |
| SONG_SELECT | `0xF3` | Song Select       | 1          | Song number                          |
| TUNE_REQ    | `0xF6` | Tune Request      | 0          | Request analog synth tune            |
| SYSEX_END   | `0xF7` | SysEx End         | 0          | System Exclusive message end         |
| CLOCK       | `0xF8` | Timing Clock      | 0          | 24 PPQ clock tick                    |
| START       | `0xFA` | Start             | 0          | Start playback                       |
| CONTINUE    | `0xFB` | Continue          | 0          | Continue playback                    |
| STOP        | `0xFC` | Stop              | 0          | Stop playback                        |
| ACTIVE_SENSE| `0xFE` | Active Sensing    | 0          | Keepalive                            |
| RESET       | `0xFF` | System Reset      | 0          | Reset all devices                    |

---

## 5. Note Number Assignments

### 5.1 Task Lifecycle (C2–E3)

| Note | MIDI # | Event         | Description                              |
|------|--------|---------------|------------------------------------------|
| C2   | 36     | TASK_INGEST   | New task received                        |
| D2   | 38     | TASK_DECOMPOSE| Task broken into subtasks                |
| E2   | 40     | TASK_ROUTE    | Task routed to executor                  |
| F#2  | 42     | TASK_VALIDATE | Task input validated                     |
| G#2  | 44     | TASK_PERSIST  | Task state persisted                     |
| A#2  | 46     | TASK_EXECUTE  | Task execution started                   |
| C3   | 48     | TASK_COMPLETE | Task completed successfully              |
| C#3  | 49     | TASK_FAILED   | Task execution failed                    |
| D3   | 50     | TASK_RETRY    | Task retry initiated                     |
| D#3  | 51     | TASK_TIMEOUT  | Task timed out                           |
| E3   | 52     | TASK_CANCEL   | Task cancelled                           |

### 5.2 Agent Lifecycle (C4–F4)

| Note | MIDI # | Event         | Description                              |
|------|--------|---------------|------------------------------------------|
| C4   | 60     | AGENT_SPAWN   | New agent spawned                        |
| C#4  | 61     | AGENT_KILL    | Agent terminated                         |
| D4   | 62     | AGENT_IDLE    | Agent idle, awaiting work                |
| D#4  | 63     | AGENT_BUSY    | Agent busy processing                    |
| E4   | 64     | AGENT_ERROR   | Agent encountered error                  |
| F4   | 65     | AGENT_RECOVER | Agent recovered from error               |

### 5.3 System Events (C5–G5)

| Note | MIDI # | Event          | Description                             |
|------|--------|----------------|-----------------------------------------|
| C5   | 72     | REGIME_SHIFT   | System regime change detected           |
| C#5  | 73     | CIRCUIT_OPEN   | Circuit breaker opened                  |
| D5   | 74     | CIRCUIT_CLOSE  | Circuit breaker closed                  |
| D#5  | 75     | SCALE_UP       | Scaling up resources                    |
| E5   | 76     | SCALE_DOWN     | Scaling down resources                  |
| F5   | 77     | DEPLOY_START   | Deployment started                      |
| F#5  | 78     | DEPLOY_COMPLETE| Deployment completed                    |
| G5   | 79     | DEPLOY_FAILED  | Deployment failed                       |

### 5.4 DAW Integration (C6–E6)

| Note | MIDI # | Event          | Description                             |
|------|--------|----------------|-----------------------------------------|
| C6   | 84     | CLIP_TRIGGER   | Trigger clip in Ableton                 |
| C#6  | 85     | SCENE_LAUNCH   | Launch scene                            |
| D6   | 86     | TRANSPORT_PLAY | Transport play                          |
| D#6  | 87     | TRANSPORT_STOP | Transport stop                          |
| E6   | 88     | TRANSPORT_REC  | Transport record                        |

**Velocity** encodes priority using φ-derived thresholds:

| Level    | Value | Derivation           |
|----------|-------|----------------------|
| MINIMUM  | 1     | Fixed floor           |
| LOW      | 48    | `127 × ψ²`           |
| MEDIUM   | 78    | `127 × ψ`            |
| CRITICAL | 97    | `127 × (1 − ψ³)`    |
| MAXIMUM  | 127   | Fixed ceiling         |

---

## 6. CC Controller Assignments

| CC # | Enum Name        | Description           | Value Range | Unit            |
|------|------------------|-----------------------|-------------|-----------------|
| 1    | BUDGET_USAGE     | Budget consumption    | 0–127       | Normalized %    |
| 2    | CPU_LOAD         | CPU utilization       | 0–127       | Normalized %    |
| 3    | MEMORY_PRESSURE  | Memory pressure       | 0–127       | Normalized %    |
| 4    | TASK_QUEUE_DEPTH | Queue depth           | 0–127       | Count (scaled)  |
| 5    | LATENCY_MS       | Latency               | 0–127       | 0–1000ms (φ-curve) |
| 6    | SUCCESS_RATE     | Task success rate     | 0–127       | Normalized %    |
| 7    | ACTIVE_AGENTS    | Active agent count    | 0–127       | Count           |
| 8    | BREAKERS_OPEN    | Open circuit breakers | 0–127       | Count           |
| 9    | DISK_IO          | Disk I/O utilization  | 0–127       | Normalized %    |
| 10   | NETWORK_BW       | Network bandwidth     | 0–127       | Normalized %    |
| 11   | GPU_UTIL         | GPU utilization       | 0–127       | Normalized %    |
| 12   | TOKEN_BUDGET     | LLM token budget      | 0–127       | Normalized %    |
| 13   | CACHE_HIT_RATE   | Cache hit rate        | 0–127       | Normalized %    |
| 14   | QUEUE_LATENCY    | Queue wait time       | 0–127       | Normalized ms   |
| 15   | ERROR_RATE       | Error rate            | 0–127       | Normalized %    |
| 16   | THROUGHPUT       | System throughput     | 0–127       | Normalized ops/s|

**Latency mapping (CC 5):** Uses φ-exponential curve: `MAX_STALENESS_MS × (φ^(2n) − 1) / (φ² − 1)` where `n = CC/127`. Maps CC 0 → 0ms, CC 64 → ~100ms, CC 127 → 1000ms.

---

## 7. SysEx Protocol V2

### 7.1 Frame Format

```
F0  7D  <cmd>  [<payload...>]  F7
│   │    │       │               └── SysEx End
│   │    │       └── 7-bit safe data bytes (0x00–0x7F)
│   │    └── Command byte (see table)
│   └── Manufacturer ID (0x7D — non-commercial per MIDI spec)
└── SysEx Start
```

All payload bytes **must** be 7-bit safe (< 0x80). For values exceeding 7 bits:

- **14-bit values:** Split into MSB/LSB pairs (e.g., BPM × 10)
- **Strings:** ASCII bytes, chars > 127 clamped
- **JSON:** Nibble-encoded (each byte → two nibbles, always < 0x10)
- **RGB colors:** Map [0,255] → [0,127] (half resolution)

### 7.2 Command Table

| Byte | Name                | Payload Format                                     | Description                        | Example Frame (hex)           |
|------|---------------------|----------------------------------------------------|------------------------------------|-------------------------------|
| 0x00 | VERSION_NEGOTIATE   | `<version:7>`                                      | Protocol version handshake         | `F0 7D 00 02 F7`             |
| 0x01 | SET_TEMPO           | `<bpm_hi:7> <bpm_lo:7>`                           | Set BPM (14-bit: BPM × 10)        | `F0 7D 01 09 3E F7` (120.6)  |
| 0x02 | SET_TRACK_VOLUME    | `<track:7> <volume:7>`                             | Set track volume                   | `F0 7D 02 00 64 F7`          |
| 0x03 | TRIGGER_CLIP        | `<track:7> <scene:7>`                              | Trigger clip at track/scene        | `F0 7D 03 00 05 F7`          |
| 0x04 | SET_DEVICE_PARAM    | `<track:7> <device:7> <param:7> <value:7>`         | Set device parameter               | `F0 7D 04 00 00 01 40 F7`    |
| 0x05 | TRANSPORT           | `<action:7>`                                       | Transport control                  | `F0 7D 05 01 F7` (PLAY)      |
| 0x06 | CREATE_MIDI_TRACK   | `<name_bytes...>`                                  | Create MIDI track with name        | `F0 7D 06 4C 65 61 64 F7`    |
| 0x07 | CREATE_AUDIO_TRACK  | `<name_bytes...>`                                  | Create audio track with name       | `F0 7D 07 44 72 75 6D F7`    |
| 0x08 | SET_TRACK_SEND      | `<track:7> <send:7> <value:7>`                     | Set send level                     | `F0 7D 08 00 00 64 F7`       |
| 0x09 | SET_TRACK_EQ        | `<track:7> <band:7> <freq_hi:7> <freq_lo:7> <gain:7> <q:7>` | Set EQ band            | `F0 7D 09 00 01 0A 32 40 50 F7` |
| 0x0A | ARM_TRACK           | `<track:7> <arm:1>`                                | Arm/disarm track for recording     | `F0 7D 0A 00 01 F7`          |
| 0x0B | SET_CLIP_COLOR      | `<track:7> <scene:7> <r:7> <g:7> <b:7>`           | Set clip RGB color                 | `F0 7D 0B 01 02 7F 40 00 F7` |
| 0x0C | SET_CLIP_NAME       | `<track:7> <scene:7> <name_bytes...>`              | Set clip name                      | `F0 7D 0C 00 00 48 69 F7`    |
| 0x0D | QUANTIZE_CLIP       | `<track:7> <scene:7> <quantize:7>`                 | Quantize clip                      | `F0 7D 0D 00 00 03 F7`       |
| 0x0E | DUPLICATE_CLIP      | `<src_trk:7> <src_scn:7> <dst_trk:7> <dst_scn:7>` | Duplicate clip                     | `F0 7D 0E 00 00 01 00 F7`    |
| 0x0F | DELETE_CLIP         | `<track:7> <scene:7>`                              | Delete clip                        | `F0 7D 0F 00 00 F7`          |
| 0x10 | STATUS_REQUEST      | *(none)*                                           | Request system status (JSON reply) | `F0 7D 10 F7`                |
| 0x11 | GET_TRACK_NAMES     | *(none)*                                           | Request all track names            | `F0 7D 11 F7`                |
| 0x12 | GET_DEVICE_CHAIN    | `<track:7>`                                        | Request device chain for track     | `F0 7D 12 00 F7`             |
| 0x13 | SET_MACRO           | `<track:7> <device:7> <macro:7> <value:7>`         | Set macro knob value               | `F0 7D 13 00 00 03 64 F7`    |
| 0x14 | LOAD_PRESET         | `<track:7> <device:7> <preset:7>`                  | Load device preset                 | `F0 7D 14 00 00 05 F7`       |
| 0x15 | CC_RECORD_ENABLE    | `<track:7> <cc:7> <enable:1>`                      | Enable/disable CC recording        | `F0 7D 15 00 01 01 F7`       |
| 0x16 | SET_LOOP_REGION     | `<start_bar:7> <start_beat:7> <end_bar:7> <end_beat:7>` | Set loop region              | `F0 7D 16 01 01 05 01 F7`    |
| 0x17 | SET_TIME_SIGNATURE  | `<numerator:7> <denominator:7>`                    | Set time signature                 | `F0 7D 17 04 04 F7`          |
| 0x18 | SET_TRACK_ROUTING   | `<track:7> <input_type:7> <input_ch:7>`            | Set track input routing            | `F0 7D 18 00 01 00 F7`       |
| 0x19 | SOLO_TRACK          | `<track:7> <solo:1>`                               | Solo/unsolo track                  | `F0 7D 19 00 01 F7`          |
| 0x1A | MUTE_TRACK          | `<track:7> <mute:1>`                               | Mute/unmute track                  | `F0 7D 1A 00 01 F7`          |
| 0x1B | SET_SCENE_NAME      | `<scene:7> <name_bytes...>`                        | Set scene name                     | `F0 7D 1B 00 49 6E 74 F7`    |
| 0x1C | FIRE_SCENE          | `<scene:7>`                                        | Fire (launch) scene                | `F0 7D 1C 03 F7`             |
| 0x1D | CAPTURE_MIDI        | *(none)*                                           | Start capturing MIDI               | `F0 7D 1D F7`                |
| 0x1E | CONSOLIDATE_CLIP    | `<track:7> <scene:7>`                              | Consolidate clip                   | `F0 7D 1E 00 00 F7`          |
| 0x1F | UNDO                | *(none)*                                           | Undo last action                   | `F0 7D 1F F7`                |
| 0x20 | AI_ARRANGEMENT      | `<json_nibbles...>`                                | AI arrangement (JSON payload)      | `F0 7D 20 ... F7`            |
| 0x21 | AI_GENERATE_PATTERN | `<json_nibbles...>`                                | AI pattern generation (JSON)       | `F0 7D 21 ... F7`            |

### 7.3 Transport Sub-Commands (0x05 payload)

| Byte | Name   |
|------|--------|
| 0x00 | STOP   |
| 0x01 | PLAY   |
| 0x02 | RECORD |
| 0x03 | PAUSE  |
| 0x04 | REWIND |

### 7.4 Quantize Values (0x0D payload)

| Byte | Name   | Grid           |
|------|--------|----------------|
| 0x00 | OFF    | No quantize    |
| 0x01 | Q_1_4  | Quarter note   |
| 0x02 | Q_1_8  | Eighth note    |
| 0x03 | Q_1_16 | Sixteenth note |
| 0x04 | Q_1_32 | 32nd note      |
| 0x05 | Q_1_8T | Eighth triplet |
| 0x06 | Q_1_16T| 16th triplet   |

---

## 8. MIDI 2.0 UMP Support

The Heady MIDI schema supports MIDI 2.0 Universal MIDI Packets (UMP) for higher resolution and richer messaging.

### 8.1 UMP Message Types

| Type | Hex  | Name         | Description                              |
|------|------|--------------|------------------------------------------|
| 0    | 0x0  | UTILITY      | JR timestamps, delta ticks               |
| 1    | 0x1  | SYSTEM       | System common/real-time messages         |
| 2    | 0x2  | MIDI1_VOICE  | MIDI 1.0 channel voice (backward compat) |
| 3    | 0x3  | DATA_64      | 64-bit SysEx / data messages             |
| 4    | 0x4  | MIDI2_VOICE  | MIDI 2.0 channel voice (32-bit values)  |
| 5    | 0x5  | DATA_128     | 128-bit SysEx / data messages            |
| D    | 0xD  | FLEX_DATA    | Flex data (metadata, lyrics, text)       |
| F    | 0xF  | STREAM       | Stream configuration                     |

### 8.2 UMP Group Function Codes

| Status | Hex    | Name             |
|--------|--------|------------------|
| 0x80   | 0x80   | NOTE_OFF         |
| 0x90   | 0x90   | NOTE_ON          |
| 0xA0   | 0xA0   | POLY_PRESS       |
| 0xB0   | 0xB0   | CC               |
| 0xC0   | 0xC0   | PROG_CHANGE      |
| 0xD0   | 0xD0   | CHAN_PRESS        |
| 0xE0   | 0xE0   | PITCH_BEND       |
| 0x00   | 0x00   | REG_PER_NOTE     |
| 0x10   | 0x10   | ASSIGN_PER_NOTE  |
| 0x20   | 0x20   | RPN              |
| 0x30   | 0x30   | NRPN             |

MIDI 2.0 provides 32-bit resolution for CC, velocity, and pitch bend — enabling higher-fidelity metric transport for Heady's telemetry channel.

---

## 9. Network Transport

### 9.1 UDP — Network MIDI 2.0

- **Port:** 5504 (standard Network MIDI 2.0)
- **Packet format:** UMP-wrapped MIDI messages
- **Max packet size:** 1500 bytes (MTU safe)
- **Discovery:** mDNS / DNS-SD (`_midi._udp`)

### 9.2 WebSocket Proxy

- **Port:** 8089 (WS_MIDI_PORT)
- **Protocol:** `ws://host:8089/midi`
- **Max clients:** 55 (Fibonacci — MAX_WS_CLIENTS)
- **Heartbeat:** Active Sensing (0xFE) every 300ms
- **Reconnect backoff:** Base 1300ms (FIB[7] × 100), max 89s (FIB[11] × 1000)
- **Message format:** Binary frames containing raw MIDI/UMP bytes

### 9.3 RTP-MIDI

- Standard AppleMIDI / RTP-MIDI for network session management
- Compatible with macOS CoreMIDI network sessions
- Jitter buffer: 987 events (EVENT_BUFFER_SIZE)

### 9.4 Ableton Remote Script

- **Port:** 11411 (ABLETON_TCP_PORT)
- **Protocol:** TCP, JSON-newline delimited
- **Used by:** MIDI Bee swarm workers

---

## 10. φ-Swing Timing

Traditional MIDI sequencers use straight timing (0.5 subdivision). Heady uses the **golden ratio** for organic, humanized timing:

```
Straight:   |----·----|----·----|     (subdivision at 0.500)
φ-Swing:    |------·--|------·--|     (subdivision at 0.618)
```

- **PHI_SWING = ψ ≈ 0.618** — the golden ratio conjugate
- Applied as a swing offset to the second subdivision of each beat
- Creates a natural, breathing feel that avoids mechanical repetition
- Backed by research showing φ-proportioned rhythms feel more "alive"

**Implementation:**
```
swing_offset = beat_duration × PHI_SWING
tick_position = base_tick + (is_offbeat ? swing_offset : 0)
```

Default BPM is **89** — itself a Fibonacci number — giving:
- Beat duration: ~674ms
- φ-swing offset: ~416ms into the beat

---

## 11. Latency Requirements

| Path                            | Target Latency | Budget    |
|---------------------------------|----------------|-----------|
| Event Bus (internal dispatch)   | < 1ms          | Hot path  |
| Ring buffer read/write          | < 0.1ms        | Hot path  |
| WebSocket broadcast             | < 5ms          | Warm path |
| Ableton bridge (SysEx round-trip)| < 25ms        | Warm path |
| Network MIDI (UDP)              | < 10ms         | LAN       |
| AI arrangement response         | < 2000ms       | Cold path |
| Max snapshot staleness          | 1000ms         | Defined   |

**Ring buffer sizes (Fibonacci):**
- Event buffer: 1597 events (FIB[16])
- History buffer: 1597 events (FIB[17] — 2584 if distinct, or FIB[16] by config)
- MIDI learn timeout: ~12,978ms (FIB[8] × 1000 × ψ)

---

## 12. Version Negotiation Protocol

On connection, clients and servers exchange version information:

1. **Client sends:** `F0 7D 00 <desired_version> F7`
2. **Server responds:** `F0 7D 00 <supported_version> F7`
3. **Protocol selects:** `min(client_version, server_version)`

Current version: **2** (SYSEX_VERSION)

Version 1 commands (0x01–0x05, 0x10, 0x20) are always supported. Version 2 commands (0x06–0x0F, 0x11–0x1F, 0x21) require negotiated version ≥ 2.

If a client sends a V2 command to a V1-only server, the command is silently ignored. The server may respond with a STATUS_REQUEST containing `{ version: 1 }` to signal the downgrade.

---

## Appendix A: Encoding Reference

### A.1 14-Bit Encoding

```
Value (0–16383) → MSB = (value >> 7) & 0x7F
                → LSB = value & 0x7F

Decode: value = (MSB << 7) | LSB
```

Used for: BPM (× 10 for 0.1 resolution), position values, frequency.

### A.2 String Encoding

Each character → `charCode & 0x7F`. ASCII safe. Characters above 127 clamped.

### A.3 JSON Encoding (Nibble)

Each byte of UTF-8 encoded JSON → two nibbles:
```
byte → high_nibble = (byte >> 4) & 0x0F
     → low_nibble  = byte & 0x0F
```

Always 7-bit safe since nibbles are 0x00–0x0F.

### A.4 RGB Encoding

```
[0, 255] → [0, 127]: midi_val = round((rgb_val / 255) × 127)
[0, 127] → [0, 255]: rgb_val  = round((midi_val / 127) × 255)
```

Precision: ±2 in round-trip due to 8→7→8 bit resolution loss.

---

> ⚡ Made with 💜 by HeadySystems™ & HeadyConnection™ — Sacred Geometry :: Organic Systems :: Breathing Interfaces
