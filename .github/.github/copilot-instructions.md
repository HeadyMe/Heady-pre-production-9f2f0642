<!-- HEADY_BRAND:BEGIN -->
<!-- ╔══════════════════════════════════════════════════════════════════╗ -->
<!-- ║  █╗  █╗███████╗ █████╗ ██████╗ █╗   █╗                     ║ -->
<!-- ║  █║  █║█╔════╝█╔══█╗█╔══█╗╚█╗ █╔╝                     ║ -->
<!-- ║  ███████║█████╗  ███████║█║  █║ ╚████╔╝                      ║ -->
<!-- ║  █╔══█║█╔══╝  █╔══█║█║  █║  ╚█╔╝                       ║ -->
<!-- ║  █║  █║███████╗█║  █║██████╔╝   █║                        ║ -->
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║ -->
<!-- ║                                                                  ║ -->
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║ -->
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║ -->
<!-- ║  FILE: .github/copilot-instructions.md                            ║ -->
<!-- ║  LAYER: root                                                      ║ -->
<!-- ╚══════════════════════════════════════════════════════════════════╝ -->
<!-- HEADY_BRAND:END -->

# HeadySystems Copilot Instructions

## Project Overview

This is a **Hybrid Node.js/Python** system designed for the HeadyConnection ecosystem with patented Sacred Geometry architecture.

- **Manager Layer:** Node.js with MCP Protocol (`heady-manager.js`)
- **Worker Layer:** Python data processing (`src/process_data.py`)
- **Frontend:** Single-file React application with Sacred Geometry aesthetics
- **Admin UI:** Web-based management interface (`/admin`) with integrated code editor and GPU settings
- **Deployment:** Render.com Blueprint with managed Postgres

## Architecture

| Component | Technology | Purpose |
|-----------|------------|---------|
| `heady-manager.js` | Node.js/Express | MCP server, API endpoints, static file serving |
| `src/process_data.py` | Python | Background data processing worker |
| `src/consolidated_builder.py` | Python | Build orchestration with multi-agent coordination |
| `admin_console.py` | Python | System audit and health checks |
| `public/index.html` | React (CDN) | Sacred Geometry UI dashboard |
| `public/admin.html` | React + Monaco | Admin UI with IDE editor and AI assistant |
| `render.yaml` | Render Blueprint | Infrastructure-as-code deployment |
| `mcp_config.json` | MCP Config | Server definitions for Copilot integration |

## Build, Test & Run Instructions

### Local Development
```bash
# Install dependencies
npm install
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your secrets

# Start the manager
npm start  # or node heady-manager.js

# Access interfaces
# Main UI: https://app.headysystems.com:3300
# Admin UI: https://app.headysystems.com:3300/admin
```

### Testing
```bash
# Run Python syntax checks
python -m compileall src

# Run Python tests
python -m pytest tests/

# Run Node.js tests (when implemented)
npm test
```

### Environment Variables
- `PORT` - Server port (default: 3300)
- `NODE_ENV` - Environment (development/production)
- `HEADY_API_KEY` - API authentication key
- `DATABASE_URL` - Postgres connection string
- `HF_TOKEN` - Hugging Face API token
- `HEADY_ADMIN_ROOT` - Admin UI file system root
- `HEADY_ADMIN_ALLOWED_PATHS` - Comma-separated allowed paths
- `REMOTE_GPU_HOST` - Remote GPU server (optional)
- `REMOTE_GPU_PORT` - Remote GPU port (optional)
- `GPU_MEMORY_LIMIT` - GPU memory limit in MB
- `ENABLE_GPUDIRECT` - Enable GPUDirect RDMA (true/false)

Managed via Render's `heady-shared-secrets` env group:
- `DATABASE_URL` - Postgres connection string
- `HEADY_API_KEY` - Auto-generated API key
- `HF_TOKEN` - Hugging Face token
- `COPILOT_MCP_CLOUDFLARE_API_TOKEN` - Cloudflare API for MCP
- `COPILOT_MCP_CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serves Sacred Geometry UI |
| `/admin` | GET | Serves Admin IDE |
| `/api/pulse` | GET | System status and Docker info |
| `/api/health` | GET | Simple health check |
| `/api/admin/config/render-yaml` | GET | Get render.yaml configuration |
| `/api/admin/config/mcp` | GET | Get MCP configuration |
| `/api/admin/settings/gpu` | GET | Get GPU settings |
| `/api/admin/gpu/infer` | POST | GPU inference endpoint |
| `/api/admin/assistant` | POST | AI assistant for code editing |
| `/api/admin/lint` | POST | Code linting |
| `/api/admin/test` | POST | Run tests |
| `/api/admin/roots` | GET | Available admin roots |
| `/api/admin/files` | GET | File browser |
| `/api/admin/file` | GET/POST | File read/write |
| `/api/admin/ops` | GET | List operations |
| `/api/admin/ops/:id/status` | GET | Operation status |
| `/api/admin/ops/:id/stream` | GET | SSE log streaming |
| `/api/admin/build` | POST | Run build script |
| `/api/admin/audit` | POST | Run audit script |
| `/api/hf/*` | VAR | Hugging Face inference (protected by HEADY_API_KEY) |

## Documentation Protocol

**CRITICAL:** All documentation MUST be generated using the **Quiz & Flashcard Methodology**.

### The Quiz Protocol

When asked to document code or generate summaries, follow this exact procedure:

1. **Review & Extract**
   - Read the material thoroughly
   - Identify key concepts, processes, and data structures

2. **Generate Quiz Questions**
   - Create clear questions for each concept
   - Use open-ended questions for insights and understanding
   - Use boolean/multiple-choice for factual recall

3. **Formulate Flashcards**
   - Convert Question-Answer pairs into flashcards
   - ONE idea per card
   - Keep answers concise but complete

4. **Iterative Coverage**
   - Repeat until all material is processed
   - Avoid redundancy across cards

5. **Integrate & Organize**
   - Group cards under logical headings (Architecture, APIs, Data Flow)
   - Maintain consistent formatting

6. **Ensure Precision**
   - Verify technical accuracy
   - Cross-reference with source code

## Code Style Guidelines

- **Node.js:** ES6+, async/await, Express middleware patterns
- **Python:** PEP 8, type hints encouraged, descriptive variable names
- **React:** Functional components, hooks, inline styles for single-file apps
- **Comments:** Minimal but meaningful; code should be self-documenting

## MCP Integration

This project includes MCP server configurations for GitHub Copilot:
- `mcp_config.json` - Local development MCP servers
- `.github/copilot-mcp-config.json` - Copilot workspace configuration

### MCP Servers Available
- **filesystem** - File system operations
- **sequential-thinking** - Reasoning chains
- **memory** - Persistent memory storage
- **fetch** - Web requests
- **postgres** - Database operations (uses `${DATABASE_URL}`)
- **git** - Git operations
- **puppeteer** - Web automation
- **cloudflare** - Cloudflare API (uses `${COPILOT_MCP_CLOUDFLARE_*}`)

## Security Notes

- All admin endpoints require `HEADY_API_KEY` authentication
- Secrets are managed via environment variables, never hardcoded
- Rate limiting enabled on API endpoints
- CORS configured for allowed origins
- GPU settings support remote connections with fallback behavior

## Copilot Customization Documentation

For more information about Copilot customization, see:
- Official Copilot agent documentation: https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/use-copilot-agents/coding-agent/extend-coding-agent-with-mcp
- `.github/copilot-instructions.md` (this file)
- `.github/copilot-mcp-config.json` (MCP server definitions)
- `.github/workflows/copilot-setup-steps.yml` (Setup workflow)
# Squash all commits since branching from main
git reset $(git merge-base main $(git rev-parse --abbrev-ref HEAD)) --soft

# Stage all changes
git add .

# Commit with a descriptive message
git commit -m "feat: consolidated HeadySystems architecture with MCP integration"

# Push to remote (force with lease for safety on feature branches)
git push --force-with-lease

# Or if on main, just push normally
git push origin main





