# Validation report

## Build summary

- Dependencies installed successfully
- Automated tests passed
- Smoke check passed
- Live gateway booted successfully in file-backed mode
- Registration, login, memory upsert, memory search, MCP tool listing, MCP tool call, and API key creation all worked against the running service

## Important notes

- The rebuild intentionally replaces missing internals from the public repos with a clean working core.
- File-backed persistence works out of the box.
- PostgreSQL + pgvector mode activates automatically when `DATABASE_URL` is provided.
- The public Heady projection repos were preserved as source references in `configs/source-map.json` and `docs/SOURCE_AUDIT.md`.

## Runtime verification

Validated endpoints and flows:

- `GET /api/health`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `POST /api/memory/upsert`
- `POST /api/memory/search`
- `POST /mcp/rpc` with `tools/list`
- `POST /mcp/rpc` with `tools/call`
- `POST /api/auth/api-keys`
