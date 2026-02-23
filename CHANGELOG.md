# Changelog

## [3.0.0] - 2026-02-22

### Added
- **Claude SDK Smart Routing** — Replaced raw HTTPS with `@anthropic-ai/sdk`
  - Complexity analyzer: automatic model selection (haiku 4.5 → sonnet 4 → opus 4)
  - Extended thinking for high/critical complexity queries
  - Dual-org failover ($30 headysystems → $60 headyconnection)
  - Per-request cost tracking at `/api/brain/claude-usage`
- **Security Headers** — Enabled via Helmet
  - Content Security Policy with approved sources
  - Strict-Transport-Security (1 year, includeSubDomains)
  - X-Content-Type-Options, Referrer-Policy
- **Systemd Service** — `configs/heady-manager.service` for auto-start on boot
- **Resource Watchdog** — Cron-based process monitor (every 2 min)

### Changed
- Upgraded haiku model from deprecated 3.5 to 4.5
- CORS now environment-configurable via `ALLOWED_ORIGINS`

### Fixed
- Workspace config pointed to root `/` causing system-wide file indexing

## [2.0.0] - 2026-02-21

### Added
- Voice-to-text Web Speech API widget for HeadyBuddy
- Firebase Auth (Google Sign-In) integration
- 3D Vector Memory sync
- Mobile-optimized mic button (44px touch target)

### Security
- Audited all API tokens — no hardcoded secrets
- `.gitignore` added to HeadyBuddy for `.env` protection
