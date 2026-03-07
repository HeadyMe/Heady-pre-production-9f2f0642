# create-heady-agent CLI — Community Scaffolding Tool

> Priority: IMMEDIATE | Goal: Lower barrier for 3rd-party HeadyBee module development
> Pattern: Similar to create-react-app, create-next-app

---

## 1. Usage

```bash
# Install globally
npm install -g create-heady-agent

# Create a new HeadyBee agent
create-heady-agent my-custom-bee

# Interactive mode
create-heady-agent

# With options
create-heady-agent my-bee --template monitor --language typescript
```

---

## 2. Templates

| Template | Description | Use Case |
|----------|-------------|----------|
| `basic` | Minimal HeadyBee with lifecycle hooks | Starting point |
| `monitor` | Health monitoring bee with PHI-scaled intervals | Observability |
| `processor` | Data processing bee with pipeline integration | ETL / transforms |
| `connector` | External service connector with circuit breaker | API integrations |
| `creative` | Content generation bee with LLM routing | AI-powered tasks |
| `security` | Security scanning bee with governance hooks | Compliance |

---

## 3. Generated Project Structure

```
my-custom-bee/
├── package.json
├── README.md
├── LICENSE
├── .gitignore
├── .github/
│   └── workflows/
│       └── ci.yml
├── src/
│   ├── index.js              # Main entry point
│   ├── bee.js                # HeadyBee implementation
│   ├── config.js             # PHI-scaled configuration
│   └── health.js             # Health check endpoint
├── tests/
│   ├── bee.test.js           # Unit tests
│   └── integration.test.js   # Integration tests
├── configs/
│   └── bee-config.yaml       # Bee configuration
└── docs/
    └── README.md             # Documentation
```
