---
name: heady-knowledge-ingestion-briefing
description: Use when the user wants to turn repositories, technical notes, strategy files, or mixed project materials into structured knowledge packs, briefings, or LLM-ready documentation. Helpful for repo-to-docs workflows, NotebookLM or knowledge-base preparation, executive briefings, and documentation hubs that work for both technical and non-technical audiences.
metadata:
  author: Perplexity Computer
  version: '1.0'
---

# Heady Knowledge Ingestion Briefing

## When to Use This Skill

Use this skill when the user asks for:

- converting repos into structured docs
- preparing knowledge packs for LLM ingestion
- building a documentation hub from scattered materials
- creating tiered technical briefings
- summarizing technical assets for business or strategic review

## Instructions

1. Identify the raw sources:
   - repositories
   - README files
   - issue threads
   - architecture docs
   - strategy notes
2. Normalize them into a small number of briefing layers:
   - executive overview
   - domain intelligence
   - architecture and services
   - strategic implications
   - source appendix
3. Keep the output optimized for both humans and machine ingestion:
   - short sections
   - descriptive headings
   - direct links
   - minimal duplication
4. If the user has many repos, group them by function rather than chronology.
5. Produce a docs structure that can live in a documentation repo or static site.
6. Highlight knowledge gaps and stale areas that need refresh.
7. If asked, generate a folder plan for /sources, /strategic, /site, or similar documentation silos.
8. End with:
   - Recommended Doc Structure
   - Suggested Briefing Order
   - Highest-Value Missing Sources

## Output Pattern

- Raw Inputs
- Proposed Information Architecture
- Briefing Stack
- Ingestion Notes
- Next Documentation Moves

## Example Prompts

- Turn these repos into a clean knowledge pack for AI ingestion
- Build a documentation hub from scattered technical notes and issues
- Create an executive and technical briefing stack from this codebase

## Provenance

This skill is grounded in the public [HeadyMe/heady-docs](https://github.com/HeadyMe/heady-docs) repository, whose README describes a "Single Source of Truth" and NotebookLM-oriented documentation flow, plus its visible /sources, /strategic, and /site structure on [GitHub](https://github.com/HeadyMe/heady-docs/tree/main/sources).
