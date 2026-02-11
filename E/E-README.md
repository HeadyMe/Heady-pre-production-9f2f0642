# E DRIVE - Heady Systems Desktop Portal

This folder contains everything you need to work with Heady Systems:

- **HeadyStack/distribution**: Core software distributions
- **HeadyStack/VMs**: Preconfigured virtual machines
- **HeadyStack/gift-packs**: Customizable distribution packages
- **HeadyStack/heady-config**: Configuration files
- **scripts**: Utility scripts

## Quick Connections

- [Web Interface](https://app.headysystems.com)
- [API Documentation](https://api.headysystems.com/docs)
- [Download Center](https://download.headysystems.com)

## Getting Started

1. Review `quick-start.md` for your platform
2. Launch `HeadyManager.bat` to start services
3. Use `Heady Shell.bat` for command-line access
## HeadyCloud Access

### SSH Connection
```bash
# Connect to HeadyCloud servers
ssh -i D:\HeadyCloud\ssh\heady_cloud_key user@cloud.heady.internal
```

### Service Endpoints
- **Manager API**: `https://manager.headyio.com/api`
- **Admin UI**: `https://cloud.heady.internal:3000`
- **IDE Server**: `https://cloud.heady.internal:3400`
- **PostgreSQL**: `cloud.heady.internal:5432`
- **Redis**: `cloud.heady.internal:6379`

### Auto-Sync Services
Run `D:\HeadyCloud\scripts\sync_services.ps1` to sync configurations automatically.

## Available Bundles

| Bundle | Components | Pricing |
|--------|-----------|---------|
| **Personal** | Browser Extension + Mobile Chat | Free / $5/mo |
| **Pro** | Desktop + Voice + Dev Tools | $12/mo |
| **Dev Pack** | Browser + IDE Extensions + Mobile Dev | $12/mo |
| **Creator Pack** | Browser + Voice + Automations | $15/mo |
| **Enterprise** | Full Suite + Admin + SSO + SLA | Custom |

## SDK & Integration

### Python SDK
```python
from heady import MonteCarloClient

client = MonteCarloClient(api_key="your_api_key")

# Create plan with error handling
try:
    plan = client.create_plan(
        task_type="deployment",
        iterations=5000,
        async_mode=True,
        webhook_url="https://hooks.example.com/mc"
    )
    print(f"Plan created: {plan.plan_id}")
except HeadyAPIError as e:
    print(f"Error: {e.code} - {e.message}")
```

### JavaScript/TypeScript SDK
```javascript
import { MonteCarloClient } from '@heady/sdk';

const client = new MonteCarloClient({ apiKey: 'your_api_key' });

// Create plan with promises
const plan = await client.createPlan({
  taskType: 'deployment',
  config: {
    iterations: 5000,
    confidenceLevel: 0.98,
    asyncMode: true
  }
});

// Poll for completion
const result = await client.waitForCompletion(plan.planId, {
  pollingInterval: 2000,
  timeout: 60000
});
```

### cURL Examples
```bash
# Create Monte Carlo plan
curl -X POST https://manager.headyio.com/api/monte-carlo/plan \
  -H "Authorization: Bearer your_api_key" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: unique_key_123" \
  -d '{
    "task_type": "deployment",
    "config": {
      "iterations": 5000,
      "confidence_level": 0.98,
      "parallel": true
    }
  }'

# Get plan status
curl -X GET https://manager.headyio.com/api/monte-carlo/plan/plan_123/status \
  -H "Authorization: Bearer your_api_key"

# Register webhook
curl -X POST https://manager.headyio.com/api/monte-carlo/webhooks \
  -H "Authorization: Bearer your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://hooks.example.com/monte-carlo",
    "events": ["plan.completed", "plan.failed"],
    "secret": "webhook_secret_key"
  }'
```

### API Authentication
Store API keys securely:
- Use environment variables: `HEADY_API_KEY`
- Rotate keys every 90 days
- Separate keys for dev/staging/production
- Enable IP whitelisting for production
- Store keys in secure vaults (AWS Secrets Manager, HashiCorp Vault)
- Never commit API keys to version control
- Monitor API key usage for anomalous patterns

### Webhook Signature Verification
```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}
```

## Development Resources

- **Postman Collection**: https://www.postman.com/heady-api/workspace/monte-carlo
- **OpenAPI Spec**: https://manager.headyio.com/api/openapi.json
- **Swagger UI**: https://manager.headyio.com/api/docs
- **Sandbox Environment**: https://sandbox.manager.headyio.com/api (test keys prefixed with `test_`)
- **GitHub Repository**: https://github.com/heady/sdk - Integration examples and test suites
- **SDK Examples**: Available for Python, JavaScript, Go, Java, Ruby, .NET
- **CI/CD Integration**: Examples for GitHub Actions, GitLab CI, Jenkins
- **API Status**: https://status.headyio.com
- **Community Forum**: https://community.headyio.com
- **Slack Community**: https://heady-community.slack.com

## Deployment Modes

| Mode | Description | Docker Profile |
|------|------------|----------------|
| **Local Offline** | Everything on-device, no cloud calls | `local-offline.yml` |
| **Local Dev** | Local with hot-reload and debug | `local-dev.yml` |
| **Hybrid** | Local orchestrator + cloud models when needed | `hybrid.yml` |
| **Cloud SaaS** | Full cloud deployment | `cloud-saas.yml` |
| **API Only** | Headless API server, no UI | `api-only.yml` |
| **Full Suite** | Everything enabled | `full-suite.yml` |

### Quick Deploy
```bash
# Local offline (everything on-device)
cd docker && docker compose -f base.yml -f profiles/local-offline.yml up

# Hybrid (local + cloud fallback)
cd docker && docker compose -f base.yml -f profiles/hybrid.yml up

# Full suite (everything)
cd docker && docker compose -f base.yml -f profiles/full-suite.yml up
```

## Security Best Practices

- All connections use TLS 1.3+ encryption (TLS 1.2 minimum)
- Data encrypted at rest with AES-256
- MFA required for API key management
- Webhook signatures validated via HMAC-SHA256 using `X-Heady-Signature` header
- Regular security audits following OWASP Top 10
- Implement rate limiting on webhook receivers to prevent DoS attacks
- Sanitize all user inputs in `config` parameters to prevent injection attacks
- Enable audit logging for all API requests in production
- Restrict API key permissions to minimum required scopes (least privilege)
- Use short-lived tokens (JWT) with refresh mechanism for high-risk environments
- Implement Content Security Policy (CSP) headers on webhook endpoints

## API Best Practices

- Use `async_mode: true` for simulations with > 5000 iterations
- Set `confidence_level` based on criticality (0.95 standard, 0.98+ critical)
- Implement webhook handlers with proper error handling and logging
- Use `X-Idempotency-Key` for deployment requests to ensure safe retries
- Monitor `risk_assessment` and `success_probability` (< 0.90 requires review)
- Configure `maintenance_window` constraints during off-peak hours
- Sandbox data automatically resets every 24 hours

## Support & Resources

- **Documentation**: https://docs.headyio.com
- **Support Email**: api-support@headyio.com
- **GitHub Issues**: https://github.com/heady/sdk/issues
