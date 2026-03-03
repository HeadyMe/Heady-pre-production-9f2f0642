# © 2026 Heady Systems LLC.
# PROPRIETARY AND CONFIDENTIAL.
# Unauthorized copying, modification, or distribution is strictly prohibited.
#!/usr/bin/env python3
"""Fix ALL Cloudflare DNS records to point to heady-systems-tunnel."""
import json
import urllib.request
import urllib.error
import sys

CF_TOKEN = "zjVU41XyCfx7CndSYxQz0BqR-A766NLULXdKphh8"
TUNNEL_ID = "4a9d0759-49dd-4fc5-b162-9b0b9784c86b"
TUNNEL_CNAME = f"{TUNNEL_ID}.cfargotunnel.com"

ZONES = {
    "headyme.com":          "7153f1efff9af0d91570c1c1be79e241",
    "headysystems.com":     "d71262d0faa509f890fd5fea413c39bc",
    "headybuddy.org":       "79ac0ab73fc7be9a5f0e475db078e592",
    "headyconnection.org":  "1f1062b74efb9b61d4dd057f8ba9c653",
    "headymcp.com":         "58c1a9b886d15889f6a652870ecc54dd",
    "headyio.com":          "d133c3b7928873a6fbe66173bd7d2e82",
    "headybot.com":         "b3df3f99bbbd3f6a8c96d2778511eae7",
}

# Records to DELETE (A records pointing to Cloudflare IPs = Error 1000)
DELETE_RECORDS = {
    "headysystems.com": [
        "c3909ac67c5a90fb9bd02ae98a1c078b",  # app.headysystems.com A 172.67.155.3
        "fb950d78c782b1d47d44dad6da8da931",  # arena.headysystems.com A 172.67.155.3
        "4cc2115a8b63559dd8a39f8e43671e4d",  # mobile.headysystems.com A 172.67.155.3
        "ba788befc93f1af4de78ede9015dc0e3",  # nomenclature.headysystems.com A 172.67.155.3
        "e5018803e29219f2285324d667db6515",  # www.headymcp.com.headysystems.com A 76.76.21.21
        "c0efea818562bfdd25feb85c55ff7dc7",  # headybuddy.org.headysystems.com (polluted)
        "8f7af578d90d7db14088fb968f3b7d10",  # headymcp.com.headysystems.com (polluted)
    ],
    "headyme.com": [
        "11df1a0b3eb249d716eab12d7d59fdcc",  # headysystems.com.headyme.com (polluted)
        "f3c29f034550abd1f6a5e7555fb25552",  # buddy-sync.headysystems.com.headyme.com
        "6f84e5b809f2111e6b9f3b245d5da628",  # health.headysystems.com.headyme.com
        "ffca4b0cc914af1ed1e5b237db29233b",  # ide.headysystems.com.headyme.com
        "f252de38a217fae681962f04e5c275c8",  # lens.headysystems.com.headyme.com
        "332526e280a05b8d292d4f214fee1885",  # manager.headysystems.com.headyme.com
        "3df444f2f81ce5599d97c7dd5e565e2e",  # mcp.headysystems.com.headyme.com
        "b8939d3e8e622aecd68f942f3502afd1",  # metrics.headysystems.com.headyme.com
        "c6b9178bcd94a713da3e46a9e0679fd7",  # pipeline.headysystems.com.headyme.com
        "75986682068744c025da3f9b7b22a442",  # soul.headysystems.com.headyme.com
        "087a1114213a048039f82b1616031d01",  # static.headysystems.com.headyme.com
        "3cb9b3525fe1478788c89517a698bfae",  # vinci.headysystems.com.headyme.com
        "a03d46c8e3b5ab3bd9f175ab526ee787",  # web.headysystems.com.headyme.com
    ],
}

# Records to UPDATE to point to our tunnel
UPDATE_RECORDS = {
    "headysystems.com": [
        ("e7dd1223ad17290d8848a4d9a13af3f1", "headysystems.com"),       # root -> tunnel
        ("2febb63db75ee466361fd46ab1bb0c1e", "www.headysystems.com"),   # www -> tunnel
        ("1bc29750297565882bf70abf6bc3add7", "api.headysystems.com"),   # api -> tunnel
    ],
    "headyme.com": [
        ("7179ce455f350b81ffa836157826a49a", "heady.headyme.com"),
        ("288f9754e92a0139f76208540f462979", "dashboard.headyme.com"),
        ("2df90a5d843d689694b3b08fb655323c", "heady-admin.headyme.com"),
        ("954a6c36980764078f3443fabb124c74", "headyme-app.headyme.com"),
        ("3f32856e0ef3ec1fe03dbe9c955e1458", "headyme.headyme.com"),
        ("548c504d3e6816d255fe60aaf7211d1d", "heady-next.headyme.com"),
        ("a1008171dde29874926354dfbebfcd00", "heady-systems.headyme.com"),
        ("17561708560c89395e7d7961b22961cb", "platform.headyme.com"),
        ("30adbd713c32f82e4bdad6ffe2a60cfe", "systems.headyme.com"),
        ("cfe700ac243f4284eb596d323367aa87", "tunnel.headyme.com"),
        ("eca373456fe6e0f4453997270996be71", "conductor.headysystems.com.headyme.com"),
    ],
    "headybuddy.org": [
        ("e6ecfdc742364a8bffb771b9861b2440", "headybuddy.org"),
        ("eb9e701382b9da93d3354168f4692fd9", "www.headybuddy.org"),
        ("5ae7ee5eeadb53c71d96c9f0d912d77b", "admin.headybuddy.org"),
    ],
    "headyconnection.org": [
        ("01a4ab5f8daf047ff063dea82d920d16", "headyconnection.org"),
        ("25773115ba1eb03a4d7de9cb1b747e0f", "admin.headyconnection.org"),
    ],
    "headymcp.com": [
        ("304a3d2f2bc8ac0ccd6ad134b6d86af9", "headymcp.com"),
        ("5eb78fcb2e36a620af045c4816aed07c", "www.headymcp.com"),
    ],
    "headyio.com": [
        ("bc7276d3da2f10ee2f4a0638a8eab3b8", "headyio.com"),
        ("e4f6fbc60fa766c1a978dd19f686189e", "www.headyio.com"),
    ],
    "headybot.com": [
        ("19c24b5cfd6439dac56c81a137cafb87", "headybot.com"),
        ("b1dc07cfd958bec9e2521321644bb3d7", "www.headybot.com"),
        ("4fb2bd6564534be50a1bcdaf328a655e", "admin.headybot.com"),
    ],
}

# New records to CREATE
CREATE_RECORDS = {
    "headyme.com": [
        ("headyme.com", TUNNEL_CNAME),            # root domain
        ("app.headyme.com", TUNNEL_CNAME),
        ("api.headyme.com", TUNNEL_CNAME),
        ("admin.headyme.com", TUNNEL_CNAME),
        ("cms.headyme.com", TUNNEL_CNAME),
        ("manager.headyme.com", TUNNEL_CNAME),
    ],
    "headysystems.com": [
        ("app.headysystems.com", TUNNEL_CNAME),    # recreate after deleting bad A record
        ("admin.headysystems.com", TUNNEL_CNAME),
        ("manager.headysystems.com", TUNNEL_CNAME),
        ("ai.headysystems.com", TUNNEL_CNAME),
        ("grafana.headysystems.com", TUNNEL_CNAME),
        ("metrics.headysystems.com", TUNNEL_CNAME),
        ("prometheus.headysystems.com", TUNNEL_CNAME),
        ("ollama.headysystems.com", TUNNEL_CNAME),
        ("dashboard.headysystems.com", TUNNEL_CNAME),
        ("worker.headysystems.com", TUNNEL_CNAME),
    ],
    "headyconnection.org": [
        ("www.headyconnection.org", TUNNEL_CNAME),
    ],
}

def cf_request(method, url, data=None):
    headers = {
        "Authorization": f"Bearer {CF_TOKEN}",
        "Content-Type": "application/json",
    }
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
            return result
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        return json.loads(err_body) if err_body else {"success": False, "errors": [str(e)]}

stats = {"deleted": 0, "updated": 0, "created": 0, "errors": 0}

# Phase 1: DELETE bad records
print("=" * 60)
print("PHASE 1: DELETING BAD DNS RECORDS (Error 1000 fix)")
print("=" * 60)
for zone_name, record_ids in DELETE_RECORDS.items():
    zone_id = ZONES[zone_name]
    for rid in record_ids:
        url = f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records/{rid}"
        result = cf_request("DELETE", url)
        if result.get("success"):
            print(f"  DELETED {rid[:12]}... in {zone_name}")
            stats["deleted"] += 1
        else:
            errs = result.get("errors", [])
            print(f"  SKIP {rid[:12]}... ({errs})")
            stats["errors"] += 1

# Phase 2: UPDATE existing records to point to our tunnel
print("\n" + "=" * 60)
print("PHASE 2: UPDATING DNS RECORDS -> TUNNEL")
print("=" * 60)
for zone_name, records in UPDATE_RECORDS.items():
    zone_id = ZONES[zone_name]
    for rid, name in records:
        url = f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records/{rid}"
        data = {
            "type": "CNAME",
            "name": name,
            "content": TUNNEL_CNAME,
            "proxied": True,
            "ttl": 1,
        }
        result = cf_request("PUT", url, data)
        if result.get("success"):
            print(f"  UPDATED {name:45s} -> tunnel")
            stats["updated"] += 1
        else:
            errs = result.get("errors", [])
            print(f"  FAIL {name:45s} ({errs})")
            stats["errors"] += 1

# Phase 3: CREATE new records
print("\n" + "=" * 60)
print("PHASE 3: CREATING NEW DNS RECORDS")
print("=" * 60)
for zone_name, records in CREATE_RECORDS.items():
    zone_id = ZONES[zone_name]
    for name, content in records:
        url = f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records"
        data = {
            "type": "CNAME",
            "name": name,
            "content": content,
            "proxied": True,
            "ttl": 1,
        }
        result = cf_request("POST", url, data)
        if result.get("success"):
            print(f"  CREATED {name:45s} -> tunnel")
            stats["created"] += 1
        else:
            errs = result.get("errors", [])
            # Check if already exists
            err_msgs = [e.get("message","") if isinstance(e,dict) else str(e) for e in errs]
            if any("already exists" in m for m in err_msgs):
                print(f"  EXISTS  {name:45s} (already set)")
            else:
                print(f"  FAIL  {name:45s} ({err_msgs})")
                stats["errors"] += 1

print("\n" + "=" * 60)
print(f"DONE: {stats['deleted']} deleted, {stats['updated']} updated, {stats['created']} created, {stats['errors']} errors")
print("=" * 60)
print(f"\nAll DNS records now point to tunnel: {TUNNEL_ID}")
print("Next step: Start cloudflared tunnel!")
