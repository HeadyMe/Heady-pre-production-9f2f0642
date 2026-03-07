# Data Protection Impact Assessment (DPIA)
## HeadyMe Platform — AI Processing Activities

**Template Version:** 1.0  
**Regulation Reference:** GDPR Art. 35 — Data Protection Impact Assessment  
**Document Classification:** Confidential — Internal Use  
**DPIA Lead:** [DPO_NAME]  
**Review Date:** [DATE]  
**Next Review:** [DATE + 12 months]

---

## PART 1 — SCOPE AND NECESSITY

### 1.1 Purpose of This DPIA

This DPIA template covers HeadyMe's AI processing activities including:
- AI agent conversation processing (LLM inference)
- Vector embedding and long-term memory storage
- AI-driven personalisation and recommendation
- Automated decision-making in agent workflows
- Processing of user-uploaded documents

This DPIA is required under Art. 35(1) because processing involves:
- [ ] Large-scale processing of personal data (Art. 35(1))
- [ ] Systematic and extensive automated processing including profiling (Art. 35(3)(a))
- [ ] Large-scale processing of special category data (Art. 35(3)(b))
- [ ] Systematic monitoring on a large scale (Art. 35(3)(c))
- [x] Novel technology — AI/LLM processing (ICO DPIA guidance, recital 89)
- [x] Processing likely to result in high risk to data subjects (recital 84)

---

### 1.2 Description of Processing

**Name of Processing Operation:** [PROCESSING_NAME, e.g., "HeadyBuddy AI Companion Processing"]

**Objective:** [Describe what the AI system does and its business purpose]

**Data Subjects:** [Who is affected — e.g., end users, enterprise employees]

**Data Categories Processed:**

| Category | Example Data | Volume | Sensitivity |
|----------|-------------|--------|-------------|
| Identity | Name, email | [N] records | Low |
| Behavioral | Conversation history, usage patterns | [N] records | Medium |
| Content | Messages, documents uploaded | [N] GB | Medium-High |
| Inferred | AI-derived preferences, personality insights | [N] records | High |
| Special Category (if any) | Health mentions, political views in conversations | [N] records | Very High |

**Processing Activities:**
1. [ ] Receiving and storing user messages
2. [ ] Generating vector embeddings of user content
3. [ ] Sending content to external LLM APIs (OpenAI, Anthropic, etc.)
4. [ ] Storing LLM responses
5. [ ] Personalisation based on conversation history
6. [ ] Automated decision-making (specify: _____________)
7. [ ] Cross-session memory and recall
8. [ ] User-facing analytics and reporting
9. [ ] Training/fine-tuning (if consented)

---

### 1.3 Necessity and Proportionality Assessment

| Question | Answer |
|---------|--------|
| Is the processing necessary for the stated purpose? | [Yes/No — justify] |
| Could the purpose be achieved with less data? | [Yes/No — if yes, describe how] |
| Is the retention period proportionate? | [Yes/No — justify] |
| Could less privacy-invasive means achieve the same objective? | [Yes/No — explain alternatives considered] |
| Is the legal basis appropriate for this processing? | [Yes/No — identify basis per Art. 6 and Art. 9] |

**Minimisation measures applied:**
- [ ] Only process data necessary for stated purpose
- [ ] No persistent logging of conversation content beyond user-configured retention
- [ ] Vector embeddings are derived representations, not verbatim content
- [ ] IP addresses anonymised for analytics (24h window)
- [ ] Option to disable AI memory entirely (user-controlled)

---

## PART 2 — NECESSITY AND LEGAL BASIS

### 2.1 Legal Basis

| Processing Activity | Legal Basis | Justification |
|---------------------|-------------|---------------|
| Core AI service delivery | Art. 6(1)(b) — contract | Required to deliver the AI service the user signed up for |
| Extended memory/personalisation | Art. 6(1)(a) — consent | Opt-in; user controls memory depth |
| Analytics | Art. 6(1)(f) — legitimate interests | Platform improvement; balanced by strong anonymisation |
| AI model improvement | Art. 6(1)(a) — explicit consent | Opt-in only; not required to use service |
| Special category content in conversations | Art. 9(2)(a) — explicit consent | User informed at sign-up and can disable |
| Security logging | Art. 6(1)(c) — legal obligation; 6(1)(f) — legitimate interests | Security requirements |

### 2.2 Automated Decision-Making (Art. 22)

**Does the processing involve solely automated decisions with legal or similarly significant effects?**

- [ ] Yes → Must provide: (i) meaningful information about logic; (ii) right to human review; (iii) right to contest
- [x] No (current AI features are assistive, not determinative)
- [ ] Partially — describe: [_____________]

**If AI-generated outputs influence decisions, document the human oversight mechanism:**
[DESCRIBE_HUMAN_OVERSIGHT_MECHANISM]

---

## PART 3 — RISKS TO DATA SUBJECTS

### 3.1 Risk Identification

Complete the risk register below for all identified risks.

**Risk Scoring:** Likelihood (1-5) × Severity (1-5) = Risk Score  
**Levels:** Low (1-8) | Medium (9-14) | High (15-19) | Critical (20-25)

| Risk ID | Risk Description | Likelihood | Severity | Initial Score | Level | Mitigation | Residual Score | Owner |
|---------|-----------------|------------|---------|---------------|-------|-----------|----------------|-------|
| R-001 | LLM API provider processes personal data in third country without adequate safeguards | 3 | 4 | 12 | Medium | SCCs; DPAs with all providers; avoid sending sensitive data without consent | 8 | Engineering |
| R-002 | AI model generates incorrect inferences about user (e.g., health status) that are stored as facts | 3 | 4 | 12 | Medium | Inferences clearly marked as AI-generated; user can review and delete | 6 | Product |
| R-003 | Special category data inadvertently extracted from conversations and retained | 3 | 5 | 15 | High | Content scanning for special category markers; enhanced consent prompt; user-controlled retention | 9 | Engineering |
| R-004 | Vector embeddings cannot be fully deleted — residual inference possible | 2 | 3 | 6 | Low | Vector store cascade delete via `gdpr-data-subject-rights.js`; embedding isolation by user | 4 | Engineering |
| R-005 | Prompt injection attack leads to unauthorised data disclosure via AI | 3 | 4 | 12 | Medium | `src/security/prompt-guard.js` ; output filtering; user consent for data operations | 6 | Security |
| R-006 | Conversation data retained beyond user-configured period | 2 | 4 | 8 | Low | Automated retention enforcement via `gdpr-data-subject-rights.js` scheduler | 4 | Engineering |
| R-007 | Memory recall exposes one user's data to another (tenant isolation failure) | 1 | 5 | 5 | Low | tenantId isolation at all query layers; DB row-level security | 3 | Engineering |
| R-008 | AI memory profiling creates detailed personality/behavioral profile without user awareness | 3 | 4 | 12 | Medium | Transparent memory dashboard; user control over what is stored; regular retention purge | 7 | Product |
| R-009 | Data breach of vector store exposes conversation history of many users | 2 | 5 | 10 | Medium | Encryption at rest; access controls; breach notification plan | 6 | Security |
| R-010 | Staff access to user conversations without justification | 2 | 4 | 8 | Low | RBAC enforcement; audit logging of all admin access; DPA controls | 4 | Security |
| R-011 | Training on user data without valid consent | 2 | 5 | 10 | Medium | Explicit opt-in consent required; technical enforcement; consent audit trail | 4 | Legal |
| R-012 | Cross-border transfer without adequate basis during LLM API call | 2 | 4 | 8 | Low | All LLM providers under SCCs; transfer impact assessment completed | 4 | Legal |

---

### 3.2 Residual Risk Summary

| Level | Count | Acceptable? |
|-------|-------|-------------|
| Critical (20-25) | 0 | N/A |
| High (15-19) | 0 | Yes |
| Medium (9-14) | 0 | Yes (with mitigations) |
| Low (1-8) | [All] | Yes |

**Overall residual risk: [LOW / MEDIUM] — Acceptable to proceed with documented mitigations.**

---

## PART 4 — MEASURES TO ADDRESS RISKS

### 4.1 Privacy by Design Measures

| Measure | Status | Implementation |
|---------|--------|---------------|
| Data minimisation in AI prompts | ☐ Implemented | Strip PII from prompts where not needed |
| Pseudonymisation of user IDs in LLM calls | ☐ Implemented | Internal UUID substitution before external API call |
| Vector store per-user encryption | ☐ Implemented | Tenant-scoped key derivation |
| AI memory opt-out | ☐ Implemented | User toggle disables all vector storage |
| Conversation auto-delete | ☐ Implemented | User-configurable 0–730 day retention |
| Transparency dashboard | ☐ Planned | Show user all stored memories |
| Right to erasure cascade | ☐ Implemented | `gdpr-data-subject-rights.js` |
| Consent management | ☐ Implemented | `gdpr-privacy-middleware.js` |
| Prompt injection protection | ☐ Implemented | `src/security/prompt-guard.js` |
| Audit logging | ☐ Implemented | `src/middleware/audit-log.js` |

---

### 4.2 Data Subject Rights Implementation

| Right | Technical Implementation | User-Facing Feature |
|-------|--------------------------|---------------------|
| Access (Art. 15) | Full data export via `handleAccessRequest()` | Account settings → Export my data |
| Erasure (Art. 17) | Cascade delete pg + redis + vectors + logs via `handleErasureRequest()` | Account settings → Delete my account |
| Portability (Art. 20) | Machine-readable JSON/CSV export | Account settings → Export my data |
| Object to AI processing (Art. 21) | Opt-out flag, stops AI memory | Settings → AI Memory → Disable |
| Rectification (Art. 16) | In-app edit; audit trail via `handleRectificationRequest()` | Profile settings |
| Withdraw consent | Granular consent toggles | Privacy settings → Manage consent |

---

### 4.3 Data Transfers Impact Assessment (TIA)

For each third-country transfer to LLM providers:

| Recipient | Country | Transfer Mechanism | TIA Completed | Risk Level |
|-----------|---------|-------------------|---------------|------------|
| OpenAI | US | SCCs (2021) | ☐ Yes / ☐ No | [LEVEL] |
| Anthropic | US | SCCs (2021) | ☐ Yes / ☐ No | [LEVEL] |
| Google Gemini | US/EU | SCCs / Adequacy | ☐ Yes / ☐ No | [LEVEL] |
| Groq | US | SCCs (2021) | ☐ Yes / ☐ No | [LEVEL] |
| HuggingFace | US/EU | SCCs | ☐ Yes / ☐ No | [LEVEL] |
| Cloudflare | US (edge) | SCCs | ☐ Yes / ☐ No | [LEVEL] |

---

## PART 5 — CONSULTATION

### 5.1 Internal Consultation

| Stakeholder | Role | Consulted | Date | Outcome |
|-------------|------|-----------|------|---------|
| DPO | Review and approval | ☐ Yes ☐ No | [DATE] | |
| Legal Counsel | Legal basis assessment | ☐ Yes ☐ No | [DATE] | |
| CISO / Security | Security risk review | ☐ Yes ☐ No | [DATE] | |
| Engineering Lead | Technical feasibility | ☐ Yes ☐ No | [DATE] | |
| Product Owner | User experience impact | ☐ Yes ☐ No | [DATE] | |

### 5.2 Supervisory Authority Consultation

Prior consultation required if residual risk remains HIGH after mitigation (Art. 36):

- [ ] Prior consultation required → Submit to [SUPERVISORY_AUTHORITY] before processing
- [x] Prior consultation not required — residual risk acceptable

---

## PART 6 — SIGN-OFF

| Role | Name | Decision | Signature | Date |
|------|------|---------|-----------|------|
| Data Protection Officer | | ☐ Approved ☐ Rejected ☐ Conditions | | |
| Legal Counsel | | ☐ Approved ☐ Rejected ☐ Conditions | | |
| CTO | | ☐ Approved ☐ Rejected ☐ Conditions | | |
| Product Owner | | ☐ Approved ☐ Rejected ☐ Conditions | | |

**Conditions / Required Actions Before Processing Begins:**
1. [CONDITION_1]
2. [CONDITION_2]

---

## PART 7 — REVIEW SCHEDULE

| Trigger | Action |
|---------|--------|
| Annual review | Full DPIA re-assessment |
| New LLM provider added | Update Section 4.3 TIA |
| New special category data processed | Full re-assessment + possible supervisory consultation |
| Significant product feature change involving personal data | Re-assess affected sections |
| Data breach involving AI processing | Immediate re-assessment |
| Regulatory guidance update | Review sections affected |

**Next Scheduled Review:** [DATE]  
**DPIA Registry Reference:** DPIA-[ID]-[YEAR]

---

*This DPIA complies with GDPR Art. 35 and the Article 29 Working Party Guidelines on DPIAs (WP248 rev.01). This template should be completed with legal counsel for each specific AI processing activity.*
