<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# Signals & Metrics: Keeping Market Intel Alive

## Product Instrumentation (Minimum Viable)

### HeadyAI-IDE Events

- `connect_success`, `first_task_run_success`
- `arena_used`, `consensus_used`
- `change_accepted` / `change_reverted`
- `time_in_fix_loop` (proxy)

### HeadyMCP Events

- `connector_installed`, `tool_call_attempted`
- `tool_call_blocked` (policy)
- `tool_call_approved`, `audit_log_written`

### HeadyCheck Events

- `incident_detected`, `incident_acknowledged`, `incident_resolved`
- `mttr_seconds`
- `tool_context_switch_count`

## Market Signals to Monitor (Weekly)

1. AI IDE launches (agent features, verification features)
2. MCP ecosystem changes (protocol updates, new servers)
3. Security advisories affecting tool execution
4. Observability consolidation trends
5. Language/runtime shifts affecting agent reliability

## Operating Rhythm

- **Weekly:** Update signals + links
- **Monthly:** Update competitor map + reposition if needed
- **Quarterly:** Revisit ICP sequencing and packaging
