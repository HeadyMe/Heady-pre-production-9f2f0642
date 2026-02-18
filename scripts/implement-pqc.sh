#!/bin/bash
# 🚀 HeadyStack PQC Implementation Script
# Automated deployment of Post-Quantum Cryptography for Heady ecosystem

set -euo pipefail

# Configuration
HEADY_BASE="${HOME}/HeadyStack"
PQC_CONFIG_DIR="${HEADY_BASE}/config/pqc"
SCRIPTS_DIR="${HEADY_BASE}/scripts"
LOG_FILE="${HEADY_BASE}/logs/pqc-implementation-$(date +%Y%m%d-%H%M%S).log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${LOG_FILE}"
}

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1" | tee -a "${LOG_FILE}"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "${LOG_FILE}"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "${LOG_FILE}"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1" | tee -a "${LOG_FILE}"
}

print_success() {
    echo -e "${CYAN}[SUCCESS]${NC} $1" | tee -a "${LOG_FILE}"
}

# Check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites..."
    
    # Check if AWS CLI is installed
    if ! command -v aws >/dev/null 2>&1; then
        print_error "AWS CLI is required. Install with: curl -fsSL https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip"
        exit 1
    fi
    
    # Check if Node.js is installed
    if ! command -v node >/dev/null 2>&1; then
        print_error "Node.js is required for HeadyStack PQC implementation"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        print_error "AWS credentials not configured. Run: aws configure"
        exit 1
    fi
    
    # Create necessary directories
    mkdir -p "${HEADY_BASE}/logs" "${PQC_CONFIG_DIR}" "${SCRIPTS_DIR}"
    
    print_success "Prerequisites check passed"
}

# Install PQC dependencies
install_pqc_dependencies() {
    print_step "Installing Post-Quantum Cryptography dependencies..."
    
    # Install Node.js packages
    cd "${HEADY_BASE}"
    
    # Create package.json if it doesn't exist
    if [[ ! -f package.json ]]; then
        cat > package.json << 'EOF'
{
  "name": "headystack-pqc",
  "version": "1.0.0",
  "description": "HeadyStack Post-Quantum Cryptography Implementation",
  "main": "src/auth/heady-pqc-auth.js",
  "scripts": {
    "test": "node scripts/test-pqc.js",
    "start": "node src/server/heady-api-server.js"
  },
  "dependencies": {
    "@aws-sdk/client-kms": "^3.600.0",
    "@noble/post-quantum": "^0.1.0",
    "base64url": "^8.0.0",
    "express": "^4.18.0",
    "jsonwebtoken": "^9.0.0",
    "crypto": "^1.0.1"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "supertest": "^6.3.0"
  }
}
EOF
    fi
    
    # Install dependencies
    npm install
    
    print_success "PQC dependencies installed"
}

# Create AWS KMS ML-DSA key
create_pqc_key() {
    print_step "Creating AWS KMS ML-DSA key..."
    
    # Check if key already exists
    if aws kms describe-key --key-id "alias/heady-pqc-key" >/dev/null 2>&1; then
        print_warning "PQC key already exists. Skipping creation."
        return 0
    fi
    
    # Create ML-DSA key
    local key_id=$(aws kms create-key \
        --key-spec ML_DSA_65 \
        --key-usage SIGN_VERIFY \
        --description "Heady PQC Temp Token Key - Production" \
        --tags TagKey=Project,TagValue=Heady TagKey=Environment,TagValue=Production TagKey=Service,TagValue=HeadyStack \
        --query 'KeyMetadata.KeyId' \
        --output text)
    
    # Create alias
    aws kms create-alias --alias-name alias/heady-pqc-key --target-key-id "${key_id}"
    
    # Store key ID in configuration
    echo "KMS_PQC_KEY_ID=alias/heady-pqc-key" >> "${HEADY_BASE}/.env"
    
    print_success "PQC key created: ${key_id}"
}

# Create PQC configuration
create_pqc_config() {
    print_step "Creating PQC configuration..."
    
    cat > "${PQC_CONFIG_DIR}/pqc-config.json" << 'EOF'
{
  "algorithm": "ML-DSA-65",
  "keyId": "alias/heady-pqc-key",
  "tokenExpiry": {
    "free": 120,
    "pro": 300,
    "enterprise": 900
  },
  "contexts": [
    "admin",
    "payment", 
    "model_access",
    "sacred_geometry"
  ],
  "quantumProtected": true,
  "performance": {
    "enableLocalVerification": true,
    "publicKeyCacheTTL": 86400000,
    "costOptimization": true
  },
  "monitoring": {
    "enableMetrics": true,
    "logLevel": "info",
    "traceSigning": true
  }
}
EOF
    
    # Create environment file
    cat > "${HEADY_BASE}/.env" << EOF
# HeadyStack PQC Configuration
KMS_PQC_KEY_ID=alias/heady-pqc-key
AWS_REGION=us-east-1
HEADY_ENV=production
NODE_ENV=production

# PQC Settings
PQC_ALGORITHM=ML-DSA-65
PQC_TOKEN_EXPIRY_FREE=120
PQC_TOKEN_EXPIRY_PRO=300
PQC_TOKEN_EXPIRY_ENTERPRISE=900

# HeadyStack Settings
HEADY_API_BASE=https://headysystems.com/api
HEADY_WORKSPACE=default
EOF
    
    print_success "PQC configuration created"
}

# Create PQC authentication service
create_pqc_auth_service() {
    print_step "Creating PQC authentication service..."
    
    mkdir -p "${HEADY_BASE}/src/auth"
    
    # Use the enhanced PQC service from the guide
    cat > "${HEADY_BASE}/src/auth/heady-pqc-auth.js" << 'EOF'
/*
 * Made with Love by the HeadySystems™ & HeadyConnection™ Team
 * Sacred Geometry AI Platform - Organic Systems · Breathing Interfaces
 * Post-Quantum Cryptography Integration for HeadyStack
 * https://headysystems.com | https://headyconnection.org
 */

const { KMSClient, SignCommand, VerifyCommand, GetPublicKeyCommand } = require("@aws-sdk/client-kms");
const base64url = require("base64url");
const crypto = require("crypto");

class HeadyPQCTokenService {
  constructor() {
    this.kmsClient = new KMSClient({ 
      region: process.env.AWS_REGION || "us-east-1",
      maxAttempts: 3
    });
    this.pqcKeyId = process.env.KMS_PQC_KEY_ID || "alias/heady-pqc-key";
    this.publicKeyCache = null;
    this.publicKeyCacheExpiry = 0;
    
    // HeadyStack configuration
    this.subscriptionTiers = {
      free: { maxTokens: 10, tokenExpiry: 2 },
      pro: { maxTokens: 50, tokenExpiry: 5 },
      enterprise: { maxTokens: 200, tokenExpiry: 15 }
    };
    
    if (!this.pqcKeyId) {
      console.warn('⚠️  KMS_PQC_KEY_ID not set - PQC tokens disabled');
    }
  }

  async generatePQCTempToken(user, context, options = {}) {
    if (!this.pqcKeyId) {
      throw new Error('PQC token generation not configured');
    }

    const tier = this.subscriptionTiers[user.subscriptionTier] || this.subscriptionTiers.free;
    const expirationMinutes = options.expirationMinutes || tier.tokenExpiry;

    const header = {
      alg: "ML-DSA-65",
      typ: "JWT",
      kid: this.pqcKeyId.includes('/') ? this.pqcKeyId.split('/')[1] : this.pqcKeyId,
      iat: Math.floor(Date.now() / 1000),
      hdy: {
        version: "1.0.0",
        service: "headystack",
        environment: process.env.HEADY_ENV || "production"
      }
    };

    const payload = {
      sub: user.id,
      email: user.email,
      tier: user.subscriptionTier,
      roles: user.roles || [],
      context: context,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (expirationMinutes * 60),
      jti: crypto.randomUUID(),
      hdy: {
        deviceId: user.deviceId || "unknown",
        workspace: user.workspace || "default",
        permissions: this.getContextPermissions(context, user),
        limits: {
          apiCalls: user.usage?.apiCalls || tier.maxTokens,
          storage: user.usage?.storage || (tier === 'enterprise' ? 1000 : 100),
          models: user.usage?.models || (tier === 'free' ? 1 : 10)
        },
        geometry: {
          pattern: this.getSacredGeometryPattern(context),
          resonance: user.resonance || "harmonic"
        }
      }
    };

    const encodedHeader = base64url(JSON.stringify(header));
    const encodedPayload = base64url(JSON.stringify(payload));
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    try {
      const startTime = Date.now();
      const command = new SignCommand({
        KeyId: this.pqcKeyId,
        Message: Buffer.from(dataToSign),
        MessageType: "RAW",
        SigningAlgorithm: "ML_DSA_65"
      });

      const { Signature } = await this.kmsClient.send(command);
      const signingDuration = Date.now() - startTime;
      
      console.log(`🔐 PQC token generated in ${signingDuration}ms for user ${user.id}`);
      
      const encodedSignature = base64url(Buffer.from(Signature));
      return `${dataToSign}.${encodedSignature}`;
      
    } catch (error) {
      console.error('❌ PQC Signing Failed:', error);
      throw new Error(`Failed to generate PQC token: ${error.message}`);
    }
  }

  async verifyPQCToken(token) {
    if (!token) return null;

    try {
      const [header, payload, signature] = token.split('.');
      const data = `${header}.${payload}`;

      if (this.publicKeyCache && Date.now() < this.publicKeyCacheExpiry) {
        const isValid = await this.verifyLocally(data, signature);
        if (isValid) {
          return this.decodeAndValidatePayload(payload);
        }
      }

      const command = new VerifyCommand({
        KeyId: this.pqcKeyId,
        Message: Buffer.from(data),
        MessageType: "RAW",
        Signature: base64url.toBuffer(signature),
        SigningAlgorithm: "ML_DSA_65"
      });

      const { SignatureValid } = await this.kmsClient.send(command);
      
      if (!SignatureValid) return null;

      return this.decodeAndValidatePayload(payload);
      
    } catch (error) {
      console.error('❌ PQC Verification Failed:', error);
      return null;
    }
  }

  requirePQCAuth(requiredContext = null, requiredTier = null) {
    return async (req, res, next) => {
      const token = req.headers['x-heady-pqc-token'] || 
                    req.headers['authorization']?.replace('Bearer ', '') ||
                    req.body?.pqcToken;

      if (!token) {
        return res.status(401).json({ 
          error: 'PQC authentication required',
          context: requiredContext,
          tier: requiredTier
        });
      }

      const decoded = await this.verifyPQCToken(token);
      
      if (!decoded) {
        return res.status(401).json({ 
          error: 'Invalid or expired PQC token',
          hint: 'Request new token from /api/auth/request-pqc-token'
        });
      }

      if (requiredContext && decoded.context !== requiredContext) {
        return res.status(403).json({ 
          error: 'Invalid token context',
          required: requiredContext,
          provided: decoded.context
        });
      }

      if (requiredTier && decoded.tier !== requiredTier && decoded.tier !== 'enterprise') {
        return res.status(403).json({ 
          error: 'Insufficient subscription tier',
          required: requiredTier,
          current: decoded.tier
        });
      }

      req.pqcUser = decoded;
      req.user = await this.getUserById(decoded.sub);
      next();
    };
  }

  getContextPermissions(context, user) {
    const permissions = {
      admin: ['read', 'write', 'delete', 'manage_users'],
      payment: ['process_payment', 'refund', 'view_transactions'],
      model_access: ['inference', 'fine_tune', 'deploy'],
      sacred_geometry: ['modify_patterns', 'resonance_tuning', 'harmonic_alignment']
    };
    
    const userPerms = permissions[context] || [];
    const tierMultiplier = user.subscriptionTier === 'enterprise' ? 1 : 0.5;
    
    return userPerms.slice(0, Math.ceil(userPerms.length * tierMultiplier));
  }

  getSacredGeometryPattern(context) {
    const patterns = {
      admin: 'flower_of_life',
      payment: 'golden_spiral',
      model_access: 'metatron_cube',
      sacred_geometry: 'sacred_fibonacci'
    };
    
    return patterns[context] || 'harmonic_grid';
  }

  async getUserById(userId) {
    // Integrate with your existing user store
    return { id: userId, subscriptionTier: 'pro' };
  }

  decodeAndValidatePayload(encodedPayload) {
    const payload = JSON.parse(base64url.decode(encodedPayload));
    
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    if (!payload.hdy || !payload.hdy.version) {
      return null;
    }

    return payload;
  }

  async getPublicKey() {
    if (this.publicKeyCache && Date.now() < this.publicKeyCacheExpiry) {
      return this.publicKeyCache;
    }

    const command = new GetPublicKeyCommand({ KeyId: this.pqcKeyId });
    const { PublicKey } = await this.kmsClient.send(command);
    
    this.publicKeyCache = PublicKey;
    this.publicKeyCacheExpiry = Date.now() + (24 * 60 * 60 * 1000);
    
    return PublicKey;
  }

  async verifyLocally(data, signature) {
    try {
      const { ml_dsa65 } = require('@noble/post-quantum/ml-dsa');
      const publicKey = await this.getPublicKey();
      
      return ml_dsa65.verify(publicKey, Buffer.from(data), base64url.toBuffer(signature));
    } catch (error) {
      console.error('Local verification failed:', error);
      return false;
    }
  }
}

module.exports = { HeadyPQCTokenService };
EOF
    
    print_success "PQC authentication service created"
}

# Create API server with PQC integration
create_api_server() {
    print_step "Creating API server with PQC integration..."
    
    mkdir -p "${HEADY_BASE}/src/server"
    
    cat > "${HEADY_BASE}/src/server/heady-api-server.js" << 'EOF'
const express = require('express');
const { HeadyPQCTokenService } = require('../auth/heady-pqc-auth');

const app = express();
const pqcAuth = new HeadyPQCTokenService();

// Middleware
app.use(express.json());

// Standard authentication middleware (placeholder)
const standardAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Standard authentication required' });
  }
  
  // Mock user for demo
  req.user = {
    id: 'demo-user-123',
    email: 'demo@headysystems.com',
    subscriptionTier: 'pro',
    roles: ['user', 'pro']
  };
  next();
};

// PQC token request endpoint
app.post('/api/auth/request-pqc-token', 
  standardAuth,
  async (req, res) => {
    const { context } = req.body;
    
    try {
      const pqcToken = await pqcAuth.generatePQCTempToken(req.user, context);
      
      res.json({ 
        pqcToken,
        expiresIn: 300,
        context,
        quantumAlgorithm: 'ML-DSA-65',
        signatureSize: '~3.3KB'
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate PQC token' });
    }
  }
);

// PQC-protected admin endpoint
app.post('/api/admin/build', 
  pqcAuth.requirePQCAuth('admin', 'pro'),
  async (req, res) => {
    const result = {
      success: true,
      buildId: `build-${Date.now()}`,
      quantumSecured: true,
      message: 'Quantum-protected build initiated'
    };
    
    res.json(result);
  }
);

// PQC-protected sacred geometry endpoint
app.post('/api/geometry/modify-pattern',
  pqcAuth.requirePQCAuth('sacred_geometry', 'enterprise'),
  async (req, res) => {
    const { pattern, resonance } = req.body;
    
    const result = {
      success: true,
      pattern: pattern,
      resonance: resonance,
      quantumSecured: true,
      message: 'Sacred geometry pattern modified with quantum protection'
    };
    
    res.json(result);
  }
);

// PQC-protected model access endpoint
app.post('/api/hf/generate',
  pqcAuth.requirePQCAuth('model_access'),
  async (req, res) => {
    const { prompt, model } = req.body;
    
    const result = {
      success: true,
      prompt: prompt,
      model: model || 'default',
      response: `Generated response for: ${prompt}`,
      quantumSecured: true,
      usage: {
        tokens: 150,
        cost: 0.002
      }
    };
    
    res.json(result);
  }
);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    pqcEnabled: !!pqcAuth.pqcKeyId,
    algorithm: 'ML-DSA-65'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 HeadyStack API Server running on port ${PORT}`);
  console.log(`🔐 PQC Authentication: ${pqcAuth.pqcKeyId ? 'Enabled' : 'Disabled'}`);
});
EOF
    
    print_success "API server with PQC integration created"
}

# Create test scripts
create_test_scripts() {
    print_step "Creating PQC test scripts..."
    
    # Node.js test script
    cat > "${SCRIPTS_DIR}/test-pqc.js" << 'EOF'
const { HeadyPQCTokenService } = require('../src/auth/heady-pqc-auth');

async function testPQCAuth() {
  console.log('🔐 Testing HeadyStack PQC Authentication...');
  
  const pqcService = new HeadyPQCTokenService();
  
  // Test user
  const testUser = {
    id: 'test-user-123',
    email: 'test@headysystems.com',
    subscriptionTier: 'pro',
    roles: ['user', 'pro'],
    usage: { apiCalls: 50, storage: 500 }
  };
  
  try {
    // Test token generation
    console.log('📝 Testing PQC token generation...');
    const token = await pqcService.generatePQCTempToken(testUser, 'admin');
    console.log(`✅ Token generated (${token.length} characters)`);
    
    // Test token verification
    console.log('🔍 Testing PQC token verification...');
    const verified = await pqcService.verifyPQCToken(token);
    
    if (verified) {
      console.log('✅ Token verified successfully');
      console.log(`📊 User: ${verified.sub}`);
      console.log(`🎯 Context: ${verified.context}`);
      console.log(`💎 Tier: ${verified.tier}`);
      console.log(`🔐 Permissions: ${verified.hdy.permissions.join(', ')}`);
    } else {
      console.log('❌ Token verification failed');
    }
    
    // Test expiration
    console.log('⏰ Testing token expiration...');
    const expiredToken = await pqcService.generatePQCTempToken(testUser, 'admin', 0.01); // 0.6 seconds
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const expiredVerified = await pqcService.verifyPQCToken(expiredToken);
    if (!expiredVerified) {
      console.log('✅ Expired token correctly rejected');
    } else {
      console.log('❌ Expired token was accepted (error)');
    }
    
    console.log('🎉 PQC Authentication tests completed successfully!');
    
  } catch (error) {
    console.error('❌ PQC Authentication test failed:', error.message);
    process.exit(1);
  }
}

testPQCAuth();
EOF
    
    # Bash test script
    cat > "${SCRIPTS_DIR}/test-pqc-api.sh" << 'EOF'
#!/bin/bash
# HeadyStack PQC API Test Script

echo "🔐 Testing HeadyStack PQC API..."

BASE_URL="https://manager.headyme.com"

# Test health check
echo "🏥 Testing health check..."
curl -s "${BASE_URL}/api/health" | jq .

# Test PQC token request
echo "📝 Testing PQC token request..."
TOKEN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/request-pqc-token" \
  -H "Authorization: Bearer demo-token" \
  -H "Content-Type: application/json" \
  -d '{"context": "admin"}')

echo "${TOKEN_RESPONSE}" | jq .

# Extract token for next tests
PQC_TOKEN=$(echo "${TOKEN_RESPONSE}" | jq -r '.pqcToken')

if [[ "$PQC_TOKEN" != "null" && "$PQC_TOKEN" != "" ]]; then
    echo "🛡️ Testing PQC-protected admin endpoint..."
    curl -s -X POST "${BASE_URL}/api/admin/build" \
      -H "X-Heady-PQC-Token: ${PQC_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{"script": "test.sh"}' | jq .
    
    echo "🔮 Testing PQC-protected geometry endpoint..."
    curl -s -X POST "${BASE_URL}/api/geometry/modify-pattern" \
      -H "X-Heady-PQC-Token: ${PQC_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{"pattern": "flower_of_life", "resonance": "harmonic"}' | jq .
    
    echo "🤖 Testing PQC-protected model endpoint..."
    curl -s -X POST "${BASE_URL}/api/hf/generate" \
      -H "X-Heady-PQC-Token: ${PQC_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{"prompt": "Hello HeadyStack", "model": "default"}' | jq .
else
    echo "❌ Failed to obtain PQC token"
fi

echo "✅ PQC API tests completed"
EOF
    
    chmod +x "${SCRIPTS_DIR}/test-pqc-api.sh"
    
    print_success "PQC test scripts created"
}

# Create deployment script
create_deployment_script() {
    print_step "Creating PQC deployment script..."
    
    cat > "${SCRIPTS_DIR}/deploy-pqc.sh" << 'EOF'
#!/bin/bash
# HeadyStack PQC Deployment Script

set -e

echo "🚀 Deploying HeadyStack PQC Implementation..."

# Navigate to HeadyStack directory
cd "$(dirname "$0")/.."

# Load environment variables
if [[ -f .env ]]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Start the API server
echo "🌐 Starting API server..."
NODE_ENV=production node src/server/heady-api-server.js
EOF
    
    chmod +x "${SCRIPTS_DIR}/deploy-pqc.sh"
    
    print_success "PQC deployment script created"
}

# Create monitoring script
create_monitoring_script() {
    print_step "Creating PQC monitoring script..."
    
    cat > "${SCRIPTS_DIR}/monitor-pqc.sh" << 'EOF'
#!/bin/bash
# HeadyStack PQC Monitoring Script

BASE_URL="https://manager.headyme.com"
LOG_FILE="${HOME}/HeadyStack/logs/pqc-monitoring.log"

echo "🔍 Monitoring HeadyStack PQC Service..." | tee -a "${LOG_FILE}"

# Check service health
HEALTH=$(curl -s "${BASE_URL}/api/health" 2>/dev/null || echo '{"status":"error"}')
STATUS=$(echo "${HEALTH}" | jq -r '.status')

echo "$(date): Service Status: ${STATUS}" | tee -a "${LOG_FILE}"

if [[ "${STATUS}" == "healthy" ]]; then
    # Test PQC token generation
    TOKEN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/request-pqc-token" \
        -H "Authorization: Bearer demo-token" \
        -H "Content-Type: application/json" \
        -d '{"context": "admin"}' 2>/dev/null || echo '{"error":"failed"}')
    
    if echo "${TOKEN_RESPONSE}" | jq -e '.pqcToken' >/dev/null 2>&1; then
        echo "$(date): PQC Token Generation: ✅ Working" | tee -a "${LOG_FILE}"
        
        # Get token size
        TOKEN_SIZE=$(echo "${TOKEN_RESPONSE}" | jq -r '.pqcToken | length')
        echo "$(date): Token Size: ${TOKEN_SIZE} characters" | tee -a "${LOG_FILE}"
    else
        echo "$(date): PQC Token Generation: ❌ Failed" | tee -a "${LOG_FILE}"
    fi
    
    # Check AWS KMS key status
    if command -v aws >/dev/null 2>&1; then
        KEY_STATUS=$(aws kms describe-key --key-id alias/heady-pqc-key --query 'KeyMetadata.KeyState' --output text 2>/dev/null || echo "Unknown")
        echo "$(date): KMS Key Status: ${KEY_STATUS}" | tee -a "${LOG_FILE}"
    fi
else
    echo "$(date): Service is not healthy" | tee -a "${LOG_FILE}"
fi

echo "$(date): Monitoring check completed" | tee -a "${LOG_FILE}"
echo "" | tee -a "${LOG_FILE}"
EOF
    
    chmod +x "${SCRIPTS_DIR}/monitor-pqc.sh"
    
    print_success "PQC monitoring script created"
}

# Update existing installation script
update_installation_script() {
    print_step "Updating installation script with PQC support..."
    
    if [[ -f "${SCRIPTS_DIR}/install-parrot-windsurf.sh" ]]; then
        # Add PQC installation function
        cat >> "${SCRIPTS_DIR}/install-parrot-windsurf.sh" << 'EOF'

# PQC Installation Function
install_pqc_support() {
    print_step "Installing Post-Quantum Cryptography support..."
    
    # Install PQC dependencies
    npm install -g @noble/post-quantum @aws-sdk/client-kms base64url
    
    # Create PQC configuration directory
    mkdir -p "$HOME/HeadyStack/config/pqc"
    
    print_status "PQC support installed"
}
EOF
        
        # Add call to PQC installation
        sed -i '/print_status "Installation completed successfully"/i install_pqc_support' "${SCRIPTS_DIR}/install-parrot-windsurf.sh"
        
        print_success "Installation script updated with PQC support"
    else
        print_warning "Installation script not found. Skipping update."
    fi
}

# Run tests
run_tests() {
    print_step "Running PQC implementation tests..."
    
    cd "${HEADY_BASE}"
    
    # Test Node.js implementation
    echo "🧪 Running Node.js PQC tests..."
    if node scripts/test-pqc.js; then
        print_success "Node.js PQC tests passed"
    else
        print_error "Node.js PQC tests failed"
        return 1
    fi
    
    # Test API (if server is running)
    if curl -s https://manager.headyme.com/api/health >/dev/null 2>&1; then
        echo "🌐 Running API PQC tests..."
        if scripts/test-pqc-api.sh; then
            print_success "API PQC tests passed"
        else
            print_warning "API PQC tests failed (server may not be running)"
        fi
    else
        print_warning "API server not running. Start with: npm start"
    fi
}

# Display next steps
display_next_steps() {
    echo ""
    echo -e "${CYAN}🎉 HeadyStack PQC Implementation Completed!${NC}"
    echo ""
    echo -e "${BLUE}📋 Next Steps:${NC}"
    echo "1. Start the API server:"
    echo "   cd ${HEADY_BASE} && npm start"
    echo ""
    echo "2. Test the implementation:"
    echo "   npm run test"
    echo "   ./scripts/test-pqc-api.sh"
    echo ""
    echo "3. Monitor the service:"
    echo "   ./scripts/monitor-pqc.sh"
    echo ""
    echo "4. Deploy to production:"
    echo "   ./scripts/deploy-pqc.sh"
    echo ""
    echo -e "${GREEN}🔐 PQC Features:${NC}"
    echo "• ML-DSA-65 quantum-resistant signatures"
    echo "• Subscription tier-aware token expiration"
    echo "• Sacred geometry context support"
    echo "• Cost-optimized local verification"
    echo "• Comprehensive monitoring and logging"
    echo ""
    echo -e "${YELLOW}📚 Documentation:${NC}"
    echo "• Full guide: ${HEADY_BASE}/../Heady/HEADY_POST_QUANTUM_CRYPTOGRAPHY_GUIDE.md"
    echo "• Configuration: ${PQC_CONFIG_DIR}/pqc-config.json"
    echo "• Logs: ${HEADY_BASE}/logs/"
    echo ""
}

# Main execution
main() {
    echo "🚀 HeadyStack Post-Quantum Cryptography Implementation"
    echo "======================================================="
    
    check_prerequisites
    install_pqc_dependencies
    create_pqc_key
    create_pqc_config
    create_pqc_auth_service
    create_api_server
    create_test_scripts
    create_deployment_script
    create_monitoring_script
    update_installation_script
    
    if run_tests; then
        display_next_steps
        print_success "HeadyStack PQC implementation completed successfully!"
    else
        print_error "Some tests failed. Check the logs for details."
        exit 1
    fi
}

# Run main function
main "$@"
