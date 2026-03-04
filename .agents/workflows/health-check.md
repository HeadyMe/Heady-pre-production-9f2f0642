---
description: Multi-domain health check — validates all 9 Heady™ sites + Cloud Run + internal services
---

# 🏥 Health Check Workflow

> Run this before and after any deployment, or on schedule for continuous monitoring.

## Steps

1. **Fetch all domains** — HTTP GET to all 9 Heady sites
   - headyme.com, headysystems.com, headyconnection.org, headymcp.com, headyio.com, headybuddy.org, headybot.com, headyos.com, headyapi.com
   - Record: HTTP status, response time, presence of `X-Heady-Edge` header

   ```bash
   for d in headyme.com headysystems.com headyconnection.org headymcp.com headyio.com headybuddy.org headybot.com headyos.com headyapi.com; do
     echo -n "$d: "; curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://$d/"; echo
   done
   ```

2. **Check Cloud Run service**

   ```bash
   curl -s -o /dev/null -w "%{http_code}" https://headyme-site-609590223909.us-central1.run.app/api/health
   ```

3. **Validate branding** — Each site must contain:
   - `Heady` in page title
   - Sacred geometry canvas element
   - No `localhost` or `TODO` strings

4. **Report** — Generate status table and emit telemetry event via `self-awareness.js`
