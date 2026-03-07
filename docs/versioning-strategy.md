# HeadySystems API Versioning Strategy

**Version:** 1.0.0  
**φ-revision:** 1.618  
**Last Updated:** 2026-03-07  

---

## Overview

This document defines how HeadySystems versions its APIs, handles deprecation, and supports migration across API versions.

---

## Versioning Scheme

### URL Path Versioning

All public API endpoints use URL path versioning:

```
https://api.headyme.com/api/v1/agents
https://api.headyme.com/api/v2/agents
```

**Format:** `/api/v{major}/...` where `major` is a positive integer.

**Why URL path versioning (not headers)?**
- Discoverable in browser, logs, and API explorers
- Cacheable (CDN can cache per version)
- Explicit — no ambiguous `Accept: application/vnd.heady.v2+json` negotiation
- Works in all HTTP clients without configuration

### Version Identifier Components

```
v{major}[.{minor}]
```

- **Major version** — breaking changes. Increment when: removing fields, changing types, altering auth flow, restructuring resource URLs.
- **Minor version** — additive changes only. New optional fields, new endpoints. Minor changes do NOT get a new URL path.

Current API versions:
- `/api/v1/` — GA, current
- `/api/v2/` — Planned for Q3 2026

---

## Deprecation Policy

### Sunset Period: fib(13) = 233 Days

When a major API version is deprecated:

1. **Day 0:** Deprecation announced in release notes, email notification to all API key holders
2. **Day 0+fib(5)=5:** `Deprecation` header added to all responses from deprecated version
3. **Day 0+fib(10)=55:** Warning email sent to users still calling deprecated version
4. **Day 0+fib(12)=144:** Second warning email, dashboard banner shown
5. **Day 0+fib(13)=233:** Deprecated version returns HTTP 410 Gone with migration link

### Response Headers During Deprecation

Deprecated endpoints include:
```http
HTTP/2 200 OK
Deprecation: true
Sunset: Tue, 28 Oct 2026 00:00:00 GMT
Link: <https://api.headyme.com/api/v2/agents>; rel="successor-version"
X-Heady-Deprecation-Days-Remaining: 178
X-Heady-Phi: 1.618033988749895
```

### Emergency Deprecation

For security vulnerabilities, the sunset period may be shortened to fib(7)=13 days with direct customer communication.

---

## Version Lifecycle

```
DRAFT → BETA → GA → DEPRECATED → SUNSET

DRAFT:      Internal only, no SLA
BETA:       Partner access, no breaking change guarantee
GA:         Full SLA, fib(13)=233 day deprecation guarantee
DEPRECATED: Sunset period active (Deprecation header present)
SUNSET:     Returns HTTP 410
```

---

## Backward Compatibility Rules

These changes are ALLOWED without a version bump:
- Adding optional request fields
- Adding response fields (clients must tolerate unknown fields)
- Adding new endpoints
- Reducing rate limits (with fib(10)=55 day notice)
- Bug fixes that don't change the contract
- Performance improvements

These changes REQUIRE a new major version:
- Removing or renaming request/response fields
- Changing field types (e.g., string → number)
- Changing endpoint URLs
- Changing authentication mechanism
- Changing error response format
- Removing endpoints

---

## Migration Guides

### v1 → v2 Migration (Planned)

When v2 is released, a migration guide will be published at:
```
https://docs.headyme.com/api/migration/v1-to-v2
```

The guide will include:
- Side-by-side diff of changed endpoints
- Code samples for each affected endpoint
- Automated migration checker (CLI tool)
- Changelog with rationale for each breaking change

### Version Discovery

Clients can discover available API versions:
```bash
GET https://api.headyme.com/api/versions

{
  "versions": [
    { "version": "v1", "status": "GA",         "sunset": null },
    { "version": "v2", "status": "BETA",        "sunset": null }
  ],
  "current": "v1",
  "phi": 1.618033988749895
}
```

---

## Rate Limits Per Version

Rate limits are Fibonacci-scaled and applied per API version:

| Tier | v1 Requests/min | Burst (10s) |
|------|----------------|-------------|
| Free | fib(9)=34 | fib(7)=13 |
| Pro | fib(11)=89 | fib(9)=34 |
| Enterprise | fib(13)=233 | fib(11)=89 |
| Internal | fib(16)=987 | fib(14)=377 |

Rate limit headers:
```http
X-RateLimit-Limit: 89
X-RateLimit-Remaining: 67
X-RateLimit-Reset: 1709823600
X-RateLimit-Tier: pro
X-Heady-Phi: 1.618
```

---

## SDK Version Alignment

| API Version | SDK Version | Node.js SDK Package |
|------------|-------------|---------------------|
| v1 | 1.x.x | `@heady-ai/sdk@^1.0.0` |
| v2 | 2.x.x | `@heady-ai/sdk@^2.0.0` |

SDK major versions align with API major versions. SDK minor versions (1.1, 1.2...) track additive API additions.

---

## Internal APIs

Internal service-to-service APIs (`/internal/...`) do NOT follow public versioning. They may change at any time and are not covered by the deprecation policy. Use the public API for all partner/customer integrations.

---

## Changelog

See `docs/release/changelog-template.md` for the format. API version changes are tagged with `[API]` in the changelog.
