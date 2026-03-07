---
name: heady-cross-device-sync-fabric
description: Operate, design, or troubleshoot Heady-style cross-device state sync, session handoff, shared context broadcast, device presence, and real-time WebSocket event relay. Use when the user mentions Buddy everywhere, device handoff, shared context, presence tracking, realtime sync, or cross-device orchestration.
metadata:
  author: Perplexity Computer
  version: '1.0'
---

# Heady Cross-Device Sync Fabric

## When to Use This Skill

Use this skill when the user asks for:

- cross-device sync design or debugging
- session handoff between desktop, phone, tablet, or IDE
- shared context propagation across devices
- device presence tracking and realtime collaboration
- secure WebSocket sync policy or persistence patterns

## Core Pattern

The source pattern is a WebSocket-based sync hub that keeps a device registry, session map, shared context store, persistent state file, optional vector-memory ingestion, and heartbeat/rate-limit controls in one place ([cross-device-sync.js](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/src/runtime/cross-device-sync.js)).

## Instructions

1. Identify the sync surface.
   - Determine whether the request concerns presence, context sync, handoff, relay, or persistence.
   - Separate user-facing state from system telemetry.

2. Model the sync fabric around five objects.
   - devices
   - sessions
   - shared context
   - persistent user/workspace state
   - event receipts

3. Enforce transport safety.
   - Require an auth token when sensitive state is involved.
   - Set hard limits for message size, message rate, and heartbeat timeout.
   - Reject pathologically large or bursty messages before processing.

4. Support handoff explicitly.
   - Represent each active task with a session identifier.
   - Store resumable context so a task can move from one device to another without losing state.
   - Broadcast presence and state changes to other authorized devices.

5. Persist selectively.
   - Persist durable user/workspace state.
   - Do not persist volatile socket internals.
   - Batch writes with debounce to reduce churn.

6. Add observability.
   - Emit device connected, device disconnected, context updated, workspace synced, and relay events.
   - Record useful metadata: user, device, platform, timestamp, and event type.

7. Integrate memory carefully.
   - If vector or semantic memory exists, ingest normalized sync events rather than raw noisy payloads.
   - Cap payload length before ingestion.

8. When debugging, check in this order.
   - authorization mismatch
   - rejected message policy
   - heartbeat expiry
   - persistence write failure
   - missing rebroadcast or session ownership bug

## Output Pattern

Provide:

- Sync objective
- State model
- Transport and security rules
- Handoff design
- Persistence design
- Observability hooks
- Failure modes and fixes

## Example Prompts

- Design Buddy session handoff from desktop to phone
- Debug why shared context is not reaching the second device
- Create a secure realtime sync layer with presence and rate limiting
