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
<!-- ║  FILE: HeadyConnectionKits/10-Cloud-and-Web/README.md                                                    ║
<!-- ║  LAYER: root                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# 10 — Cloud & Web Access

> Connect to HeadySystems instantly through the browser. No install required.

## What's Here

- **Web app URLs** and SSO/login instructions
- **Onboarding checklist** (step-by-step with screenshots)
- **Email template** ready to send

## Web App URLs

| Environment | URL | Status |
|---|---|---|
| Local Dev | http://localhost:3300 | For development |
| Cloud HeadyMe | https://app.headysystems.com | Active |
| Cloud HeadySystems | https://app.headysystems.com | Active |
| Cloud HeadyConnection | https://app.headysystems.com | Active |

## Onboarding Checklist

1. Open the web app URL in your browser.
2. Log in with your credentials (or request access).
3. Navigate to the dashboard — verify you see the Sacred Geometry UI.
4. Try the health endpoint: `GET /api/health` — should return `{"ok": true}`.
5. Explore the registry: `GET /api/registry`.

## Email Template

**Subject:** Connect to HeadySystems — Browser Access

**Body:**

> Hi [Name],
>
> You can access HeadySystems right now in your browser:
>
> **URL:** [insert environment URL]
>
> Just open the link, log in, and you'll land on the dashboard. No install needed.
>
> Quick check: hit `/api/health` to verify the system is live.
>
> Let me know if you need access credentials or have questions.
>
> — Heady Team
