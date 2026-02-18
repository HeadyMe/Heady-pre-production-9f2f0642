#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# 🚀 HEADY PRODUCTION DEPLOYMENT SCRIPT
# ═══════════════════════════════════════════════════════════════
# Check Heady Manager
if curl -sf https://manager.headyme.com/api/health > /dev/null; then
    echo "✅ Heady Manager is healthy"
else
    echo "❌ Heady Manager health check failed"
    docker-compose -f docker-compose.production.yml logs heady-manager
    exit 1
fi

# Check Drupal CMS
if curl -sf https://cms.headyconnection.org/admin/health > /dev/null; then
    echo "✅ Drupal CMS is healthy"
else
    echo "❌ Drupal CMS health check failed"
    docker-compose -f docker-compose.production.yml logs heady-drupal-cms
    exit 1
fi

# Check Next.js Frontend
if curl -sf https://app.headyconnection.org/api/health > /dev/null; then
    echo "✅ Next.js Frontend is healthy"
else
    echo "❌ Next.js Frontend health check failed"
    docker-compose -f docker-compose.production.yml logs heady-nextjs-frontend
    exit 1
fi

# Test API endpoints
echo "🧪 Testing API endpoints..."

# Test Socratic endpoint
socratic_test=$(curl -s -X POST https://manager.headyme.com/api/socratic/question \
  -H "Content-Type: application/json" \
  -d '{"request": "Hello"}' | jq -r '.name // "error"')
if [ "$socratic_test" = "SOCRATES" ]; then
    echo "✅ Socratic API working"
else
    echo "⚠️  Socratic API may need initialization"
fi

# Test Conductor endpoint
conductor_test=$(curl -s https://manager.headyme.com/api/conductor/status | jq -r '.name // "error"')
if [ "$conductor_test" = "CONDUCTOR" ]; then
    echo "✅ Conductor API working"
else
    echo "⚠️  Conductor API may need initialization"
fi

# Test All-Nodes endpoint
nodes_test=$(curl -s https://manager.headyme.com/api/all-nodes/status | jq -r '.name // "error"')
if [ "$nodes_test" = "AllNodeOrchestrator" ]; then
    echo "✅ All-Nodes API working"
else
    echo "⚠️  All-Nodes API may need initialization"
fi

# Create production environment file
echo "⚙️  Creating production environment..."
cat > .env.production << EOF
NODE_ENV=production
PORT=3300
HEADY_API_KEY=${HEADY_SECRET_API_KEY}
OPENAI_API_KEY=${OPENAI_KEY}
ANTHROPIC_API_KEY=${ANTHROPIC_KEY}
GOOGLE_AI_KEY=${GOOGLE_AI_KEY}
DATABASE_URL=postgresql://heady:${DB_PASSWORD}@manager.headyme.com:5432/heady
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
SOCRATIC_MODE=true
CONDUCTOR_DEFAULT_STRATEGY=consensus
ALL_NODES_ENABLED=true
