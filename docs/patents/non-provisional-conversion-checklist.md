# Non-Provisional Conversion Checklist
## Heady Latent OS — Provisional-to-Non-Provisional Patent Filing
### Version 1.0 | March 2026

> **DISCLAIMER**: This checklist is for internal planning purposes only. It does not constitute legal advice. All patent applications must be prepared and filed by or under the supervision of a registered patent attorney or patent agent authorized to practice before the USPTO. Filing deadlines are jurisdictional and missing them results in permanent loss of rights.

---

## Critical Timeline Overview

```
Day 0:     Provisional application filed
           ↓
Month 11:  TARGET DATE — Begin non-provisional preparation
           (allows 30 days of revision buffer before hard deadline)
           ↓
Month 12:  HARD DEADLINE — Non-provisional must be filed
           (12 months from provisional priority date, 35 U.S.C. § 111(b)(5))
           ↓
           WARNING: No extensions available. Missing this deadline
           permanently destroys the provisional's priority benefit.
```

**For Each Heady Patent, Calculate Your Deadline**:

| Patent | Provisional Filing Date | Non-Provisional Hard Deadline | Days Remaining |
|--------|------------------------|-------------------------------|----------------|
| #1 CSL Geometric Gates | [Date] | [Date + 12 months] | [Calculate] |
| #2 Sacred Geometry Topology | [Date] | [Date + 12 months] | [Calculate] |
| #3 3D Vector Memory | [Date] | [Date + 12 months] | [Calculate] |
| #4 Bee/Swarm Factory | [Date] | [Date + 12 months] | [Calculate] |
| #5 Multi-Provider Gateway | [Date] | [Date + 12 months] | [Calculate] |
| #6 Edge-Origin Partitioning | [Date] | [Date + 12 months] | [Calculate] |
| #7 Semantic Backpressure | [Date] | [Date + 12 months] | [Calculate] |
| #8 MCP Meta-Server | [Date] | [Date + 12 months] | [Calculate] |
| #9 Self-Aware Software | [Date] | [Date + 12 months] | [Calculate] |
| #10 HDC Consensus | [Date] | [Date + 12 months] | [Calculate] |
| #11 Monte Carlo Optimization | [Date] | [Date + 12 months] | [Calculate] |
| #12 Context Capsule | [Date] | [Date + 12 months] | [Calculate] |
| #13 Ternary Logic | [Date] | [Date + 12 months] | [Calculate] |
| #14 Liquid Deploy | [Date] | [Date + 12 months] | [Calculate] |
| #15 Fibonacci Allocation | [Date] | [Date + 12 months] | [Calculate] |

---

## SECTION 1: DOCUMENTATION REQUIREMENTS

### 1.1 Inventor Documentation

- [ ] Full legal name of each inventor confirmed (match USPTO records exactly)
- [ ] Inventor residence address (city, state, country) for each inventor
- [ ] Citizenship information for each inventor
- [ ] Inventor oath/declaration prepared (USPTO Form PTO/AIA/08 or equivalent)
  - May be filed after application filing; use surcharge if needed
  - Alternative: Combined Declaration and Power of Attorney (PTO/AIA/83)
- [ ] Applicant entity type confirmed: [ ] Micro Entity / [ ] Small Entity / [ ] Large Entity
  - **Micro entity** (37 C.F.R. § 1.29): Gross income ≤ $229,164 (2025 limit); ≤ 4 previous patent applications; no obligation to assign to large entity
  - **Small entity**: Independent inventor, small business (<500 employees), or non-profit
  - Entity type affects all USPTO fees — file Certification of Micro Entity Status (PTO/SB/15A or 15B)
- [ ] Assignment documents prepared (if assigning to Heady Connection, Inc.)
  - Use USPTO Assignment Center: https://assignment.uspto.gov
  - Record assignment before or at filing to establish ownership
- [ ] Power of Attorney executed (if filing through patent counsel)

### 1.2 Prior Art / IDS Documentation

- [ ] Prior art search completed (see prior-art-search-report.md)
- [ ] Information Disclosure Statement (IDS) prepared listing all known prior art
  - Use Form PTO/SB/08 for U.S. references
  - Use Form PTO/SB/08 for foreign patents and NPL
  - File IDS at time of application filing (no fee if submitted with application)
  - Filing IDS within 3 months of filing: no fee
  - Filing IDS after first Office Action: requires Statement under § 1.97(e) or fee
- [ ] All IDS references obtained (copies of foreign patents and NPL obtained)
- [ ] Cross-references to related applications listed (if filing CIPs or continuations)

### 1.3 Reduction-to-Practice Documentation

- [ ] Working code committed to version-controlled repository with timestamps
- [ ] Code commit history preserved showing development timeline
- [ ] Lab notebooks / engineering logs documenting conception date
- [ ] Any internal demo recordings, screenshots, or test results preserved
- [ ] Dated engineering documents sufficient to establish at least conception date
- [ ] All code files referenced in claim-to-code-mapping.md confirmed accessible

---

## SECTION 2: SPECIFICATION REQUIREMENTS

The specification is the most critical part of the non-provisional application. For AI inventions specifically, the specification must contain:

### 2.1 Background Section ✓ Checklist

- [ ] Describes the technical field of the invention (1–2 sentences)
- [ ] Describes the state of the prior art and its specific technical limitations
- [ ] Frames the problem being solved as a **technical** problem (not a business problem)
- [ ] Does NOT concede more prior art than necessary
- [ ] References specific prior art patents/papers found in prior art search (if they support the differentiation narrative)
- [ ] Avoids admissions that could limit claim scope during prosecution

### 2.2 Summary of the Invention ✓ Checklist

- [ ] Provides a concise description of each independent claim in plain language
- [ ] States the specific technical improvement achieved by the invention
- [ ] Includes quantitative performance claims where supported by data
  - Example: "reduces inference latency by X% compared to prior art Y"
  - Must be supportable by experimental data in the specification
- [ ] Does not use functional claiming language that would trigger § 112(f) concern without structural support
- [ ] Describes the invention at the same scope as the broadest independent claim

### 2.3 Detailed Description ✓ Checklist

**Written Description (35 U.S.C. § 112(a))**:
- [ ] Describes every element recited in every claim
- [ ] For AI/ML claims (per EPO T 1309/23 and USPTO guidance):
  - [ ] Specifies the model architecture in detail (layer types, dimensions, attention mechanisms)
  - [ ] Describes the training procedure with sufficient specificity
  - [ ] Defines all mathematical operations referenced in claims
  - [ ] Avoids "laundry list" of AI models without implementation detail
- [ ] Describes all alternative embodiments that may support dependent claims
- [ ] Describes edge cases and failure modes (supports § 101 technical improvement argument)

**Enablement (35 U.S.C. § 112(a))**:
- [ ] A person of ordinary skill in the AI/ML art could reproduce the invention without undue experimentation
- [ ] Key algorithms are described with sufficient mathematical/procedural detail
- [ ] Key hyperparameters and threshold values are described (even if with ranges)
- [ ] Reference to code files is included (though code should be described in words too)
- [ ] Benchmark methodology described with sufficient reproducibility

**Technical Improvement Narrative** (§ 101 defense preparation):
- [ ] Specification explicitly states the specific technical problem being solved
- [ ] Specification describes **how** the invention solves it (the specific mechanism)
- [ ] Specification states measurable technical outcomes (latency, accuracy, throughput)
- [ ] Specification explains why the improvement cannot be achieved by prior art
- [ ] Specification distinguishes from purely mental/abstract implementations

**Anti-§ 101 Language Checklist**:
- [ ] Specification describes specific hardware components (processors, memory units, network interfaces)
- [ ] Specification ties algorithm to specific technical system components
- [ ] Specification avoids purely business/economic framing of the problem
- [ ] Specification includes at least one embodiment with hardware-specific details
- [ ] Specification describes concrete data structures (not just "a database" or "a system")

### 2.4 Abstract Requirements

- [ ] Abstract is a single paragraph of 150 words or fewer
- [ ] States what the invention does (not what problem it solves)
- [ ] Recites the most important technical features
- [ ] Does not use first person ("I" or "we")
- [ ] Does not use marketing language ("revolutionary," "superior")
- [ ] Can stand alone as a description of the invention

---

## SECTION 3: CLAIMS DRAFTING CHECKLIST

### 3.1 Claim Set Structure (per Application)

- [ ] At least one independent system/apparatus claim (Claim 1)
- [ ] At least one independent method claim (Claim 2)
- [ ] At least one independent computer-readable medium claim (Claim 3)
- [ ] 5–17 dependent claims providing fall-back positions
- [ ] **Total claims target**: 18–20 claims (avoids excess claim fees while maximizing coverage)
  - Under 2025 USPTO fee schedule: 3 independent claims included; $600 each over 3
  - Claims 1–20 included; $200 each over 20

### 3.2 Independent Claim Drafting Standards

Each independent claim must satisfy:

- [ ] **Open transition**: Uses "comprising" (not "consisting of") to allow for additional elements
- [ ] **One-sentence form**: USPTO requires each claim to be one sentence
- [ ] **Antecedent basis**: Every term in dependent claims was introduced in the independent claim
- [ ] **No functional language without structural support**: Avoid "module," "unit," "engine" without spec support
  - If § 112(f) is intentional, ensure full algorithm disclosure in spec
- [ ] **Specific technical improvement stated**: "wherein the [system/method] reduces [specific metric] by [specific mechanism]"
- [ ] **Concrete steps/components**: Avoids purely functional claiming ("performing optimization")
- [ ] **No relative terms without definition**: "high," "fast," "similar" must be defined or avoided
- [ ] **No product-by-process in apparatus claims**: Describe structure, not how it was made
- [ ] **No method steps in apparatus claims**: System claims describe structure, not behavior

### 3.3 Dependent Claim Strategy

- [ ] First 3–5 dependent claims add the most commercially important limitations
- [ ] Hardware-specific embodiment claims (claim reciting specific processors, memory types)
- [ ] Performance-parameter claims (claim reciting specific accuracy, latency thresholds)
- [ ] Alternative-algorithm claims (different implementations of key technical feature)
- [ ] Application-domain claims (specific use cases: healthcare AI, edge inference)
- [ ] Multi-step combination claims (combining this invention with another Heady invention)
- [ ] Security/privacy claims (encryption, access control aspects)
- [ ] Fallback scope: Each dependent claim should be separately allowable if all broader claims are rejected

### 3.4 Alice/Mayo § 101 Pre-Filing Review

For each independent claim, answer the following questions:

**Step 1 — Is the claim directed to patent-eligible subject matter?**
- [ ] Claim is directed to process, machine, manufacture, or composition (35 U.S.C. § 101)

**Step 2A, Prong 1 — Does the claim recite an abstract idea?**
- [ ] Review claim language for: mathematical formulas, mental processes, economic concepts
- If abstract idea present, proceed to Prong 2:

**Step 2A, Prong 2 — Does the claim integrate the abstract idea into a practical application?**
- [ ] Claim applies the abstract idea to a specific machine with specific technical function
- [ ] Claim specifies a particular technical field of application
- [ ] Claim produces a concrete technical result (not just an abstract output)
- [ ] Claim applies a transformation to physical subject matter
- If NO to all: proceed to Step 2B

**Step 2B — Does the claim add "significantly more" than the abstract idea?**
- [ ] Claim elements, individually or as combination, go beyond what is well-understood, routine, conventional
- [ ] Document the inventive concept that is NOT routine in the specification

**Post-*Recentive* (2025) Checklist**:
- [ ] Claim describes the **HOW** of the technical improvement (specific mechanism, not just result)
- [ ] Claim does not merely apply established ML methods to a new data environment
- [ ] Claim demonstrates improvement to the **technology itself** (not just its application)
- [ ] Per *Ex parte Desjardins* (2025): If claim improves ML model functioning, document this explicitly

---

## SECTION 4: DRAWING REQUIREMENTS

### 4.1 Required Drawing Types for Heady AI Patents

- [ ] **System architecture diagram**: Block diagram showing all claimed system components
  - Include: processors, memory, communication buses, external interfaces
  - Match every component shown to claim language
- [ ] **Method flowchart**: One flowchart per independent method claim
  - Each claim step has a corresponding flowchart box with reference number
  - Decision points clearly shown with Yes/No branches
- [ ] **Data structure diagram**: For claims involving specific data structures (embeddings, capsules, topology maps)
- [ ] **Network/topology diagram**: For distributed system patents (bee/swarm, sacred geometry)
- [ ] **Signal/state diagram**: For protocol-based patents (backpressure, context capsule transfer)

### 4.2 Drawing Compliance Standards

- [ ] Each drawing sheet: 8.5" × 11" with 1" margins on all sides
- [ ] Black ink, no color unless necessary (color requires petition + fee + justification)
- [ ] Each element in drawings has a reference numeral
- [ ] Reference numerals match what is described in detailed description
- [ ] Each figure has a descriptive title (Fig. 1 — System Architecture Overview)
- [ ] All figures referenced in the specification
- [ ] Complex figures include reference numeral keys in specification
- [ ] No text in drawings except for essential labels (use reference numerals instead)
- [ ] Flowchart diamonds (decisions) properly used for conditional steps
- [ ] Drawings reviewed by inventor to confirm technical accuracy

---

## SECTION 5: PRIORITY FILING STEPS

### 5.1 Pre-Filing Steps (30 days before deadline)

- [ ] Retrieve provisional application and compare to current implementation
- [ ] Identify any new matter developed since provisional was filed
  - **New matter cannot be added to a non-provisional claiming priority to a provisional** — only what was disclosed in the provisional can claim that priority date
  - If new matter is significant, consider a separate CIP or new application
- [ ] Confirm all claim elements are supported by the provisional disclosure
- [ ] Confirm all claim elements are supported by current codebase
- [ ] Complete prior art search (Part C and D of prior-art-search-report.md)
- [ ] Draft all claims and circulate to inventor(s) for technical accuracy review
- [ ] Draft specification with all sections complete
- [ ] Prepare all drawings

### 5.2 Filing Steps (1–2 weeks before deadline)

- [ ] Final review of all claims against § 101 checklist above
- [ ] Final review of specification for § 112(a) enablement and written description
- [ ] Prepare Application Data Sheet (ADS) — USPTO Form PTO/AIA/14
  - Inventor names and addresses
  - Applicant information (if different from inventors)
  - Priority claim to provisional application
  - Entity status (micro/small/large)
  - Title of invention
- [ ] Prepare IDS with all prior art references (Forms PTO/SB/08a and 08b)
- [ ] Calculate total filing fees based on entity status and claim count
- [ ] Prepare payment method (USPTO credit card, deposit account, or EFT)
- [ ] Confirm counsel has access to USPTO Patent Center (EFS-Web)

### 5.3 Filing Day Checklist

- [ ] Upload application via USPTO Patent Center: https://patentcenter.uspto.gov
- [ ] Attach all documents: specification, claims, abstract, drawings, ADS, declaration
- [ ] Attach IDS if ready; if not, note 3-month filing deadline from application filing date
- [ ] Pay all fees at time of filing (application filing fee, search fee, examination fee)
- [ ] Confirm filing receipt (acknowledgment receipt with application number)
- [ ] Save filing receipt and application number to patent portfolio tracker

### 5.4 Post-Filing Steps (within 30 days of filing)

- [ ] Record application number in Heady patent portfolio tracker
- [ ] Docket response deadline: first Office Action typically within 18–24 months
- [ ] If PCT filing is planned: confirm PCT application filed within 12 months of **original provisional** (not non-provisional)
- [ ] Update all cross-references in related applications
- [ ] File assignment recordation if not done at filing: https://assignment.uspto.gov
- [ ] Consider publication opt-out: non-publication request (Form PTO/SB/35) if no foreign filing planned

---

## SECTION 6: COST ESTIMATES PER FILING

### 6.1 USPTO Fees (2025 Schedule — Micro Entity)

| Fee Type | Large Entity | Small Entity | Micro Entity |
|----------|-------------|-------------|-------------|
| Basic filing fee (electronic) | $320 | $160 | $80 |
| Search fee | $700 | $350 | $175 |
| Examination fee | $800 | $400 | $200 |
| Utility application (total basic) | **$1,820** | **$910** | **$455** |
| Excess independent claims (each over 3) | $600 | $300 | $150 |
| Excess total claims (each over 20) | $200 | $100 | $50 |
| Issue fee (when allowed) | $1,200 | $600 | $300 |
| Publication fee | $0 | $0 | $0 |
| Late surcharge (if oath/declaration late) | $240 | $120 | $60 |
| IDS (if >50 references) | $200–$800 | $100–$400 | $50–$200 |

**Sample Total (3 independent claims, 20 total claims, micro entity)**:
- Filing + search + examination: $455
- Issue fee (when allowed): $300
- **Total USPTO fees to grant: ~$755 (micro entity)**

**Sample Total (3 independent claims, 20 total claims, small entity)**:
- Filing + search + examination: $910
- Issue fee: $600
- **Total USPTO fees to grant: ~$1,510 (small entity)**

### 6.2 Attorney Fees (Estimated)

| Service | Estimated Cost |
|---------|---------------|
| Prior art search (professional) | $1,500–$3,000 |
| Specification drafting (15–20 pages) | $5,000–$10,000 |
| Claims drafting (20 claims) | $2,000–$4,000 |
| Drawings preparation | $500–$2,000 |
| Filing and coordination | $500–$1,000 |
| IDS preparation | $500–$1,000 |
| **Total non-provisional preparation** | **$10,000–$21,000** |

### 6.3 Prosecution Costs (Post-Filing, Estimated)

| Service | Estimated Cost |
|---------|---------------|
| Office Action response (non-final) | $2,000–$4,000 |
| Office Action response (final) | $2,500–$5,000 |
| RCE filing (if needed) | $1,300 + $2,860 USPTO fee (small entity) |
| Interview with examiner | $500–$1,500 |
| Appeal to PTAB (if needed) | $5,000–$15,000 |
| **Average total prosecution cost** | **$5,000–$15,000 per application** |

### 6.4 Total Cost per Patent (U.S. Only, to Grant)

| Scenario | Estimated Total |
|----------|----------------|
| Simple prosecution (1–2 OAs, small entity) | $18,000–$35,000 |
| Complex prosecution (3+ OAs, small entity) | $30,000–$50,000 |
| Micro entity, streamlined prosecution | $12,000–$22,000 |

### 6.5 Portfolio Cost Summary (15 Heady Patents)

| Strategy | Estimated Total Cost to Grant |
|----------|-------------------------------|
| All 15 patents, micro entity, average prosecution | $180,000–$330,000 |
| Top 5 priority patents first | $60,000–$110,000 |
| Top 10 patents, phased over 3 years | $120,000–$220,000 |

> **Budget recommendation**: File top 5 priority patents (Bee/Swarm, 3D Vector Memory, Sacred Geometry, CSL Gates, MCP Meta-Server) in Year 1. File remaining 10 over Years 2–3 to spread costs while preserving all priority dates through CIP strategy.

---

## SECTION 7: ATTORNEY COORDINATION CHECKLIST

### 7.1 Selecting Patent Counsel

- [ ] Confirm counsel is registered to practice before the USPTO (check USPTO Roster of Attorneys)
- [ ] Verify counsel has technical background in: AI/ML, distributed systems, software architecture
- [ ] Request sample AI patent applications filed by counsel in 2024–2026
- [ ] Confirm counsel has experience with § 101 Alice/Mayo challenges for AI patents
- [ ] Review counsel's familiarity with EPO AI claim drafting (for international filings)
- [ ] Obtain fee schedule and engagement letter
- [ ] Confirm counsel's capacity to file within your timeline

### 7.2 Inventor-Counsel Disclosure Package

Prepare the following for each patent before the first counsel meeting:

- [ ] **Invention Disclosure Form (IDF)** including:
  - Invention title and one-paragraph description
  - List of inventors with contact information
  - Filing priority date (provisional date)
  - Key technical features (the 5–7 most novel elements)
  - Prior art known to inventors
  - Commercial embodiments / competitor products
  - Funding sources (grants, government contracts — affects ownership)
- [ ] **Code references**: specific files implementing the invention (from claim-to-code-mapping.md)
- [ ] **Completed prior-art-search-report.md** (Heady-internal search)
- [ ] **Business value summary**: Why this patent matters commercially (for prosecution prioritization)
- [ ] **Technical drawings**: Block diagrams or flowcharts of the inventive system

### 7.3 During Prosecution — Attorney Communication Protocol

- [ ] Respond to all counsel communications within 5 business days
- [ ] Review all draft Office Action responses before submission for technical accuracy
- [ ] Verify all claim amendments accurately represent the technical implementation
- [ ] Attend all examiner interviews if possible
- [ ] Approve all final documents before submission
- [ ] Track all response deadlines in Heady patent portfolio tracker

### 7.4 Post-Allowance Steps

- [ ] Pay issue fee within 3 months of Notice of Allowance (extendable to 6 months with surcharge)
- [ ] Review allowed claims for accuracy — request certificate of correction if errors present
- [ ] Docket maintenance fee deadlines:
  - 3.5-year maintenance: Due between 3 years 6 months and 4 years (from grant)
  - 7.5-year maintenance: Due between 7 years 6 months and 8 years
  - 11.5-year maintenance: Due between 11 years 6 months and 12 years
- [ ] Update patent portfolio tracker with final patent number
- [ ] Evaluate CIP opportunities for new improvements developed since filing

---

## MAINTENANCE FEE SCHEDULE (For Reference)

| Due Date | Large Entity | Small Entity | Micro Entity | Surcharge Window |
|----------|-------------|-------------|-------------|-----------------|
| 3.5 years from grant | $2,000 | $800 | $400 | 3.5–4 years |
| 7.5 years from grant | $3,760 | $1,504 | $752 | 7.5–8 years |
| 11.5 years from grant | $7,700 | $3,080 | $1,540 | 11.5–12 years |

> **Warning**: Missing maintenance fees results in patent expiration. The USPTO allows a 6-month grace period with surcharge, but after that, reinstatement requires petition showing unintentional delay.

---

*Checklist Version 1.0 | March 2026 | Heady Connection, Inc.*
*This document is for internal strategic use only and does not constitute legal advice.*
*USPTO fee amounts are as of early 2026; verify current fees at https://www.uspto.gov/learning-and-resources/fees-and-payment/uspto-fee-schedule*
