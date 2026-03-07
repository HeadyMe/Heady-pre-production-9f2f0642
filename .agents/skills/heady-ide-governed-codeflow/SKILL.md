---
name: heady-ide-governed-codeflow
description: Govern AI-proposed code changes through validation, auto-correction, approval, audit trails, and controlled apply or rollback. Use when the user mentions IDE bridge, code proposals, governed edits, diff validation, approval gates, trace IDs, or rollback-safe code application.
metadata:
  author: Perplexity Computer
  version: '1.0'
---

# Heady IDE Governed Codeflow

## When to Use This Skill

Use this skill when the user wants to:

- route code changes through approval gates
- validate diffs before writing files
- design an AI coding control plane
- add rollback-safe code application
- create auditability for IDE-driven edits

## Core Pattern

The source pattern is a proposal state machine with submitted, validating, validated, validation_failed, auto_correcting, governance_pending, approved, rejected, applied, and rolled_back states, plus diff hashing and trace IDs for auditability ([ide-bridge.js](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/src/services/ide-bridge.js)).

## Instructions

1. Treat every code change as a proposal.
   - Capture intent, target file, proposed diff, actor, and priority.
   - Generate a stable proposal identifier and content hash.

2. Run deterministic validation before any file write.
   - path safety
   - diff size bounds
   - credential detection
   - production logging standards
   - any repo-specific policy checks

3. Support self-correction, but bound it.
   - Attempt auto-correction only on known failure classes.
   - Limit correction iterations.
   - Record the strategy used and whether the correction changed the governance path.

4. Separate validation from approval.
   - Validation proves the diff is structurally acceptable.
   - Governance decides whether the change should happen.
   - Never collapse those into one step for high-risk edits.

5. Require auditable approval for sensitive files.
   - auth
   - deployment
   - security
   - secrets handling
   - billing
   - production routing

6. Apply safely.
   - Back up the original file.
   - Write atomically when possible.
   - Record appliedAt, approver context, and trace identifier.

7. Make rollback first-class.
   - Preserve original content or reversible diff metadata.
   - Allow revert by proposal identifier.
   - Emit a rollback event into audit history.

8. When designing the interface, expose these endpoints or equivalents.
   - submit proposal
   - evaluate proposal
   - approve or reject proposal
   - apply approved proposal
   - rollback applied proposal
   - proposal status and history

## Output Pattern

Provide:

- Proposal schema
- Validation rules
- Approval rules
- Apply and rollback flow
- Audit fields
- Failure modes and mitigations

## Example Prompts

- Design an IDE approval workflow for AI code edits
- Add diff validation and rollback to our coding agent
- Create traceable governed patch application for production repos
