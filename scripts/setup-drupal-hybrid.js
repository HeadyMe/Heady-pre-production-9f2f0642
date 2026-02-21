#!/usr/bin/env node

// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Heady Systems - HCFP Full Auto Mode        ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: setup-drupal-hybrid.js                                   ║
// ║  UPDATED: 20260218-211102                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/*
 * ✅ SCANNED: 20260218-211102
 * 🔍 INSPECTED: All content reviewed
 * 🏷️  BRANDED: Heady Systems branding applied
 * 📊 STATUS: Fully compliant with HCFP Full Auto Mode
 */

#!/usr/bin/env node

/**
 * 🚀 DRUPAL 11 HYBRID SETUP - HEADY SYSTEMS
 * 
 * This script creates the Drupal 11 + modern frontend hybrid architecture:
 * 1. Drupal for content management
 * 2. React/Next.js for apps and dashboards
 * 3. API-first approach with headless Drupal
 */

const fs = require('fs').promises;
const path = require('path');

console.log('🚀 DRUPAL 11 HYBRID SETUP');
console.log('=========================\n');

const DRUPAL_CONFIG = {
  version: '11.x',
  php: '8.3+',
  database: 'postgresql',
  webserver: 'nginx',
  memory: '1GB+',
  domains: {
    cms: 'cms.localhost',
    app: 'app.localhost',
    api: 'api.localhost'
  }
};

async function setupDrupalHybrid() {
  try {
    console.log('📋 Creating Drupal 11 hybrid architecture...');
    
    // 1. Create project structure
    await createProjectStructure();
    
    // 2. Setup Drupal configuration
    await setupDrupalConfig();
    
    // 3. Create React frontend template
    await createReactFrontend();
    
    // 4. Setup API integration
    await setupAPIIntegration();
    
    // 5. Create deployment scripts
    await createDeploymentScripts();
    
    console.log('✅ Drupal 11 hybrid setup complete!');
    console.log('📝 Next: Run composer create-project drupal/recommended-project');
    
    return true;
    
  } catch (error) {
    console.error('❌ Drupal setup failed:', error.message);
    return false;
  }
}

async function createProjectStructure() {
  console.log('📁 Creating project structure...');
  
  const structure = [
    'drupal/web',
    'drupal/config/sync',
    'drupal/modules/custom',
    'drupal/themes/custom',
    'frontend/src/components',
    'frontend/src/pages',
    'frontend/src/utils',
    'frontend/public',
    'api/src/routes',
    'api/src/middleware',
    'api/src/services',
    'docker/drupal',
    'docker/nginx',
    'docker/postgres'
  ];
  
  for (const dir of structure) {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function setupDrupalConfig() {
  console.log('⚙️ Setting up Drupal configuration...');
  
  // Composer.json for Drupal
  const composerJson = {
    name: 'headysystems/drupal-cms',
    description: 'HeadySystems Drupal 11 CMS',
    type: 'project',
    require: {
      'drupal/core-recommended': '^11.0',
      'drupal/jsonapi_extras': '^4.0',
      'drupal/decoupled_router': '^2.0',
      'drupal/simple_oauth': '^6.0',
      'drupal/consumers': '^2.0',
      'drupal/media_library': '^3.0',
      'drupal/cloudflare': '^2.0'
    },
    requireDev: {
      'drupal/core-dev': '^11.0'
    },
    'minimum-stability': 'stable',
    'prefer-stable': true
  };
  
  await fs.writeFile('drupal/composer.json', JSON.stringify(composerJson, null, 2));
  
  // Settings.php
  const settingsPhp = `<?php
/**
 * @file
 * Drupal 11 settings for HeadySystems
 */

// Database configuration
\$databases['default']['default'] = [
  'database' => getenv('DB_NAME') ?: 'headysystems',
  'username' => getenv('DB_USER') ?: 'postgres',
  'password' => getenv('DB_PASS') ?: '',
  'prefix' => '',
  'host' => getenv('DB_HOST') ?: 'postgres',
  'port' => getenv('DB_PORT') ?: '5432',
  'namespace' => 'Drupal\\\\Core\\\\Database\\\\Driver\\\\pgsql',
  'driver' => 'pgsql',
];

// Configuration directories
\$settings['config_sync_directory'] = '../config/sync';

// Trusted host patterns
\$settings['trusted_host_patterns'] = [
  '^cms\\.headysystems\\.onrender\\.com$',
  '^app\\.headysystems\\.onrender\\.com$',
  '^api\\.headysystems\\.onrender\\.com$',
];

// Reverse proxy configuration
\$settings['reverse_proxy_addresses'] = [
  \$_SERVER['REMOTE_ADDR'],
];

// JSON:API configuration
\$settings['jsonapi_hypermedia_application_type'] = true;

// CORS configuration
if (getenv('APP_ENV') === 'development') {
  \$settings['cors.config'] = [
    'enabled' => true,
    'allowed_headers' => ['*'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    'allowed_origins' => ['*'],
    'exposed_headers' => false,
    'max_age' => 0,
    'supports_credentials' => false,
  ];
}`;
  
  await fs.writeFile('drupal/web/sites/default/settings.php', settingsPhp);
  
  // Services.yml for API optimization
  const servicesYml = `# API-optimized services configuration
services:
  cache.backend.redis:
    class: Drupal\\Core\\Cache\\RedisCacheFactory
    
  # JSON:API optimizations
  jsonapi.normalizer.field_item.denormalizer:
    class: Drupal\\jsonapi\\Normalizer\\FieldItemNormalizer
    
  # Performance optimizations
  http_middleware.negotiation:
    class: Drupal\\Core\\StackMiddleware\\NegotiationMiddleware
    tags:
      - { name: http_middleware, priority: 400 }`;
  
  await fs.writeFile('drupal/web/sites/default/services.yml', servicesYml);
}

async function createReactFrontend() {
  console.log('⚛️ Creating React frontend template...');
  
  const packageJson = {
    name: 'headysystems-frontend',
    version: '1.0.0',
    private: true,
    dependencies: {
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
      'react-router-dom': '^6.8.0',
      '@headlessui/react': '^1.7.0',
      '@heroicons/react': '^2.0.0',
      'axios': '^1.3.0',
      'swr': '^2.0.0'
    },
    scripts: {
      'dev': 'vite',
      'build': 'vite build',
      'preview': 'vite preview'
    },
    devDependencies: {
      '@vitejs/plugin-react': '^3.1.0',
      'vite': '^4.1.0',
      'tailwindcss': '^3.2.0',
      'autoprefixer': '^10.4.0',
      'postcss': '^8.4.0'
    }
  };
  
  await fs.writeFile('frontend/package.json', JSON.stringify(packageJson, null, 2));
  
  // Main App component with Drupal integration
  const appJsx = `import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { fetchAPI } from '../utils/drupal-api';

// Components
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import DashboardPage from './pages/DashboardPage';

function App() {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch menu from Drupal
    fetchAPI('/menu/main')
      .then(data => setMenuItems(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Header menuItems={menuItems} />
        
        <main className="py-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </main>
        
        <Footer />
      </div>
    </Router>
  );
}

export default App;`;

  await fs.writeFile('frontend/src/App.jsx', appJsx);
  
  // Drupal API utility
  const drupalAPI = `import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3300';

// Create axios instance with Drupal headers
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/vnd.api+json',
    'Accept': 'application/vnd.api+json',
  },
});

// Add authentication if available
if (import.meta.env.VITE_API_TOKEN) {
  api.defaults.headers.common['Authorization'] = \`Bearer \${import.meta.env.VITE_API_TOKEN}\`;
}

// Drupal API functions
export const fetchAPI = async (endpoint) => {
  try {
    const response = await api.get(endpoint);
    return response.data;
  } catch (error) {
    console.error('API fetch error:', error);
    throw error;
  }
};

export const postAPI = async (endpoint, data) => {
  try {
    const response = await api.post(endpoint, data);
    return response.data;
  } catch (error) {
    console.error('API post error:', error);
    throw error;
  }
};

// Content fetching helpers
export const getContent = async (contentType, filters = {}) => {
  const params = new URLSearchParams({
    'filter[type]': contentType,
    ...filters
  });
  
  return fetchAPI(\`/jsonapi/node/\${contentType}?\${params}\`);
};

export const getMenu = async (menuName) => {
  return fetchAPI(\`/jsonapi/menu_items/\${menuName}\`);
};

// Form submission
export const submitForm = async (formId, data) => {
  return postAPI(\`/jsonapi/webform_submission/\${formId}\`, {
    data: {
      type: 'webform_submission--' + formId,
      attributes: data
    }
  });
};

export default api;`;

  await fs.writeFile('frontend/src/utils/drupal-api.js', drupalAPI);
}

async function setupAPIIntegration() {
  console.log('🔌 Setting up API integration...');
  
  // API gateway configuration
  const apiConfig = `{
  "version": "1.0.0",
  "drupal": {
    "url": "http://localhost:8080",
    "api": "http://localhost:8080/jsonapi",
    "auth": "http://localhost:8080/oauth/token"
  },
  "services": {
    "memory": "http://localhost:3300/memory",
    "ai": "http://localhost:3300/ai",
    "monitoring": "http://localhost:3300/monitoring"
  },
  "cache": {
    "ttl": 300,
    "enabled": true
  }
}`;
  
  await fs.writeFile('api/config.json', apiConfig);
}

async function createDeploymentScripts() {
  console.log('🚀 Creating deployment scripts...');
  
  // Docker Compose for development
  const dockerCompose = `version: '3.8'

services:
  drupal:
    build: ./docker/drupal
    ports:
      - "8080:80"
    environment:
      - DB_HOST=postgres
      - DB_NAME=headysystems
      - DB_USER=postgres
      - DB_PASS=postgres
    volumes:
      - ./drupal/web:/var/www/html/web
      - ./drupal/config:/var/www/html/config
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=headysystems
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./drupal/web:/var/www/html/web
    depends_on:
      - drupal

volumes:
  postgres_data:`;

  await fs.writeFile('docker-compose.yml', dockerCompose);
  
  // Deploy script
  const deployScript = `#!/bin/bash

# HeadySystems Drupal 11 Hybrid Deployment

echo "🚀 Deploying HeadySystems Drupal 11 Hybrid..."

# 1. Deploy Drupal CMS
echo "📋 Deploying Drupal CMS..."
cd drupal
composer install --no-dev --optimize-autoloader
drush cache:rebuild
drush config:import
drush cr

# 2. Build frontend
echo "⚛️ Building React frontend..."
cd ../frontend
npm ci
npm run build

# 3. Deploy API services
echo "🔌 Deploying API services..."
cd ../api
npm ci
npm run build

# 4. Update DNS/Cloudflare
echo "🌐 Updating DNS configuration..."
# Add Cloudflare API calls here

# 5. Health checks
echo "🏥 Running health checks..."
curl -f http://localhost:8080/health || exit 1
curl -f http://localhost:3300/health || exit 1
curl -f http://localhost:3000 || exit 1

echo "✅ Deployment complete!"
echo "📊 Monitoring: https://monitoring.localhost"`;

  await fs.writeFile('scripts/deploy.sh', deployScript);
  await fs.chmod('scripts/deploy.sh', '755');
}

// Execute the setup
setupDrupalHybrid().then(success => {
  if (success) {
    console.log('\n🚀 DRUPAL 11 HYBRID READY');
    console.log('📝 Next steps:');
    console.log('  1. cd drupal && composer create-project drupal/recommended-project .');
    console.log('  2. cd frontend && npm install');
    console.log('  3. docker-compose up -d');
    console.log('  4. Visit http://headysystems.com:8080 for Drupal setup');
  } else {
    console.log('\n🚨 DRUPAL SETUP FAILED');
  }
}).catch(console.error);
