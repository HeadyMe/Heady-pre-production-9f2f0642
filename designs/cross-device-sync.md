<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: designs/cross-device-sync.md                                                    ║
<!-- ║  LAYER: root                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# Cross-Device Sync Architecture for HeadyBuddy

## Problem
HeadyBuddy currently operates per-device. Users want continuity across devices (e.g., desktop, laptop, mobile).

## Proposed Solution
Extend HeadyBuddy to sync state across devices via the existing heady-manager.js service.

### Components
1. **State Model**: 
   - `conversation`: Array of messages (with timestamps, roles, content)
   - `viewState`: One of 'pill', 'main', 'expanded'
   - `pipelineState`: Current state of the pipeline (if in expanded view)
   - `config`: The user's configuration (if any)

2. **Sync Service** (in heady-manager.js):
   - Add a new endpoint `POST /api/buddy/state` to receive state updates.
   - Add a new endpoint `GET /api/buddy/state` to get the latest state (or use WebSockets for push).

3. **HeadyBuddy Changes**:
   - On startup: Fetch the latest state from the server.
   - On state change (e.g., new message, view change): Push the entire state (or a delta) to the server.
   - Listen for state updates from the server (via WebSocket or polling) and merge.

### Security
- Use the same authentication as existing API endpoints.
- Associate state with a user account (if available) or a device group token.

### Conflict Resolution
- Use last-write-wins based on timestamp for each state property.
- For conversation history, append-only so conflicts are minimal.

### Storage
- The server stores the state per user in memory (or in a database for persistence).

This is a high-level design. We will refine during implementation.
