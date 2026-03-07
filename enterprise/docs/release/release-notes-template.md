# Release Notes — HeadySystems v{VERSION}

**Release Date:** {DATE}  
**Type:** {Major | Minor | Patch | Hotfix}  
**φ-revision:** 1.618  
**Release Manager:** {NAME}  

---

<!-- ─────────────────────────────────────────────────────────────────
  RELEASE NOTES TEMPLATE
  ──────────────────────────────────────────────────────────────────
  Replace all {PLACEHOLDER} values before publishing.
  Delete sections that don't apply to this release.
  Use CSL labels to indicate change importance:
    [CSL CRITICAL] — Breaking changes, security patches
    [CSL HIGH]     — Major new features, significant improvements
    [CSL MODERATE] — Minor features, non-breaking improvements
    [CSL LOW]      — Bug fixes, documentation, minor tweaks
  ──────────────────────────────────────────────────────────────────── -->

---

## Release Highlights

{2–3 sentence summary of the most important changes in this release. Lead with the user benefit, not the implementation detail.}

**Example:**
> HeadySystems v3.3.0 brings multi-model agent routing, reducing task completion time by 38.2% (1/φ²) by automatically selecting the optimal AI model per task type. This release also introduces the new Fibonacci rollout system for feature flags, enabling safer gradual deployments.

---

## New Features [CSL HIGH]

### {Feature Name}

**What it is:** {Brief description}

**Why it matters:** {User benefit}

**How to use it:**

```javascript
// Code example showing the feature
const result = await heady.{feature}.{method}({
  // Example parameters
});
```

**Documentation:** {Link to full docs}

---

### {Feature Name 2}

**What it is:** {Brief description}

**Why it matters:** {User benefit}

---

## Improvements [CSL MODERATE]

- **{Component}:** {Description of improvement and measurable impact}  
  *Before: X ms | After: Y ms (Z% improvement)*

- **{Component}:** {Description}

---

## Bug Fixes [CSL LOW]

- **Fixed** {description of what was broken and what was fixed} ([#{issue-number}](https://github.com/headysystems/heady-systems/issues/{number}))
- **Fixed** {description} ([#{issue-number}](https://github.com/headysystems/heady-systems/issues/{number}))
- **Fixed** {description}

---

## Breaking Changes [CSL CRITICAL]

> ⚠ **Breaking changes require migration.** Review the migration guide below before upgrading.

### {Breaking Change Title}

**What changed:** {Exact description of the change}

**Why it changed:** {Rationale — why was this necessary?}

**Affected:** {Who is affected — all users, specific API consumers, SDK users}

**Before:**
```javascript
// Old code that no longer works
await heady.agents.create({ name: 'my-agent' });  // ❌ Old API
```

**After:**
```javascript
// New code
await heady.agents({ name: 'my-agent' });  // ✅ New API
```

**Migration steps:**
1. {Step 1}
2. {Step 2}
3. Run `npx @heady-ai/migrate --from=3.2.x --to=3.3.0` to auto-migrate

---

## Deprecations [CSL MODERATE]

The following features are deprecated in this release and will be removed after fib(13)=233 days (sunset date: {DATE + 233 days}).

| Deprecated | Replacement | Sunset Date |
|-----------|-------------|-------------|
| `{old method}` | `{new method}` | {date} |
| `{old endpoint}` | `{new endpoint}` | {date} |

**How to check for deprecated usage:**
```bash
npx @heady-ai/sdk check-deprecated
```

---

## Migration Guide

### Upgrading from v{PREV_VERSION} to v{VERSION}

**Step 1: Update dependencies**
```bash
pnpm update @heady-ai/sdk @headysystems/semantic-logic
# or
npm update @heady-ai/sdk
```

**Step 2: Review breaking changes**
See the Breaking Changes section above.

**Step 3: Run migration script (if available)**
```bash
npx @heady-ai/migrate --from={PREV_VERSION} --to={VERSION} --dry-run
# Review output, then run:
npx @heady-ai/migrate --from={PREV_VERSION} --to={VERSION}
```

**Step 4: Test**
```bash
pnpm test
```

**Estimated migration time:** {minutes} for a standard integration

---

## Security Updates [CSL CRITICAL]

> All security vulnerabilities are patched in this release. Upgrade immediately if you are affected.

| CVE | Severity | Component | Description |
|-----|----------|-----------|-------------|
| {CVE-ID} | {Critical/High/Medium} | {package} | {description} |

---

## Performance

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Task completion (p50) | {X}ms | {Y}ms | {Z}% |
| Memory search (p99) | {X}ms | {Y}ms | {Z}% |
| Agent invocation cold start | {X}ms | {Y}ms | {Z}% |

*Benchmarks run on heady-brain with fib(16)=987 concurrent requests, us-central1.*

---

## Known Issues

- {Description of known issue and workaround, if any}
- **Tracking:** [#{issue}](https://github.com/headysystems/heady-systems/issues/{n}) — fix expected in v{PATCH+1}

---

## Release Artifacts

| Artifact | Location |
|----------|----------|
| Container image | `gcr.io/heady-production/heady-brain:v{VERSION}` |
| NPM package | `@heady-ai/sdk@{VERSION}` |
| GitHub Release | https://github.com/headysystems/heady-systems/releases/tag/v{VERSION} |
| Docker Hub | `headysystems/heady-brain:{VERSION}` |
| Helm chart | `helm/heady-systems-{VERSION}.tgz` |

---

## Feedback

- **Bug reports:** [GitHub Issues](https://github.com/headysystems/heady-systems/issues/new)
- **Feature requests:** [GitHub Discussions](https://github.com/headysystems/heady-systems/discussions)
- **Security vulnerabilities:** security@headyme.com (PGP key available)
- **General questions:** support@headyme.com or [Discord](https://discord.gg/headysystems)

---

*HeadySystems v{VERSION} — φ = 1.618033988749895*  
*Changelog: [CHANGELOG.md](../../CHANGELOG.md)*
