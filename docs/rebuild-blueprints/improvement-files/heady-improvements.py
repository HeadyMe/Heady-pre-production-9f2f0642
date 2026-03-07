#!/usr/bin/env python3
"""
Generate Heady Project & HeadyMe Repos — Comprehensive Improvement Plan PDF
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.pdfgen import canvas
from datetime import datetime

# Colors
DARK_NAVY = HexColor("#091717")
DARK_TEAL = HexColor("#13343B")
DEEP_TEAL = HexColor("#115058")
MUTED_TEAL = HexColor("#20808D")
LIGHT_TEAL = HexColor("#D6F5FA")
OFF_WHITE = HexColor("#FCFAF6")
PAPER_WHITE = HexColor("#F3F3EE")
WARM_BEIGE = HexColor("#E5E3D4")
TERRA = HexColor("#A84B2F")
MAUVE = HexColor("#944454")
GOLD = HexColor("#FFC553")

OUTPUT = "/home/user/workspace/heady-improvement-plan.pdf"

def build_pdf():
    doc = SimpleDocTemplate(
        OUTPUT, pagesize=letter,
        title="Heady Project & HeadyMe Repos — Improvement Plan",
        author="Perplexity Computer",
        leftMargin=0.75*inch, rightMargin=0.75*inch,
        topMargin=0.75*inch, bottomMargin=0.75*inch,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "CustomTitle", parent=styles["Title"],
        fontSize=22, leading=26, textColor=DARK_TEAL,
        spaceAfter=6, fontName="Helvetica-Bold",
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", parent=styles["Normal"],
        fontSize=11, leading=14, textColor=MUTED_TEAL,
        spaceAfter=18, fontName="Helvetica",
    )
    h1_style = ParagraphStyle(
        "H1", parent=styles["Heading1"],
        fontSize=16, leading=20, textColor=DEEP_TEAL,
        spaceBefore=18, spaceAfter=8, fontName="Helvetica-Bold",
    )
    h2_style = ParagraphStyle(
        "H2", parent=styles["Heading2"],
        fontSize=13, leading=16, textColor=DARK_TEAL,
        spaceBefore=14, spaceAfter=6, fontName="Helvetica-Bold",
    )
    h3_style = ParagraphStyle(
        "H3", parent=styles["Heading3"],
        fontSize=11, leading=14, textColor=MUTED_TEAL,
        spaceBefore=10, spaceAfter=4, fontName="Helvetica-Bold",
    )
    body_style = ParagraphStyle(
        "Body", parent=styles["Normal"],
        fontSize=9.5, leading=13, textColor=DARK_TEAL,
        spaceAfter=6, fontName="Helvetica",
    )
    bullet_style = ParagraphStyle(
        "Bullet", parent=body_style,
        leftIndent=18, bulletIndent=6,
        spaceAfter=3,
    )
    code_style = ParagraphStyle(
        "Code", parent=styles["Code"],
        fontSize=8, leading=10, textColor=DARK_NAVY,
        backColor=PAPER_WHITE, borderPadding=4,
        leftIndent=12, spaceAfter=6,
        fontName="Courier",
    )
    severity_critical = ParagraphStyle(
        "Critical", parent=body_style,
        textColor=TERRA, fontName="Helvetica-Bold",
    )
    severity_high = ParagraphStyle(
        "High", parent=body_style,
        textColor=MAUVE, fontName="Helvetica-Bold",
    )
    label_style = ParagraphStyle(
        "Label", parent=body_style,
        fontSize=8, leading=10, textColor=MUTED_TEAL,
        fontName="Helvetica",
    )

    story = []

    # ── TITLE PAGE ──
    story.append(Spacer(1, 1.5*inch))
    story.append(Paragraph("Heady Project &amp; HeadyMe Repos", title_style))
    story.append(Paragraph("Comprehensive Improvement Plan", ParagraphStyle(
        "TitleSub", parent=title_style, fontSize=16, leading=20, textColor=MUTED_TEAL,
    )))
    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="60%", thickness=2, color=MUTED_TEAL))
    story.append(Spacer(1, 12))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%B %d, %Y')}", subtitle_style))
    story.append(Paragraph("Prepared for: Eric Head — HeadySystems Inc. / HeadyConnection Inc.", subtitle_style))
    story.append(Spacer(1, 24))

    # Summary box
    summary_data = [
        [Paragraph("<b>Audit Scope</b>", label_style), Paragraph("3 GitHub orgs, 27 repos (13 active in HeadyMe, 7 archived in HeadySystems, 7 archived in HeadyConnection)", body_style)],
        [Paragraph("<b>Critical Issues</b>", label_style), Paragraph("8 critical, 12 high, 15 medium priority findings", body_style)],
        [Paragraph("<b>Key Themes</b>", label_style), Paragraph("Hollow core repos, stale references, missing CI/CD, empty production targets, branding inconsistencies", body_style)],
    ]
    summary_table = Table(summary_data, colWidths=[1.3*inch, 5.5*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), PAPER_WHITE),
        ('TEXTCOLOR', (0, 0), (-1, -1), DARK_TEAL),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('BOX', (0, 0), (-1, -1), 1, WARM_BEIGE),
        ('LINEBELOW', (0, 0), (-1, -2), 0.5, WARM_BEIGE),
    ]))
    story.append(summary_table)
    story.append(PageBreak())

    # ── TABLE OF CONTENTS ──
    story.append(Paragraph("Table of Contents", h1_style))
    story.append(Spacer(1, 6))
    toc_items = [
        "1. Executive Summary",
        "2. Repository Landscape",
        "3. Critical Issues (P0)",
        "4. High-Priority Issues (P1)",
        "5. Medium-Priority Improvements (P2)",
        "6. Cross-Repo Consistency Fixes",
        "7. CI/CD & Deployment Improvements",
        "8. README & Documentation Overhaul",
        "9. package.json Corrections",
        "10. Prioritized Implementation Roadmap",
    ]
    for item in toc_items:
        story.append(Paragraph(item, body_style))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════
    # SECTION 1: EXECUTIVE SUMMARY
    # ══════════════════════════════════════════════════════
    story.append(Paragraph("1. Executive Summary", h1_style))
    story.append(Paragraph(
        "A full audit of the HeadyMe GitHub organization (13 repos), HeadySystems (7 archived repos), "
        "and HeadyConnection (7 archived repos) reveals a project with a strong monorepo foundation "
        "(Heady-pre-production-9f2f0642) but significant gaps in the projected core repos and "
        "production deployment targets. The monorepo contains ~150+ files with sophisticated architecture "
        "(20-node AI system, Sacred Geometry orchestration, HCFullPipeline). However, the 9 individual "
        "'-core' repos that are supposed to represent standalone services are essentially hollow "
        "scaffolds, each containing only a minimal Express server, a site-config.json, a Dockerfile, "
        "and a boilerplate README. The two '-production' repos (headysystems-production and "
        "headymcp-production) are similarly underdeveloped.",
        body_style
    ))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "This plan identifies 35 specific improvements across 5 priority tiers, with file-level "
        "instructions for each fix. The goal: bring every repo to a state where it is genuinely "
        "functional, properly branded, correctly cross-linked, and deployed or deploy-ready.",
        body_style
    ))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════
    # SECTION 2: REPOSITORY LANDSCAPE
    # ══════════════════════════════════════════════════════
    story.append(Paragraph("2. Repository Landscape", h1_style))
    story.append(Paragraph("HeadyMe Organization (Active — 13 repos)", h2_style))

    repo_data = [
        [Paragraph("<b>Repo</b>", label_style), Paragraph("<b>Role</b>", label_style), Paragraph("<b>Status</b>", label_style), Paragraph("<b>Health</b>", label_style)],
        ["Heady-pre-production-9f2f0642", "Monorepo / Source of Truth", "Active (updated today)", "Good — 150+ files, real code"],
        ["headysystems-production", "Production deploy target", "Active (updated today)", "Hollow — 4 files only"],
        ["headymcp-production", "MCP production deploy target", "Active (updated today)", "Empty — README only"],
        ["headyme-core", "Personal cloud hub service", "Active", "Scaffold — minimal Express"],
        ["headymcp-core", "MCP tools service", "Active", "Scaffold — minimal Express"],
        ["headybuddy-core", "AI companion service", "Active", "Scaffold — minimal Express"],
        ["headyapi-core", "API gateway service", "Active", "Scaffold — minimal Express"],
        ["headyos-core", "Latent OS service", "Active", "Scaffold — minimal Express"],
        ["headybot-core", "Bot framework service", "Active", "Scaffold — minimal Express"],
        ["headyio-core", "Developer SDK", "Active", "Scaffold — minimal Express"],
        ["headyconnection-core", "Community workspace", "Active", "Scaffold — minimal Express"],
        ["headysystems-core", "Infrastructure engine", "Active", "Scaffold — minimal Express"],
        ["heady-docs", "Documentation hub", "Active", "Good — structured docs"],
    ]

    for i in range(1, len(repo_data)):
        repo_data[i] = [Paragraph(str(c), body_style) for c in repo_data[i]]

    repo_table = Table(repo_data, colWidths=[2.0*inch, 1.7*inch, 1.5*inch, 1.8*inch])
    repo_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DEEP_TEAL),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('BACKGROUND', (0, 1), (-1, -1), OFF_WHITE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [OFF_WHITE, PAPER_WHITE]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, WARM_BEIGE),
    ]))
    story.append(repo_table)
    story.append(Spacer(1, 12))

    story.append(Paragraph("HeadySystems &amp; HeadyConnection (All Archived — 7 repos each)", h2_style))
    story.append(Paragraph(
        "All repos in both HeadySystems and HeadyConnection orgs are archived. This is correct — "
        "HeadyMe is the canonical active org. No action needed on archived repos unless you want to "
        "add archive notices pointing to HeadyMe equivalents.",
        body_style
    ))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════
    # SECTION 3: CRITICAL ISSUES (P0)
    # ══════════════════════════════════════════════════════
    story.append(Paragraph("3. Critical Issues (P0)", h1_style))
    story.append(Paragraph("These must be fixed first. They represent broken, empty, or misleading states.", severity_critical))
    story.append(Spacer(1, 8))

    # Issue 1
    story.append(Paragraph("P0-1: headymcp-production is Empty", h2_style))
    story.append(Paragraph(
        "The headymcp-production repo contains only a README.md. It is supposed to be the autonomous "
        "deployment target for headymcp.com. The live site at headymcp.com shows an MCP dashboard, "
        "but this repo has no code to deploy.",
        body_style
    ))
    story.append(Paragraph("<b>Fix:</b>", body_style))
    story.append(Paragraph("&bull; Add the MCP dashboard HTML/CSS/JS to this repo (either build from the monorepo or create a static site)", bullet_style))
    story.append(Paragraph("&bull; Add _headers and _redirects files (like headysystems-production)", bullet_style))
    story.append(Paragraph("&bull; Add a deploy workflow to .github/workflows/", bullet_style))
    story.append(Paragraph("&bull; Ensure Cloudflare Pages is configured to deploy from this repo", bullet_style))
    story.append(Spacer(1, 8))

    # Issue 2
    story.append(Paragraph("P0-2: headysystems-production Has Only 4 Files", h2_style))
    story.append(Paragraph(
        "The production deployment target for headysystems.com contains only index.html, _headers, "
        "_redirects, and README.md. There is no CI/CD workflow, no tests, no build process. "
        "The _redirects file hardcodes a specific Cloud Run URL "
        "(heady-manager-609590223909.us-central1.run.app) which is fragile.",
        body_style
    ))
    story.append(Paragraph("<b>Fix:</b>", body_style))
    story.append(Paragraph("&bull; Add a GitHub Actions workflow that auto-deploys to Cloudflare Pages on push", bullet_style))
    story.append(Paragraph("&bull; Extract the hardcoded Cloud Run URL into an environment variable or config", bullet_style))
    story.append(Paragraph("&bull; Add a basic smoke test that verifies the deployed site returns 200", bullet_style))
    story.append(Paragraph("&bull; Consider building the index.html from the monorepo instead of maintaining it separately", bullet_style))
    story.append(Spacer(1, 8))

    # Issue 3
    story.append(Paragraph("P0-3: All 9 Core Repos Are Hollow Scaffolds", h2_style))
    story.append(Paragraph(
        "Every '-core' repo (headyme-core, headymcp-core, headybuddy-core, headyapi-core, "
        "headyos-core, headybot-core, headyio-core, headyconnection-core, headysystems-core) "
        "contains the exact same minimal template: a ~20-line Express server that serves a basic "
        "HTML page with the service name and description. The index.js files are nearly identical. "
        "None of them have real business logic, tests, or service-specific functionality.",
        body_style
    ))
    story.append(Paragraph("<b>Fix (choose one strategy):</b>", body_style))
    story.append(Paragraph(
        "&bull; <b>Option A — Projection Build:</b> Add a build script to the monorepo that extracts "
        "and projects service-specific code into each core repo automatically. The deploy.yml workflow "
        "already references this pattern. Make it real.", bullet_style))
    story.append(Paragraph(
        "&bull; <b>Option B — Meaningful Stubs:</b> If the repos are meant as deployment targets, "
        "add service-specific routes, health checks, and at least one real endpoint per repo that "
        "does something unique (e.g., headyapi-core should have /api/v1/status, headymcp-core "
        "should list available MCP tools, headybuddy-core should have a chat endpoint).", bullet_style))
    story.append(Paragraph(
        "&bull; <b>Option C — Archive and Consolidate:</b> If all real code lives in the monorepo, "
        "consider archiving the core repos and using the monorepo + production repos exclusively. "
        "This removes confusion about which repos matter.", bullet_style))
    story.append(Spacer(1, 8))

    # Issue 4
    story.append(Paragraph("P0-4: package.json Points to Archived HeadySystems Org", h2_style))
    story.append(Paragraph(
        "In the monorepo (Heady-pre-production-9f2f0642), package.json has:<br/>"
        "<font face='Courier' size='8'>"
        "\"repository\": \"https://github.com/HeadySystems/Heady.git\"</font><br/>"
        "<font face='Courier' size='8'>"
        "\"bugs\": \"https://github.com/HeadySystems/Heady/issues\"</font><br/>"
        "Both point to the archived HeadySystems org. These should point to HeadyMe.",
        body_style
    ))
    story.append(Paragraph("<b>Fix:</b>", body_style))
    story.append(Paragraph("&bull; Update repository.url to https://github.com/HeadyMe/Heady-pre-production-9f2f0642.git", bullet_style))
    story.append(Paragraph("&bull; Update bugs.url to https://github.com/HeadyMe/Heady-pre-production-9f2f0642/issues", bullet_style))
    story.append(Spacer(1, 8))

    # Issue 5
    story.append(Paragraph("P0-5: Author Email Typo in package.json", h2_style))
    story.append(Paragraph(
        "The monorepo's package.json author email is 'e@headyconnection.org' — likely should be "
        "'eric@headyconnection.org' to match the actual contact email.",
        body_style
    ))
    story.append(Paragraph("<b>Fix:</b> Update author.email to eric@headyconnection.org", body_style))
    story.append(Spacer(1, 8))

    # Issue 6
    story.append(Paragraph("P0-6: Build Script is a Placeholder", h2_style))
    story.append(Paragraph(
        "The monorepo's 'build' script in package.json is:<br/>"
        "<font face='Courier' size='8'>\"build\": \"echo 'Frontend build not yet configured'\"</font><br/>"
        "Similarly, 'build-all' says 'HeadyBrowser desktop/mobile builds not yet available'. "
        "A project at v3.0.1 should not have placeholder build commands.",
        body_style
    ))
    story.append(Paragraph("<b>Fix:</b>", body_style))
    story.append(Paragraph("&bull; Implement the actual build step (e.g., Next.js build, static site generation, or monorepo projection)", bullet_style))
    story.append(Paragraph("&bull; If not ready, change message to reference a specific roadmap item with an ETA", bullet_style))
    story.append(Spacer(1, 8))

    # Issue 7
    story.append(Paragraph("P0-7: Version Mismatch Between README and CI", h2_style))
    story.append(Paragraph(
        "The README badge says v3.0.1. The CI workflow validation step references 'Heady v3.1.0'. "
        "The package.json says version 3.0.1. These must be synchronized.",
        body_style
    ))
    story.append(Paragraph("<b>Fix:</b> Decide the current version and update all three locations. Add a version-check step to CI.", body_style))
    story.append(Spacer(1, 8))

    # Issue 8
    story.append(Paragraph("P0-8: Legal Entity Inconsistency", h2_style))
    story.append(Paragraph(
        "The core repos' READMEs and footers say '2026 Heady Systems LLC' but the actual entities "
        "are HeadySystems Inc. (C-Corp) and HeadyConnection Inc. (nonprofit). Using 'LLC' is legally "
        "incorrect and could cause problems with investors, grants, or IP filings.",
        body_style
    ))
    story.append(Paragraph("<b>Fix:</b> Replace every occurrence of 'Heady Systems LLC' with 'HeadySystems Inc.' across all repos.", body_style))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════
    # SECTION 4: HIGH-PRIORITY ISSUES (P1)
    # ══════════════════════════════════════════════════════
    story.append(Paragraph("4. High-Priority Issues (P1)", h1_style))
    story.append(Paragraph("Significant gaps that degrade project quality and developer experience.", severity_high))
    story.append(Spacer(1, 8))

    p1_issues = [
        ("P1-1: All Core Repo Tests Are Placeholders",
         "Every '-core' repo has \"test\": \"echo 'Tests coming soon' && exit 0\". This means CI "
         "always passes regardless of code state.",
         "Add at least one real test per repo: a health endpoint test, a smoke test, or an import test. "
         "Use Jest (already in monorepo) or Vitest."),

        ("P1-2: Core Repos Missing .env.example",
         "None of the core repos include a .env.example file. Developers cloning these repos have "
         "no idea what environment variables are needed.",
         "Add .env.example to each core repo with documented variables (PORT, NODE_ENV, DATABASE_URL, etc.)"),

        ("P1-3: Core Repos Missing .gitignore",
         "The core repos don't appear to have .gitignore files, risking accidental commits of "
         "node_modules, .env files, or build artifacts.",
         "Add a standard Node.js .gitignore to every repo."),

        ("P1-4: headyconnection-core README Has Broken Quick Start",
         "The Quick Start section shows 'cd && npm start' — missing the directory name. "
         "headysystems-core is even worse: just 'cd' with no command after it.",
         "Fix all Quick Start sections to include the correct clone URL and directory name."),

        ("P1-5: No CONTRIBUTING.md in Any Repo",
         "For an open-source-friendly project, there are no contribution guidelines anywhere.",
         "Add a CONTRIBUTING.md to the monorepo and link to it from core repos."),

        ("P1-6: deploy.yml Has Excessive continue-on-error",
         "Nearly every step in the deploy workflow uses 'continue-on-error: true'. This means "
         "failures are silently swallowed — the pipeline literally cannot fail. This defeats the "
         "purpose of CI/CD.",
         "Remove continue-on-error from critical steps (validation, tests, core deployment). "
         "Keep it only for optional/experimental deployments (HF Spaces, edge proxy)."),

        ("P1-7: Missing LICENSE Files or Wrong License",
         "The monorepo package.json says 'UNLICENSED' but core repos have LICENSE files. "
         "These need to be consistent and intentional.",
         "Decide on licensing strategy: proprietary (UNLICENSED + no LICENSE file) or open source "
         "(pick a license and apply consistently)."),

        ("P1-8: No Branch Protection on Main",
         "There's no evidence of branch protection rules. The deploy workflow triggers on push to "
         "main/master, meaning untested code can be deployed directly.",
         "Enable branch protection: require PR reviews, require CI to pass, prevent direct pushes to main."),

        ("P1-9: heady-docs References 18 Repos but Only 13 Exist",
         "The heady-docs README says '18 repos' in its badge and mentions 'Battle Arena: 9 competitive "
         "rebuild repos' that don't exist in HeadyMe.",
         "Update heady-docs to accurately reflect the current 13 repos. Remove references to "
         "non-existent battle arena repos or create them."),

        ("P1-10: Monorepo Uses npm But README Says pnpm",
         "The README Quick Start says 'pnpm install' and 'This project uses pnpm exclusively.' "
         "But package.json scripts reference 'npm run' and the CI workflow uses 'npm install'.",
         "Pick one package manager and enforce it everywhere. Add an .npmrc or use 'only-allow' script."),

        ("P1-11: Smoke Tests Use Hardcoded Cloud Run URLs",
         "The deploy workflow hardcodes 'heady-manager-609590223909.us-central1.run.app' in multiple "
         "places. If the Cloud Run service URL changes, all tests break silently.",
         "Extract URLs into workflow environment variables. Better yet, use the Cloud Run deploy "
         "output to dynamically capture the service URL."),

        ("P1-12: headyconnection.org Site Looks Unfinished",
         "The live site shows 'The Human Network' with a raw 'Paste your key' field and minimal "
         "content. For a nonprofit, this is the public-facing page and needs polish.",
         "Redesign or at minimum add proper navigation, branding, mission statement, and program info."),
    ]

    for title, desc, fix in p1_issues:
        story.append(Paragraph(title, h3_style))
        story.append(Paragraph(desc, body_style))
        story.append(Paragraph(f"<b>Fix:</b> {fix}", body_style))
        story.append(Spacer(1, 4))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════
    # SECTION 5: MEDIUM-PRIORITY (P2)
    # ══════════════════════════════════════════════════════
    story.append(Paragraph("5. Medium-Priority Improvements (P2)", h1_style))
    story.append(Spacer(1, 6))

    p2_issues = [
        ("P2-1: No Monorepo Workspace Configuration",
         "Despite having a packages/ directory and multiple service targets, there's no pnpm-workspace.yaml "
         "or npm workspaces configuration.",
         "Add workspace configuration to enable proper monorepo dependency management."),

        ("P2-2: No Docker Compose for Local Development",
         "Each core repo has a Dockerfile but there's no docker-compose.yml to spin up the full "
         "ecosystem locally.",
         "Add docker-compose.yml to the monorepo that orchestrates all services together."),

        ("P2-3: README Badges Link to Workflows That May Not Exist",
         "The monorepo README has badges for heady-consolidated-ci.yml, security-scan.yml, "
         "sbom-container-scan.yml, and branding-enforcement.yml. But only deploy.yml was found in "
         ".github/workflows/.",
         "Either add the missing workflow files or remove the badges."),

        ("P2-4: No Dependabot or Renovate Configuration",
         "No automated dependency update tool is configured. Express 4.21.0 is the only dependency "
         "in core repos — it should be kept current automatically.",
         "Add .github/dependabot.yml or renovate.json to enable auto-updates."),

        ("P2-5: Missing Security Policy (SECURITY.md)",
         "No security reporting policy exists in any repo.",
         "Add SECURITY.md with vulnerability reporting instructions."),

        ("P2-6: heady-docs Site Deployment Not Configured",
         "The docs README mentions deploying as a static site via GitHub Pages but no Pages "
         "configuration is set up.",
         "Enable GitHub Pages on heady-docs or configure a separate docs site deployment."),

        ("P2-7: Core Repos All Use Port 3000 Default",
         "Every core repo defaults to PORT 3000. If you run multiple services locally, they'll conflict.",
         "Assign unique default ports per service (e.g., HeadyMe: 3001, HeadyMCP: 3002, etc.)"),

        ("P2-8: No Prettier/ESLint Config in Core Repos",
         "The monorepo has an ESLint script but core repos have no linting configuration.",
         "Add shared ESLint + Prettier configs, ideally as a shared package from the monorepo."),

        ("P2-9: Monorepo Has _archive/ Directory",
         "There's an _archive/ folder in the monorepo containing legacy code. This should either "
         "be cleaned up or moved to a separate branch.",
         "Review _archive/ contents, migrate anything useful, then remove or gitignore it."),

        ("P2-10: No Changelog (CHANGELOG.md)",
         "No changelog exists in any repo. For a project at v3.0.1, there should be release notes.",
         "Add CHANGELOG.md following Keep a Changelog format. Consider using conventional commits."),

        ("P2-11: Missing npm Package Scope Verification",
         "Core repos use @heady/ npm scope but it's unclear if this scope is reserved on npm.",
         "Verify and reserve the @heady npm scope, or change to @headyme or @headysystems."),

        ("P2-12: headyconnection-core Links to HeadyConnection.org Deploy",
         "The README has a 'Deploy on Cloud Run' link pointing to headyconnection.org, but the "
         "repo itself is just a scaffold.",
         "Either make the deployment link accurate or remove it until the service is real."),

        ("P2-13: No GitHub Org Profile READMEs",
         "The HeadyMe org has no .github/profile/README.md for the organization overview page.",
         "Add an org-level README with project description, architecture diagram, and links."),

        ("P2-14: Monorepo sync Script Is Deprecated",
         "The 'sync' script says 'migrated to Linux — use npm run system:sync' but system:sync "
         "doesn't exist in package.json.",
         "Either add system:sync or remove the sync script entirely."),

        ("P2-15: No Typings or JSDoc in Core Code",
         "The monorepo JavaScript files lack JSDoc annotations or TypeScript declarations, "
         "making IDE support and contributor onboarding harder.",
         "Add JSDoc annotations to exported functions, or consider migrating to TypeScript."),
    ]

    for title, desc, fix in p2_issues:
        story.append(Paragraph(title, h3_style))
        story.append(Paragraph(desc, body_style))
        story.append(Paragraph(f"<b>Fix:</b> {fix}", body_style))
        story.append(Spacer(1, 3))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════
    # SECTION 6: CROSS-REPO CONSISTENCY
    # ══════════════════════════════════════════════════════
    story.append(Paragraph("6. Cross-Repo Consistency Fixes", h1_style))
    story.append(Paragraph(
        "These fixes should be applied uniformly across all 13 HeadyMe repos.",
        body_style
    ))
    story.append(Spacer(1, 8))

    consistency_data = [
        [Paragraph("<b>Item</b>", label_style), Paragraph("<b>Current State</b>", label_style), Paragraph("<b>Target State</b>", label_style)],
        [Paragraph("Legal entity name", body_style), Paragraph("'Heady Systems LLC' (wrong)", body_style), Paragraph("'HeadySystems Inc.' everywhere", body_style)],
        [Paragraph("Copyright year", body_style), Paragraph("2026 (correct)", body_style), Paragraph("Keep 2026, add range if older commits exist", body_style)],
        [Paragraph("Author email", body_style), Paragraph("e@headyconnection.org", body_style), Paragraph("eric@headyconnection.org", body_style)],
        [Paragraph("GitHub org refs", body_style), Paragraph("Mix of HeadySystems and HeadyMe", body_style), Paragraph("All HeadyMe (canonical org)", body_style)],
        [Paragraph("Package manager", body_style), Paragraph("Mixed npm/pnpm references", body_style), Paragraph("Pick one, enforce consistently", body_style)],
        [Paragraph("Node.js version", body_style), Paragraph("CI uses 22, Dockerfile uses 20", body_style), Paragraph("Align to Node 22 LTS everywhere", body_style)],
        [Paragraph("Default port", body_style), Paragraph("All repos: 3000", body_style), Paragraph("Unique port per service", body_style)],
        [Paragraph("Test command", body_style), Paragraph("echo placeholder", body_style), Paragraph("Real test with Jest/Vitest", body_style)],
        [Paragraph(".gitignore", body_style), Paragraph("Missing in core repos", body_style), Paragraph("Standard Node.js .gitignore", body_style)],
        [Paragraph(".env.example", body_style), Paragraph("Missing everywhere", body_style), Paragraph("Documented env vars per service", body_style)],
    ]

    cons_table = Table(consistency_data, colWidths=[1.5*inch, 2.5*inch, 3.0*inch])
    cons_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DEEP_TEAL),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('BACKGROUND', (0, 1), (-1, -1), OFF_WHITE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [OFF_WHITE, PAPER_WHITE]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, WARM_BEIGE),
    ]))
    story.append(cons_table)
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════
    # SECTION 7: CI/CD
    # ══════════════════════════════════════════════════════
    story.append(Paragraph("7. CI/CD &amp; Deployment Improvements", h1_style))
    story.append(Spacer(1, 6))

    story.append(Paragraph("Current Deploy Pipeline (deploy.yml) — Issues", h2_style))
    story.append(Paragraph("&bull; <b>Auto-success anti-pattern:</b> The final 'verify-projections' job always exits 0 and has 'if: always()'. This means the pipeline badge is always green regardless of failures. Remove the forced exit 0 on critical paths.", bullet_style))
    story.append(Paragraph("&bull; <b>Silent failures everywhere:</b> 13 out of 17 steps use continue-on-error: true. Failures are invisible.", bullet_style))
    story.append(Paragraph("&bull; <b>No artifact caching:</b> npm install runs in every job without caching. Add actions/cache for node_modules.", bullet_style))
    story.append(Paragraph("&bull; <b>Test suite always passes:</b> 'npx jest --passWithNoTests' combined with continue-on-error means tests literally cannot block deployment.", bullet_style))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Recommended Pipeline Architecture", h2_style))
    story.append(Paragraph(
        "<font face='Courier' size='8'>"
        "Phase 0: Security Scan (keep continue-on-error)<br/>"
        "Phase 1: Validate + Test (REMOVE continue-on-error, FAIL if tests fail)<br/>"
        "Phase 2: Build (add actual build step)<br/>"
        "Phase 3: Deploy to Staging (new — deploy to staging env first)<br/>"
        "Phase 4: Smoke Test Staging (FAIL if health check fails)<br/>"
        "Phase 5: Deploy to Production (only if staging passes)<br/>"
        "Phase 6: Smoke Test Production<br/>"
        "Phase 7: Notify (Slack/Discord notification on success or failure)"
        "</font>",
        body_style
    ))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Missing Workflows to Add", h2_style))
    story.append(Paragraph("&bull; <b>heady-consolidated-ci.yml</b> — Referenced in README badge but doesn't exist", bullet_style))
    story.append(Paragraph("&bull; <b>security-scan.yml</b> — Referenced in README badge but doesn't exist", bullet_style))
    story.append(Paragraph("&bull; <b>sbom-container-scan.yml</b> — Referenced in README badge but doesn't exist", bullet_style))
    story.append(Paragraph("&bull; <b>branding-enforcement.yml</b> — Referenced in README badge but doesn't exist as a standalone workflow", bullet_style))
    story.append(Paragraph("&bull; <b>dependabot.yml</b> — Needed for automated dependency updates", bullet_style))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════
    # SECTION 8: README OVERHAUL
    # ══════════════════════════════════════════════════════
    story.append(Paragraph("8. README &amp; Documentation Overhaul", h1_style))
    story.append(Spacer(1, 6))

    story.append(Paragraph("Monorepo README (Heady-pre-production-9f2f0642)", h2_style))
    story.append(Paragraph("The monorepo README is well-structured with a solid table of contents, architecture diagram, and quick start. Key fixes needed:", body_style))
    story.append(Paragraph("&bull; Fix pnpm vs npm inconsistency (Quick Start says pnpm, CI uses npm)", bullet_style))
    story.append(Paragraph("&bull; Sync version references (v3.0.1 vs v3.1.0)", bullet_style))
    story.append(Paragraph("&bull; Add a 'Project Status' section with current deployment state", bullet_style))
    story.append(Paragraph("&bull; Add links to all 9 core repos with their status", bullet_style))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Core Repo READMEs (All 9 repos)", h2_style))
    story.append(Paragraph("Each core repo README needs a standard template with:", body_style))
    story.append(Paragraph("&bull; Correct legal entity (HeadySystems Inc., not Heady Systems LLC)", bullet_style))
    story.append(Paragraph("&bull; Working Quick Start with correct directory name", bullet_style))
    story.append(Paragraph("&bull; Link back to monorepo (already present)", bullet_style))
    story.append(Paragraph("&bull; Service-specific API documentation (currently missing)", bullet_style))
    story.append(Paragraph("&bull; Environment variable documentation", bullet_style))
    story.append(Paragraph("&bull; Deployment instructions specific to that service", bullet_style))
    story.append(Spacer(1, 8))

    story.append(Paragraph("heady-docs Repo", h2_style))
    story.append(Paragraph("&bull; Update repo count from 18 to 13 (or actual count)", bullet_style))
    story.append(Paragraph("&bull; Remove references to non-existent battle arena repos", bullet_style))
    story.append(Paragraph("&bull; Deploy the /site directory as a static documentation site", bullet_style))
    story.append(Paragraph("&bull; Add an architecture diagram (can be generated from the monorepo's existing docs)", bullet_style))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════
    # SECTION 9: PACKAGE.JSON
    # ══════════════════════════════════════════════════════
    story.append(Paragraph("9. package.json Corrections", h1_style))
    story.append(Spacer(1, 6))

    story.append(Paragraph("Monorepo package.json", h2_style))
    pj_fixes = [
        ("repository.url", "https://github.com/HeadySystems/Heady.git", "https://github.com/HeadyMe/Heady-pre-production-9f2f0642.git"),
        ("bugs.url", "https://github.com/HeadySystems/Heady/issues", "https://github.com/HeadyMe/Heady-pre-production-9f2f0642/issues"),
        ("author.email", "e@headyconnection.org", "eric@headyconnection.org"),
        ("scripts.build", "echo placeholder", "Actual build command"),
        ("scripts.build-all", "echo placeholder", "Actual build or remove"),
        ("scripts.sync", "echo 'migrated to Linux'", "Implement system:sync or remove"),
    ]

    pj_data = [
        [Paragraph("<b>Field</b>", label_style), Paragraph("<b>Current</b>", label_style), Paragraph("<b>Correct</b>", label_style)],
    ]
    for field, current, correct in pj_fixes:
        pj_data.append([
            Paragraph(field, body_style),
            Paragraph(f"<font face='Courier' size='7'>{current}</font>", body_style),
            Paragraph(f"<font face='Courier' size='7'>{correct}</font>", body_style),
        ])

    pj_table = Table(pj_data, colWidths=[1.5*inch, 2.75*inch, 2.75*inch])
    pj_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DEEP_TEAL),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('BACKGROUND', (0, 1), (-1, -1), OFF_WHITE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [OFF_WHITE, PAPER_WHITE]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, WARM_BEIGE),
    ]))
    story.append(pj_table)
    story.append(Spacer(1, 12))

    story.append(Paragraph("Core Repo package.json (All 9)", h2_style))
    story.append(Paragraph("&bull; Update Dockerfile FROM node:20-slim to FROM node:22-slim (match CI)", bullet_style))
    story.append(Paragraph("&bull; Add real test scripts (not echo placeholders)", bullet_style))
    story.append(Paragraph("&bull; Add 'lint' and 'format' scripts", bullet_style))
    story.append(Paragraph("&bull; Add 'engines' field: { \"node\": \">=22\" }", bullet_style))
    story.append(Paragraph("&bull; Add 'repository' field pointing to correct HeadyMe URL", bullet_style))
    story.append(Paragraph("&bull; Consider adding a 'private': true if not publishing to npm", bullet_style))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════
    # SECTION 10: IMPLEMENTATION ROADMAP
    # ══════════════════════════════════════════════════════
    story.append(Paragraph("10. Prioritized Implementation Roadmap", h1_style))
    story.append(Spacer(1, 6))

    story.append(Paragraph("Week 1: Foundation Fixes (P0)", h2_style))
    week1 = [
        "Fix package.json in monorepo (repository URL, author email, version sync)",
        "Fix legal entity name across all repos (LLC to Inc.)",
        "Populate headymcp-production with actual deployment code",
        "Add CI/CD workflow to headysystems-production",
        "Remove hardcoded Cloud Run URLs from _redirects and deploy.yml",
        "Fix README version mismatch (v3.0.1 vs v3.1.0)",
        "Resolve pnpm vs npm inconsistency",
    ]
    for item in week1:
        story.append(Paragraph(f"&bull; {item}", bullet_style))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Week 2: Core Repo Uplift (P0 + P1)", h2_style))
    week2 = [
        "Decide on core repo strategy (projection build vs meaningful stubs vs archive)",
        "Add real functionality to whichever repos survive the strategy decision",
        "Add real tests to all repos (minimum: health check test)",
        "Add .gitignore, .env.example, .npmrc to all repos",
        "Fix all broken Quick Start sections in READMEs",
        "Fix deploy.yml continue-on-error anti-pattern",
        "Add npm cache to CI workflow",
    ]
    for item in week2:
        story.append(Paragraph(f"&bull; {item}", bullet_style))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Week 3: Documentation &amp; Consistency (P1 + P2)", h2_style))
    week3 = [
        "Update heady-docs repo count and remove phantom repos",
        "Add CONTRIBUTING.md, SECURITY.md, CHANGELOG.md",
        "Create HeadyMe org-level profile README",
        "Enable branch protection on main for all repos",
        "Add dependabot.yml for automated dependency updates",
        "Deploy heady-docs as a static documentation site",
        "Add missing GitHub Actions workflow files (or remove badges)",
    ]
    for item in week3:
        story.append(Paragraph(f"&bull; {item}", bullet_style))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Week 4: Polish &amp; Optimization (P2)", h2_style))
    week4 = [
        "Add monorepo workspace configuration (pnpm-workspace.yaml or npm workspaces)",
        "Add docker-compose.yml for local full-stack development",
        "Assign unique default ports per service",
        "Add shared ESLint/Prettier configuration",
        "Clean up _archive/ directory in monorepo",
        "Add JSDoc annotations to exported functions",
        "Verify and reserve @heady npm scope",
        "Redesign headyconnection.org landing page",
    ]
    for item in week4:
        story.append(Paragraph(f"&bull; {item}", bullet_style))
    story.append(Spacer(1, 12))

    # ── CLOSING ──
    story.append(HRFlowable(width="100%", thickness=1, color=MUTED_TEAL))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "This plan covers 35 specific improvements across the entire HeadyMe ecosystem. "
        "The most impactful immediate action is resolving the hollow core repos (P0-3) — "
        "either by implementing the monorepo projection build, adding real service code, "
        "or archiving them. Everything else builds on that decision.",
        body_style
    ))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Source: Deep scan of github.com/HeadyMe, github.com/HeadySystems, "
        "github.com/HeadyConnection, plus live site checks of headysystems.com, headyme.com, "
        "headymcp.com, and headyconnection.org — performed March 6, 2026.",
        ParagraphStyle("Source", parent=body_style, fontSize=8, textColor=MUTED_TEAL)
    ))

    doc.build(story)
    print(f"PDF generated: {OUTPUT}")

if __name__ == "__main__":
    build_pdf()
