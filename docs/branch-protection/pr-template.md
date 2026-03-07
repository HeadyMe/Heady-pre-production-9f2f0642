<!-- 
  Pull Request Template — HeadyMe Organization
  Location: .github/PULL_REQUEST_TEMPLATE.md
  All sections marked REQUIRED must be completed. Incomplete PRs will not be merged.
-->

## Summary

<!-- REQUIRED: 2-5 sentences describing what this PR does and why. -->

**What changed:**

**Why:**

**Related issue / ticket:**
Closes #<!-- issue number -->

---

## Type of Change

<!-- Check all that apply -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Refactor (no functional change, code quality improvement)
- [ ] Performance improvement
- [ ] Security fix / hardening
- [ ] Configuration / infrastructure change
- [ ] Documentation only
- [ ] Dependency update

---

## Security Impact Assessment

<!-- REQUIRED for any change touching src/auth/, src/security/, src/middleware/, credentials, tokens, or external APIs -->

**Does this PR introduce, modify, or remove any security controls?**
- [ ] Yes — describe below
- [ ] No

**Authentication / Authorization changes:**
<!-- Describe any changes to auth flows, permissions, roles, or token handling -->

**Data exposure risk:**
<!-- Could this change expose sensitive data (PII, credentials, API keys)? -->
- [ ] No new data exposure
- [ ] Potentially — mitigated by: ___

**Injection / input validation:**
<!-- Were new user-controlled inputs added? Are they validated/sanitized? -->
- [ ] N/A
- [ ] Yes — validation implemented via: ___

**Dependency changes (security):**
<!-- New or updated npm packages? Run `npm audit` and paste results summary -->
- [ ] No dependency changes
- [ ] Dependencies added/updated — `npm audit` result: ___

**Third-party API surface changes:**
<!-- New external service integrations or changes to existing ones? -->
- [ ] None
- [ ] Added/modified: ___

---

## Compliance Impact

<!-- REQUIRED for any changes to data handling, authentication, logging, or infrastructure -->

### HIPAA
- [ ] No HIPAA impact
- [ ] This change touches PHI (Protected Health Information) — reviewed by: ___
- [ ] Access controls for PHI updated — verified: ___
- [ ] Audit logging maintained: ___

### GDPR
- [ ] No GDPR impact  
- [ ] Processes EU personal data — Data Processing Agreement reviewed: ___
- [ ] Right to erasure / data portability affected: ___
- [ ] Data retention policy affected: ___
- [ ] Art. 30 audit log coverage maintained: ___

### SOC 2
- [ ] No SOC 2 impact
- [ ] Affects trust service criteria (Security / Availability / Confidentiality / Processing Integrity / Privacy)
- [ ] Controls affected: ___
- [ ] Evidence artifacts updated: ___

### Encryption
- [ ] No changes to encryption at rest or in transit
- [ ] Encryption modified — algorithm/key management details: ___

---

## Testing Done

<!-- REQUIRED: Describe what tests cover this change. -->

**Automated tests:**
- [ ] Unit tests added/updated (location: `___`)
- [ ] Integration tests added/updated (location: `___`)
- [ ] E2E tests added/updated (location: `___`)
- [ ] No tests needed — reason: ___

**Manual testing:**
<!-- Describe steps to verify the change manually -->

1. 
2. 
3. 

**Test environments validated:**
- [ ] Local dev
- [ ] dev branch / staging
- [ ] Tested with production-like data

**Edge cases tested:**
<!-- List any edge cases, error conditions, or boundary values tested -->

**Performance:**
- [ ] No performance impact expected
- [ ] Benchmarked — results: ___

---

## Deployment Notes

<!-- Any special steps needed during or after deployment? -->

**Migrations required:**
- [ ] None
- [ ] Database migration: ___
- [ ] Config / env variable changes: ___

**Feature flags:**
- [ ] No feature flags involved
- [ ] Feature flag: `___` — should be enabled/disabled after deploy: ___

**Rollback plan:**
<!-- How do we roll back if this breaks production? -->

**Monitoring / alerts:**
<!-- Any new metrics, logs, or alerts that should be watched post-deploy? -->

---

## Reviewer Checklist

<!-- To be completed by REVIEWERS, not the PR author -->

### Code Quality
- [ ] Code follows project conventions and style guide
- [ ] No unnecessary code duplication (DRY)
- [ ] Error handling is appropriate and complete
- [ ] No debug logs, console.log, or TODO left in critical paths
- [ ] Logging is structured and does not leak sensitive data

### Security Review
- [ ] No hardcoded secrets, tokens, or credentials
- [ ] Input validation is present and correct for all user-controlled inputs
- [ ] Authentication and authorization checks are correct
- [ ] No obvious injection vulnerabilities (SQL, command, prompt)
- [ ] Sensitive data is not logged or exposed in error messages
- [ ] Dependencies have been reviewed for known CVEs (`npm audit`)
- [ ] Principle of least privilege maintained

### Compliance Review
- [ ] GDPR Art. 30 audit log coverage maintained
- [ ] PHI access controls unchanged or properly updated
- [ ] Data retention policies respected
- [ ] No compliance regressions introduced

### Architecture
- [ ] Change is consistent with system architecture and design patterns
- [ ] No circular dependencies introduced
- [ ] APIs are backwards compatible (or breaking change is documented)
- [ ] Database schema changes are migration-safe

### Testing
- [ ] Test coverage is adequate for the change
- [ ] Tests are meaningful and not just coverage padding
- [ ] All CI checks are passing

### Documentation
- [ ] Code comments updated where needed
- [ ] README / docs updated if user-facing behavior changed
- [ ] API documentation updated if applicable
- [ ] CHANGELOG entry added for notable changes

---

## Screenshots / Recordings

<!-- For UI changes: attach before/after screenshots or screen recording -->

| Before | After |
|--------|-------|
|        |       |

---

## Additional Context

<!-- Any other information relevant to reviewers -->

---

<!-- 
  By submitting this PR you confirm:
  - You have read and followed the HeadyMe Contributing Guidelines
  - All automated checks must pass before requesting review
  - This PR has been self-reviewed before requesting others' time
  - No secrets, credentials, or sensitive data are included
-->
