# Heady CLI Usage

## Setup
```bash
export HEADY_API_KEY="your_api_key"
export HEADY_BASE_URL="https://api.heady.ai"  # optional
```

## API Key Requirements

A valid API key must be set in:
- Environment variable `HEADY_API_KEY`
- Or via `.env` file in project root

```bash
# .env example
HEADY_API_KEY="your_api_key_here"
HEADY_BASE_URL="https://api.heady.ai"
```

## Running
```bash
python scripts/heady_cli.py
```

## Output
- Shows connection status
- Displays user profile

## Error Handling
- Validates API key exists
- Handles connection errors
