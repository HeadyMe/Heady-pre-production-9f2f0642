
# Arena Mode IDE Fusion Roadmap — ASAP / Resource-Optimized

## Revised Section 34: ASAP IDE Fusion Roadmap

> **Philosophy:** No artificial phases or padding. Every task starts as soon as its
> dependency is met. Parallelize everything. Use what's already built. Ship daily.

---

### Already Done (Leverage These Now)

These exist in the Heady ecosystem RIGHT NOW and should be treated as live resources,
not future work:

| Asset | Status | Location |
|-------|--------|----------|
| heady-manager API (port 3300) | Active | heady-manager.js |
| Buddy backend (port 3301) | Active | configs/heady-buddy.yaml |
| MCP tool servers (GitHub, filesystem, terminal, browser, Docker) | Active | distribution/mcp/servers/ |
| VS Code extension skeleton (chat, completions, commands) | Scaffolded | distribution/ide/vscode/ |
| JetBrains plugin target | Scaffolded | distribution/ide/jetbrains/ |
| Neovim, Vim, Sublime, Emacs extensions | Scaffolded | distribution/ide/* |
| HeadyIDE Docker config (Theia, port 3400) | Defined | docker-compose.ide.yml |
| Agent catalog (coding, researcher, grant-writer, BD, ethics, wealth-redistribution) | Defined | packages/agents/catalog.yaml |
| Model Router (local vs cloud per workspace) | Defined | services/model-router/ |
| PyCharm AI prompt kit | Ready | docs/pycharm-ai-prompts.md |
| PyCharm effective usage guide | Ready | docs/pycharm-effective-usage-guide.md |
| HCFullPipeline v3.1.0 (9 stages) | Active | configs/hcfullpipeline.yaml |
| Clean-build CI/CD pipeline | Active | .github/workflows/clean-build.yml |
| Error recovery protocol | Active | .windsurf/workflows/hcfp-error-recovery.md |
| StoryDriver narratives | Active | configs/story-driver.yaml |
| All 20 AI nodes registered | Active | heady-registry.json |
| Imagination Engine | Active | src/hc-imagination.js |

---

### Stream 1: Wire VS Code Extension to Live Backend (TODAY)

**Dependency:** heady-manager running on 3300. Already done.

| # | Task | Effort |
|---|------|--------|
| 1 | Open `distribution/ide/vscode/`, run `npm install`, `npm run compile` | 5 min |
| 2 | Set `heady.apiEndpoint` to `http://manager.dev.local.heady.internal:3300` | 1 min |
| 3 | Wire `completionProvider.ts` to call `/api/chat` with coding-agent role | 30 min |
| 4 | Wire `chatProvider.ts` to call Buddy `/buddy/chat` endpoint | 30 min |
| 5 | Wire `explain.ts`, `refactor.ts`, `writeTests.ts` to named agents | 45 min |
| 6 | Test: open a file, trigger each command, verify Heady responds | 15 min |
| 7 | Package `.vsix`, install in VS Code AND Windsurf (they share format) | 10 min |

**Ships:** Same day. ~2.5 hours of focused work.

---

### Stream 2: Configure PyCharm as Heady Shell (TODAY, parallel with Stream 1)

**Dependency:** Heady project on disk. Already done.

| # | Task | Effort |
|---|------|--------|
| 1 | Open Heady project in PyCharm, trust it | 2 min |
| 2 | Attach Heady Python interpreter (venv / "Heady Exclusive" kernel) | 5 min |
| 3 | Apply run configs: HeadyManager (3300), Frontend (3001), Python worker | 10 min |
| 4 | Apply code style: 4-space indent, 120-char width, auto-imports | 5 min |
| 5 | Load curated Heady prompts into PyCharm AI Assistant custom instructions | 10 min |
| 6 | Disable JetBrains AI chat (or point it at Heady endpoint if supported) | 5 min |
| 7 | Test: run HeadyManager from PyCharm, debug a Python worker, use AI prompt | 15 min |

**Ships:** Same day. ~1 hour. Runs parallel with Stream 1.

---

### Stream 3: Disable Competing AI Brains (TODAY, 15 min)

Do this in every IDE you touch:

| IDE | Action |
|-----|--------|
| Windsurf | Settings → disable Cascade / built-in copilot, or point "custom model" at `localhost:3300/api/chat` |
| Cursor | Settings → disable Cursor AI, or configure custom API endpoint to Heady |
| VS Code | Disable GitHub Copilot extension (or don't install it) |
| PyCharm | Load Heady prompts as system instruction; disable JetBrains AI Pro if active |

**Result:** HeadyAutoIDE is the only brain. All IDEs become transport.

---

### Stream 4: JetBrains Plugin MVP (NEXT session, ~3 hours)

**Dependency:** Stream 2 complete (PyCharm working with Heady).

| # | Task | Effort |
|---|------|--------|
| 1 | Open `distribution/ide/jetbrains/` scaffold | 5 min |
| 2 | Implement Tool Window: WebView pointing at Buddy chat (port 3301) | 45 min |
| 3 | Implement Action: "Ask Heady about selection" → POST to `/api/chat` | 30 min |
| 4 | Implement Action: "Refactor with Heady" → POST to coding-agent | 30 min |
| 5 | Implement Background Inspection: send file context to coding-agent for suggestions | 45 min |
| 6 | Bind hotkeys matching VS Code extension (Ctrl+Shift+H, E, R, T, D) | 15 min |
| 7 | Test in PyCharm, package `.zip` plugin | 15 min |

**Ships:** Next session. ~3 hours.

---

### Stream 5: Browser IDE (HeadyIDE) Live (NEXT session, parallel with Stream 4)

**Dependency:** Docker installed. heady-manager running.

| # | Task | Effort |
|---|------|--------|
| 1 | `docker-compose -f docker-compose.ide.yml up --build` | 5 min |
| 2 | Verify Theia/code-server on `localhost:3400` with `HEADY_ENDPOINT` env set | 5 min |
| 3 | Open from phone: `http://<COMPUTER_IP>:3400` or via SSH tunnel | 5 min |
| 4 | Install the VS Code `.vsix` extension inside code-server | 5 min |
| 5 | Test: same Heady chat + completions work in browser IDE | 10 min |

**Ships:** Next session. ~30 minutes.

---

### Stream 6: Heady Customizations Baked In (rolls out WITH each stream above)

Don't treat these as separate phases — embed them as you build each extension:

| Customization | Embed Where | How |
|--------------|-------------|-----|
| **Impact meter** | Chat sidebar in every extension | Small footer showing session impact score, pulls from `/api/impact` |
| **Wealth-redistribution command** | Command palette in every extension | "Optimize donations" → calls `wealth-redistribution` agent |
| **Ethics gate** | Pre-commit hook + extension warning | Run code through `ethics-checker` agent before finalizing |
| **Workspace detection** | Extension settings auto-detect | If repo = HeadyConnection → nonprofit defaults (local models, PPP); if HeadySystems → pro defaults |
| **Imagination Engine** | Arena Mode trigger in chat | "Imagine alternatives" → calls `/api/imagination/imagine` with BLEND/EXTEND operators |
| **StoryDriver panel** | Side panel in every extension | "What changed?" → pulls latest Story narrative from `/api/stories` |

---

### Stream 7: MCP Integration for Windsurf (TODAY, 15 min)

**Dependency:** MCP servers already exist in `distribution/mcp/servers/`.

| # | Task | Effort |
|---|------|--------|
| 1 | Copy `distribution/mcp/configs/default-mcp.yaml` to Windsurf's MCP config location | 5 min |
| 2 | Register Heady tool servers (filesystem, terminal, GitHub, Docker) | 5 min |
| 3 | Test: ask Windsurf to use a Heady MCP tool (e.g., "list files in src/") | 5 min |

**Result:** Windsurf's agent workflows now use Heady's MCP tools instead of its own.

---

### Stream 8: Arena Mode First Run (once Streams 1–4 are done)

| # | Task | Effort |
|---|------|--------|
| 1 | Pick a real problem (e.g., "redesign the Heady dashboard") | 5 min |
| 2 | Trigger Arena Mode: generate 2–3 fused designs using the Multi-Base Fusion procedure | 30 min |
| 3 | Score candidates against the 5 Arena criteria | 15 min |
| 4 | Select winner, squash-merge branch, log ARENA_WINNER_CHOSEN via StoryDriver | 15 min |
| 5 | Record rationale and next 3 steps | 10 min |

**Result:** Arena Mode is proven on a real task. Pattern is now repeatable.

---

### Total Timeline (Realistic ASAP)

| When | What Ships |
|------|-----------|
| **Today, session 1** (~4 hours) | VS Code extension live, PyCharm configured, competing AI disabled, Windsurf MCP wired |
| **Today or tomorrow, session 2** (~4 hours) | JetBrains plugin MVP, browser IDE live, impact meter + customizations embedded |
| **Session 3** (~1.5 hours) | Arena Mode first real run, StoryDriver logging, full loop proven |
| **Ongoing** | Every new feature/app goes through Arena Mode automatically |

No weeks. No months. Use what's built. Ship daily. Iterate under the Rebuild Protocol.

---

### Standing Rule (Add to System Prompt)

```
ASAP_RESOURCE_RULE:
- Never pad timelines with artificial phases when dependencies are already met.
- If a scaffold exists, wire it — don't redesign it.
- If a backend is running, call it — don't plan to call it later.
- Parallelize all independent streams.
- Embed social-impact and governance features AS you build, not after.
- Every session must ship something testable.
- "Planned" status in heady-registry.json means "build it next session, not next quarter."
```
