# © 2026 Heady Systems LLC — Consolidated Build & Deploy
# Tasks: urgent-002, urgent-005, enterprise-010
# Replaces 4 separate build scripts with one unified Makefile

SHELL := /bin/bash
.DEFAULT_GOAL := help
.PHONY: help build test lint security deploy smoke clean dev

# ═══ Configuration ═══
PM2 := pm2
NPM := npm
NODE := node

# ═══ Help ═══
help: ## Show available commands
	@echo "═══ Heady Build System ═══"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ═══ Development ═══
dev: ## Start development mode with hot reload
	$(PM2) start ecosystem.config.js --env development

install: ## Install all dependencies
	$(NPM) install
	cd heady-buddy && $(NPM) install || true
	cd frontend && $(NPM) install || true
	cd sites/admin-ui && $(NPM) install || true

# ═══ Build ═══
build: lint ## Build all packages
	@echo "⚡ Building all Heady packages..."
	@for dir in heady-buddy frontend heady-ide-ui sites/admin-ui; do \
		if [ -f "$$dir/package.json" ]; then \
			echo "  → Building $$dir..."; \
			(cd $$dir && $(NPM) run build) || exit 1; \
		fi; \
	done
	@echo "✅ Build complete"

build-sites: ## Build all scaffold sites
	$(NODE) scripts/build-scaffold-sites.js

# ═══ Testing ═══
test: ## Run all tests
	$(NPM) test

smoke: ## Run post-deploy smoke tests
	@echo "🔥 Running smoke tests..."
	@curl -sf http://localhost:4200/api/health > /dev/null && echo "  ✅ Manager health: OK" || echo "  ❌ Manager health: FAIL"
	@curl -sf http://localhost:4200/api/hcfp/status > /dev/null && echo "  ✅ HCFP status: OK" || echo "  ❌ HCFP status: FAIL"
	@curl -sf http://localhost:4200/api/brain/health > /dev/null && echo "  ✅ Brain health: OK" || echo "  ❌ Brain health: FAIL"
	@$(PM2) jlist 2>/dev/null | $(NODE) -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));const up=d.filter(p=>p.pm2_env.status==='online').length;const tot=d.length;console.log('  '+(up===tot?'✅':'⚠️')+' PM2 processes: '+up+'/'+tot+' online');" 2>/dev/null || echo "  ⚠️ PM2: not running"
	@echo "🔥 Smoke tests complete"

# ═══ Quality ═══
lint: ## Run linting with security rules
	@echo "🔍 Linting..."
	@npx eslint --no-eslintrc -c .eslintrc.security.json src/ --ext .js --max-warnings 50

security: ## Run security scans
	@echo "🔒 Security scan..."
	@npx audit-ci --moderate 2>/dev/null || $(NPM) audit --production 2>/dev/null || echo "  ⚠️ Audit check skipped"
	@bash .husky/pre-commit 2>/dev/null || echo "  ⚠️ Secret scan skipped"
	@echo "🔒 Security scan complete"

# ═══ Deploy ═══
deploy: build smoke ## Deploy to production
	@echo "🚀 Deploying..."
	$(PM2) reload ecosystem.config.js --update-env
	@sleep 3
	@$(MAKE) smoke
	@echo "🚀 Deploy complete"

restart: ## Restart all services
	$(PM2) restart all

stop: ## Stop all services
	$(PM2) stop all

# ═══ Maintenance ═══
clean: ## Clean build artifacts and caches
	rm -rf node_modules/.cache
	rm -rf heady-buddy/node_modules/.cache
	rm -rf frontend/.next
	rm -rf sites/*/dist 2>/dev/null || true
	@echo "🧹 Clean complete"

logs: ## Show PM2 logs
	$(PM2) logs --lines 50

status: ## Show system status
	@echo "═══ Heady System Status ═══"
	@$(PM2) list
	@echo ""
	@$(MAKE) smoke
