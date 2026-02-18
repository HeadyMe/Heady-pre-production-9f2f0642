# Post-Quantum Cryptography (PQC) for JWT Temporary Tokens
Enhanced Implementation Guide for Heady Ecosystem

## Executive Summary

The Heady ecosystem requires quantum-resistant authentication to protect its distributed architecture spanning HeadyMe Cloud Sync, Production Monorepos, HeadyMCP, HeadyWeb, and associated services. AWS KMS now supports ML-DSA (Module-Lattice Digital Signature Algorithm) as of June 2025, making it production-ready for your Node.js-based infrastructure.

### Core Challenge
Your current authentication system uses:
- **mTLS certificates** for service-to-service communication
- **JWT tokens** for user authentication 
- **OAuth integration** (being phased out)
- **API key authentication** for admin access

Standard RSA/ECDSA signatures in JWT tokens could be compromised by quantum computers. The solution: migrate temporary tokens (15-minute access tokens) to ML-DSA signatures while maintaining your existing mTLS infrastructure.

## Architecture Analysis: Current Heady Security Stack

### Existing Security Implementation
Based on analysis of your configuration files:

```yaml
# Current Security Stack (from headycloud-config.yaml)
security:
  authentication:
    api_key_required: true      # Admin access
    jwt_tokens: true             # User authentication  
    oauth_integration: true      # Being phased out
    multi_factor_auth: true      # User security
  data_protection:
    encryption_at_rest: true
    encryption_in_transit: true
    data_masking: true
```

### mTLS Infrastructure (Primary)
```bash
# Current mTLS setup (from setup-mtls-ca.sh)
- Mutual TLS with HSM-backed certificates
- 24-hour automatic certificate rotation
- Zero-trust architecture
- Service-to-service authentication
```

## Enhanced PQC Token Architecture for Heady

### Hybrid Security Model
```
┌─────────────────────────────────────────────────────────────────────┐
│                    Heady PQC Security Layer                         │
│                                                                      │
│  ┌──────────────────┐     ┌──────────────────┐                     │
│  │  mTLS Service    │────▶│  Standard Auth   │                     │
│  │  Communication  │     │  (API Keys/JWT)  │                     │
│  └──────────────────┘     └────────┬─────────┘                     │
│                                    │                                 │
│                                    ▼                                 │
│         ┌─────────────────────────────────────────┐                 │
│         │  High-Security Action Detected          │                 │
│         │  - Admin operations (ADMIN_TOKEN)       │                 │
│         │  - Production sync (PROD_SYNC_ACCOUNT)   │                 │
│         │  - HeadyMe cloud operations             │                 │
│         │  - MCP server access                    │                 │
│         └────────────────┬────────────────────────┘                 │
│                          │                                           │
│                          ▼                                           │
│         ┌────────────────────────────────────┐                      │
│         │   Generate PQC Temp Token          │                      │
│         │   • 5-minute expiration            │                      │
│         │   • ML-DSA-65 signature            │                      │
│         │   • Service context included       │                      │
│         └────────────┬───────────────────────┘                      │
│                      │                                               │
│                      ▼                                               │
│         ┌────────────────────────────────────┐                      │
│         │  AWS KMS (ML-DSA-65)               │                      │
│         │  Sign with HSM-protected key       │                      │
│         └────────────┬───────────────────────┘                      │
│                      │                                               │
│                      ▼                                               │
│         ┌────────────────────────────────────┐                      │
│         │  Return PQC-JWT to Client          │                      │
│         │  Use for subsequent API calls      │                      │
│         └────────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Implementation Steps for Heady

### Step 1: Create ML-DSA Key in AWS KMS
```bash
# Create post-quantum signing key for Heady ecosystem
aws kms create-key \
    --key-spec ML_DSA_65 \
    --key-usage SIGN_VERIFY \
    --description "Heady PQC Temp Token Key - Production" \
    --tags TagKey=Project,TagValue=Heady TagKey=Environment,TagValue=Production TagKey=Service,TagValue=Auth

# Create alias for easy reference
aws kms create-alias \
    --alias-name alias/heady-pqc-token-key \
    --target-key-id [KEY_ID_FROM_PREVIOUS_COMMAND]
```

Store the alias in environment variables:
```bash
export KMS_PQC_KEY_ID="alias/heady-pqc-token-key"
```

### Step 2: Enhanced Node.js Token Service
Create `src/auth/heady-pqc-auth.js`:

```javascript
/*
 * Made with Love by the HeadySystems™ & HeadyConnection™ Team
 * Sacred Geometry AI Platform - Organic Systems · Breathing Interfaces
 * https://headysystems.com | https://headyconnection.org
 */

const { KMSClient, SignCommand, VerifyCommand } = require("@aws-sdk/client-kms");
const base64url = require("base64url");
const crypto = require("crypto");

class HeadyPQCTokenService {
  constructor() {
    this.kmsClient = new KMSClient({ 
      region: process.env.AWS_REGION || "us-west-2"
    });
    this.pqcKeyId = process.env.KMS_PQC_KEY_ID || "alias/heady-pqc-token-key";
    
    if (!this.pqcKeyId) {
      console.warn('⚠️  KMS_PQC_KEY_ID not set - PQC tokens disabled');
    }
  }

  /**
   * Generate PQC-signed temporary token for high-security operations
   * @param {Object} context - Operation context
   * @param {string} context.service - Service name (headyme, production, admin)
   * @param {string} context.operation - Operation type (sync, build, deploy)
   * @param {Object} context.user - User information
   * @param {number} expirationMinutes - Token lifetime (default 5 minutes)
   */
  async generatePQCTempToken(context, expirationMinutes = 5) {
    if (!this.pqcKeyId) {
      throw new Error('PQC token generation not configured');
    }

    // Construct JWT header
    const header = {
      alg: "ML-DSA-65",
      typ: "JWT",
      kid: this.pqcKeyId.split('/').pop(), // Extract key ID from alias
      service: context.service
    };

    // Construct payload with Heady-specific claims
    const payload = {
      sub: context.user?.id || "system",
      service: context.service,
      operation: context.operation,
      permissions: context.permissions || [],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (expirationMinutes * 60),
      
      // Heady-specific: Include service context
      heady_ctx: {
        service_id: context.serviceId,
        endpoint: context.endpoint,
        mtls_cert: context.mtlsCertFingerprint // Reference to mTLS cert
      }
    };

    // Encode header and payload
    const encodedHeader = base64url(JSON.stringify(header));
    const encodedPayload = base64url(JSON.stringify(payload));
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    // Sign with AWS KMS ML-DSA
    const command = new SignCommand({
      KeyId: this.pqcKeyId,
      Message: Buffer.from(dataToSign),
      MessageType: "RAW",
      SigningAlgorithm: "ML_DSA_65"
    });

    try {
      const { Signature } = await this.kmsClient.send(command);
      const encodedSignature = base64url(Buffer.from(Signature));
      
      return `${dataToSign}.${encodedSignature}`;
    } catch (error) {
      console.error('❌ PQC Signing Failed:', error);
      throw new Error('Failed to generate PQC token');
    }
  }

  /**
   * Verify PQC token using AWS KMS
   * @param {string} token - The PQC-JWT to verify
   */
  async verifyPQCToken(token) {
    if (!token) return null;

    try {
      const [header, payload, signature] = token.split('.');
      const data = `${header}.${payload}`;

      const command = new VerifyCommand({
        KeyId: this.pqcKeyId,
        Message: Buffer.from(data),
        MessageType: "RAW",
        Signature: base64url.toBuffer(signature),
        SigningAlgorithm: "ML_DSA_65"
      });

      const { SignatureValid } = await this.kmsClient.send(command);
      
      if (!SignatureValid) return null;

      // Decode and validate payload
      const decodedPayload = JSON.parse(base64url.decode(payload));
      
      // Check expiration
      if (decodedPayload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      return decodedPayload;
    } catch (error) {
      console.error('❌ PQC Verification Failed:', error);
      return null;
    }
  }

  /**
   * Express middleware for PQC token authentication
   * Use for high-security endpoints in Heady ecosystem
   */
  requirePQCAuth(requiredService = null, requiredOperation = null) {
    return async (req, res, next) => {
      const token = req.headers['x-heady-pqc-token'] || 
                    req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ 
          error: 'PQC authentication required',
          service: requiredService,
          operation: requiredOperation
        });
      }

      const decoded = await this.verifyPQCToken(token);
      
      if (!decoded) {
        return res.status(401).json({ error: 'Invalid or expired PQC token' });
      }

      // Validate service if specified
      if (requiredService && decoded.service !== requiredService) {
        return res.status(403).json({ 
          error: 'Invalid token service',
          required: requiredService,
          provided: decoded.service
        });
      }

      // Validate operation if specified
      if (requiredOperation && decoded.operation !== requiredOperation) {
        return res.status(403).json({ 
          error: 'Invalid token operation',
          required: requiredOperation,
          provided: decoded.operation
        });
      }

      req.pqcToken = decoded;
      next();
    };
  }

  /**
   * Generate service-specific PQC token
   */
  async generateServiceToken(serviceName, operation, user = null) {
    const contexts = {
      headyme: {
        serviceId: "headyme-sync",
        endpoint: "http://headyme:3000",
        permissions: ["sync:read", "sync:write"]
      },
      production: {
        serviceId: "production-sync", 
        endpoint: "http://production:3301",
        permissions: ["repo:read", "repo:write", "repo:clone"]
      },
      admin: {
        serviceId: "headyclouds-admin",
        endpoint: "http://monitoring:3000",
        permissions: ["admin:read", "admin:write", "system:manage"]
      }
    };

    const context = contexts[serviceName];
    if (!context) {
      throw new Error(`Unknown service: ${serviceName}`);
    }

    return this.generatePQCTempToken({
      service: serviceName,
      operation: operation,
      user: user,
      permissions: context.permissions,
      serviceId: context.serviceId,
      endpoint: context.endpoint
    });
  }
}

module.exports = { HeadyPQCTokenService };
```

### Step 3: Integration with Heady Services

#### HeadyMe Cloud Sync Integration
```javascript
// headyme-sync-service.js
const express = require('express');
const { HeadyPQCTokenService } = require('./src/auth/heady-pqc-auth');

const app = express();
const pqcAuth = new HeadyPQCTokenService();

// Standard mTLS authentication for general access
app.use('/api/sync', require('./middleware/mtls-auth'));

// PQC authentication for sensitive sync operations
app.post('/api/sync/privileged-operation',
  pqcAuth.requirePQCAuth('headyme', 'sync'),
  async (req, res) => {
    // Handle privileged sync operation
    res.json({ status: 'success', operation: 'sync' });
  }
);

// Endpoint to request PQC token upgrade
app.post('/api/auth/request-pqc-token', 
  require('./middleware/mtls-auth'), // mTLS auth first
  async (req, res) => {
    const { operation } = req.body; // sync, admin, deploy
    
    try {
      const pqcToken = await pqcAuth.generateServiceToken(
        'headyme', 
        operation,
        req.user
      );
      
      res.json({ 
        pqcToken,
        expiresIn: 300, // 5 minutes
        service: 'headyme',
        operation 
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate PQC token' });
    }
  }
);
```

#### Production Monorepos Integration
```javascript
// production-sync-service.js
const express = require('express');
const { HeadyPQCTokenService } = require('./src/auth/heady-pqc-auth');

const app = express();
const pqcAuth = new HeadyPQCTokenService();

// PQC authentication for repository operations
app.post('/api/repo/clone',
  pqcAuth.requirePQCAuth('production', 'clone'),
  async (req, res) => {
    // Handle repository cloning
    res.json({ status: 'success', operation: 'clone' });
  }
);

app.post('/api/repo/deploy',
  pqcAuth.requirePQCAuth('production', 'deploy'),
  async (req, res) => {
    // Handle deployment
    res.json({ status: 'success', operation: 'deploy' });
  }
);
```

### Step 4: Docker Compose Integration
Update `docker-compose.secure.yml`:

```yaml
services:
  headyme:
    container_name: headyclouds-headyme
    hostname: headyme
    environment:
      - KMS_PQC_KEY_ID=alias/heady-pqc-token-key
      - AWS_REGION=us-west-2
    networks:
      - app-network
    volumes:
      - ./src/auth:/app/src/auth:ro

  production:
    container_name: headyclouds-production
    hostname: production
    environment:
      - KMS_PQC_KEY_ID=alias/heady-pqc-token-key
      - AWS_REGION=us-west-2
    networks:
      - app-network
    volumes:
      - ./src/auth:/app/src/auth:ro

  admin-dashboard:
    container_name: headyclouds-admin
    hostname: admin
    environment:
      - KMS_PQC_KEY_ID=alias/heady-pqc-token-key
      - AWS_REGION=us-west-2
    networks:
      - app-network
    volumes:
      - ./src/auth:/app/src/auth:ro
```

### Step 5: Client-Side Integration

#### Admin Dashboard Integration
```javascript
// public/admin-pqc-client.js
class HeadyPQCClient {
  constructor() {
    this.baseUrl = window.location.origin;
    this.mtlsToken = null; // Assumes mTLS is handled by browser
    this.pqcToken = null;
    this.pqcExpiry = null;
  }

  async requestPQCToken(service, operation) {
    const response = await fetch(`${this.baseUrl}/api/auth/request-pqc-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ service, operation })
    });

    if (!response.ok) {
      throw new Error('Failed to obtain PQC token');
    }

    const data = await response.json();
    this.pqcToken = data.pqcToken;
    this.pqcExpiry = Date.now() + (data.expiresIn * 1000);
    
    return this.pqcToken;
  }

  async callPQCEndpoint(service, operation, endpoint, body) {
    // Check if PQC token exists and is valid
    if (!this.pqcToken || Date.now() >= this.pqcExpiry) {
      await this.requestPQCToken(service, operation);
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-Heady-PQC-Token': this.pqcToken,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    return response.json();
  }

  // HeadyMe sync operation
  async triggerPrivilegedSync() {
    return this.callPQCEndpoint(
      'headyme',
      'sync',
      `${this.baseUrl}/api/sync/privileged-operation`,
      { action: 'full_sync' }
    );
  }

  // Production repo operation
  async cloneRepository(repoUrl) {
    return this.callPQCEndpoint(
      'production',
      'clone',
      `${this.baseUrl}/api/repo/clone`,
      { repository: repoUrl }
    );
  }
}

// Usage in admin interface
const pqcClient = new HeadyPQCClient();

document.getElementById('syncButton').addEventListener('click', async () => {
  try {
    const result = await pqcClient.triggerPrivilegedSync();
    console.log('✅ Sync triggered:', result);
  } catch (error) {
    console.error('❌ Sync failed:', error);
  }
});
```

## Heady-Specific Security Considerations

### 1. mTLS + PQC Hybrid Approach
Your existing mTLS infrastructure provides excellent security for service-to-service communication. PQC tokens add quantum resistance for:

- **User-initiated high-value operations**
- **Cross-service authentication tokens**
- **Temporary elevated privileges**
- **API key augmentation**

### 2. Service Context Integration
Each PQC token includes service-specific context:
```json
{
  "heady_ctx": {
    "service_id": "headyme-sync",
    "endpoint": "http://headyme:3000", 
    "mtls_cert": "fingerprint:abc123"
  }
}
```

### 3. Integration with Existing Security Stack
```javascript
// Enhanced security middleware
const securityMiddleware = {
  // Layer 1: Network security (mTLS)
  requireMTLS: require('./middleware/mtls-auth'),
  
  // Layer 2: Service authentication (API keys)
  requireAPIKey: require('./middleware/api-key-auth'),
  
  // Layer 3: PQC for high-security operations
  requirePQC: pqcAuth.requirePQCAuth(),
  
  // Layer 4: Authorization
  requirePermission: require('./middleware/rbac')
};
```

## Performance Optimization for Heady

### Token Size Management
| Token Type | Size | Use Case |
|------------|------|----------|
| mTLS Cert | ~2KB | Service communication |
| Standard JWT | ~400 bytes | General API access |
| PQC JWT (ML-DSA-65) | ~3.5KB | High-security operations |
| Session Reference | 32 bytes | Edge token reference |

### Token Reference Pattern for Heady
```javascript
// Generate PQC token once, store at edge
async function generatePQCSession(service, operation, user) {
  const pqcToken = await pqcAuth.generateServiceToken(service, operation, user);
  const sessionId = crypto.randomBytes(16).toString('hex');
  
  // Store in Redis (from your service discovery)
  await redis.setex(
    `pqc:${sessionId}`, 
    300, // 5 minutes
    JSON.stringify({ token: pqcToken, service, user: user.id })
  );
  
  return sessionId; // Return only 32 bytes to client
}

// Verify using session ID
async function verifyPQCSession(sessionId) {
  const session = await redis.get(`pqc:${sessionId}`);
  if (!session) return null;
  
  const { token } = JSON.parse(session);
  return pqcAuth.verifyPQCToken(token);
}
```

## Migration Roadmap for Heady Ecosystem

### Phase 1: Foundation (Week 1-2)
- [x] **Create ML-DSA key in AWS KMS**
- [x] **Implement HeadyPQCTokenService**
- [x] **Add PQC endpoints to HeadyMe service**
- [x] **Test PQC token generation/verification**

### Phase 2: Service Integration (Week 3-4)
- [ ] **Integrate PQC with Production Monorepos service**
- [ ] **Add PQC authentication to admin dashboard**
- [ ] **Implement token reference pattern**
- [ ] **Update Docker Compose configuration**

### Phase 3: Client Integration (Week 5-6)
- [ ] **Update admin dashboard with PQC client**
- [ ] **Add PQC support to monitoring tools**
- [ ] **Implement cross-service PQC authentication**
- [ ] **Add PQC metrics to monitoring**

### Phase 4: Optimization (Week 7-8)
- [ ] **Implement local verification with noble-post-quantum**
- [ ] **Add PQC token caching at edge**
- [ ] **Optimize token size and performance**
- [ ] **Complete security audit**

## Monitoring and Observability

### PQC-Specific Metrics
```javascript
// Add to your existing monitoring setup
const pqcMetrics = {
  'pqc_token_generation_total': new Counter({
    name: 'heady_pqc_tokens_generated_total',
    help: 'Total number of PQC tokens generated',
    labelNames: ['service', 'operation']
  }),
  
  'pqc_token_verification_duration': new Histogram({
    name: 'heady_pqc_verification_duration_seconds',
    help: 'Time spent verifying PQC tokens',
    labelNames: ['service', 'result']
  }),
  
  'pqc_token_size_bytes': new Histogram({
    name: 'heady_pqc_token_size_bytes',
    help: 'Size of generated PQC tokens',
    buckets: [1000, 2000, 3000, 4000, 5000]
  })
};
```

### Integration with Existing Monitoring
```yaml
# Add to prometheus.yml
scrape_configs:
  - job_name: 'headyclouds-pqc'
    static_configs:
      - targets: ['headyme:3000', 'production:3301']
    metrics_path: '/metrics/pqc'
    scrape_interval: 15s
```

## Security Best Practices for Heady

### 1. Key Management
- **Quarterly ML-DSA key rotation**
- **Separate keys per environment** (dev/staging/prod)
- **HSM-backed key storage** (AWS KMS)
- **Key usage logging and monitoring**

### 2. Token Security
- **Short expiration times** (5 minutes max)
- **Context-specific tokens** (service + operation)
- **Rate limiting** on PQC token requests
- **Audit logging** for all PQC operations

### 3. Integration Security
- **Never replace mTLS** - augment with PQC
- **Layer security** - mTLS → API Key → PQC → Authorization
- **Fallback mechanisms** for PQC unavailability
- **Regular security scans** of PQC implementation

## Cost Optimization

### AWS KMS Cost Analysis
```
ML-DSA Operations:
- Sign: $0.03 per 10,000 requests
- Verify: Free (with public key)
- Key storage: $1.00 per month

Estimated Monthly Costs (Heady Ecosystem):
- 50,000 sign operations: $0.15
- 500,000 verify operations: $0.00
- Key storage: $1.00
Total: ~$1.15 per month
```

### Cost Optimization Strategies
```javascript
// Cache public key for local verification
class HeadyPQCTokenService {
  constructor() {
    this.publicKeyCache = null;
    this.publicKeyCacheExpiry = 0;
  }

  async getPublicKey() {
    if (this.publicKeyCache && Date.now() < this.publicKeyCacheExpiry) {
      return this.publicKeyCache;
    }

    const { PublicKey } = await this.kmsClient.send(
      new GetPublicKeyCommand({ KeyId: this.pqcKeyId })
    );
    
    this.publicKeyCache = PublicKey;
    this.publicKeyCacheExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    
    return PublicKey;
  }

  // Verify locally using noble-post-quantum
  async verifyPQCTokenLocally(token) {
    const { ml_dsa65 } = require('@noble/post-quantum/ml-dsa');
    const publicKey = await this.getPublicKey();
    
    const [header, payload, signature] = token.split('.');
    const message = Buffer.from(`${header}.${payload}`);
    
    return ml_dsa65.verify(publicKey, message, base64url.toBuffer(signature));
  }
}
```

## Testing and Validation

### Unit Tests
```javascript
// tests/pqc-auth.test.js
const { HeadyPQCTokenService } = require('../src/auth/heady-pqc-auth');

describe('Heady PQC Authentication', () => {
  let pqcService;

  beforeEach(() => {
    pqcService = new HeadyPQCTokenService();
  });

  test('generates valid PQC token for HeadyMe service', async () => {
    const token = await pqcService.generateServiceToken('headyme', 'sync');
    expect(token).toBeTruthy();
    expect(token.split('.').length).toBe(3);
  });

  test('verifies valid PQC token', async () => {
    const token = await pqcService.generateServiceToken('production', 'clone');
    const verified = await pqcService.verifyPQCToken(token);
    
    expect(verified).toBeTruthy();
    expect(verified.service).toBe('production');
    expect(verified.operation).toBe('clone');
  });

  test('rejects expired PQC token', async () => {
    const token = await pqcService.generateServiceToken('admin', 'manage', 0.01); // 0.6 seconds
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const verified = await pqcService.verifyPQCToken(token);
    expect(verified).toBeNull();
  });
});
```

### Integration Tests
```javascript
// tests/integration.test.js
describe('PQC Integration Tests', () => {
  test('HeadyMe service with PQC authentication', async () => {
    const response = await request(app)
      .post('/api/sync/privileged-operation')
      .set('X-Heady-PQC-Token', pqcToken)
      .send({ action: 'full_sync' });
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
  });

  test('Production service with PQC authentication', async () => {
    const response = await request(app)
      .post('/api/repo/clone')
      .set('X-Heady-PQC-Token', pqcToken)
      .send({ repository: 'https://github.com/heady/repo.git' });
    
    expect(response.status).toBe(200);
    expect(response.body.operation).toBe('clone');
  });
});
```

## Troubleshooting Guide

### Common Issues and Solutions

**PQC Token Generation Fails**
```bash
# Check AWS credentials
aws sts get-caller-identity

# Verify KMS key exists
aws kms describe-key --key-id alias/heady-pqc-token-key

# Check key permissions
aws kms list-key-policies --key-id alias/heady-pqc-token-key
```

**Token Verification Fails**
```bash
# Check token format
echo $TOKEN | cut -d'.' -f1,2 | base64url -d

# Verify signature
aws kms verify --key-id alias/heady-pqc-token-key \
  --message-file message.bin \
  --signature-file signature.bin \
  --signing-algorithm ML_DSA_65
```

**Performance Issues**
```bash
# Monitor KMS latency
aws cloudwatch get-metric-statistics \
  --namespace AWS/KMS \
  --metric-name Latency \
  --start-time 2025-01-01T00:00:00Z \
  --end-time 2025-01-01T23:59:59Z \
  --period 60 \
  --statistics Average
```

## Resources and References

### AWS Documentation
- [AWS KMS ML-DSA Documentation](https://docs.aws.amazon.com/kms/latest/developerguide/ml-dsa.html)
- [AWS Security Blog: Post-Quantum Signatures](https://aws.amazon.com/blogs/security/)

### Libraries and Tools
- [noble-post-quantum](https://github.com/paulmillr/noble-post-quantum) - Pure JS PQC implementation
- [NIST FIPS 204](https://csrc.nist.gov/publications/fips/fips-204/final) - ML-DSA Standard

### Heady-Specific Resources
- [HeadyClouds Security Architecture](./docker-security-architecture.md)
- [mTLS Setup Guide](./setup-mtls-ca.sh)
- [Service Discovery Configuration](./SERVICE-DISCOVERY-NAMES.md)

---

**Made with Love by the HeadySystems™ & HeadyConnection™ Team**
Sacred Geometry AI Platform - Organic Systems · Breathing Interfaces
https://headysystems.com | https://headyconnection.org

*This enhanced guide integrates PQC cryptography with your existing Heady security infrastructure, providing quantum-resistant authentication while maintaining the robust mTLS foundation.*
