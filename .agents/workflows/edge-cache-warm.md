---
description: Edge cache warm — pre-warm Cloudflare cache for all domains after deploy
---

# 🔥 Edge Cache Warm Workflow

> Run after any Cloudflare Worker deployment to ensure zero cold-start latency.

## Steps

1. **Purge stale cache** — Clear Cloudflare cache for all domains

   ```bash
   # Via Cloudflare API (requires CLOUDFLARE_API_TOKEN)
   for zone in $(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     "https://api.cloudflare.com/client/v4/zones?account.id=8b1fa38f282c691423c6399247d53323" \
     | jq -r '.result[].id'); do
     curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$zone/purge_cache" \
       -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
       -H "Content-Type: application/json" \
       --data '{"purge_everything":true}'
   done
   ```

2. **Warm all domains** — Fetch each domain from multiple edge locations

   ```bash
   for d in headyme.com headysystems.com headyconnection.org headymcp.com headyio.com headybuddy.org headybot.com headyos.com headyapi.com; do
     # Hit from multiple regions via headers
     curl -s -o /dev/null -w "$d: %{time_total}s\n" "https://$d/"
     curl -s -o /dev/null "https://$d/api/health" 2>/dev/null
   done
   ```

3. **Verify cache headers** — Check `CF-Cache-Status: HIT` on second request

4. **Report** — Cache warm results: domain, latency, cache status
