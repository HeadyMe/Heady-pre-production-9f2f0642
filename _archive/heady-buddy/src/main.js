// Simple main.js without electron app issues
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

console.log('Starting Heady Buddy Web App...');

// Create a simple HTTP server to serve the app
const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.url === '/') {
    // Serve the main HTML file
    const fs = require('fs');
    try {
      const html = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (error) {
      res.writeHead(404);
      res.end('Not Found');
    }
  } else if (req.url.startsWith('/api/')) {
    // Proxy to Heady services
    proxyRequest(req, res);
  } else {
    // Serve static files
    serveStatic(req, res);
  }
});

function proxyRequest(req, res) {
  const axios = require('axios');
  const targetHost = req.headers.host ? req.headers.host.replace('buddy.', 'api.') : 'api.headysystems.com';
  const targetUrl = `https://${targetHost}${req.url}`;

  console.log(`Proxying ${req.method} ${req.url} to ${targetUrl}`);

  if (req.method === 'GET') {
    axios.get(targetUrl)
      .then(response => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response.data));
      })
      .catch(error => {
        console.error('Proxy error:', error.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: error.message }));
      });
  } else if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        axios.post(targetUrl, data)
          .then(response => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response.data));
          })
          .catch(error => {
            console.error('Proxy error:', error.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: error.message }));
          });
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON' }));
      }
    });
  }
}

function serveStatic(req, res) {
  const fs = require('fs');
  const filePath = path.join(__dirname, '../dist', req.url);

  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    const contentType = {
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.html': 'text/html',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    }[ext] || 'text/plain';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (error) {
    res.writeHead(404);
    res.end('Not Found');
  }
}

// Mock storage
const storage = {
  data: {
    preferences: {
      theme: 'dark',
      defaultMode: 'admin-ide',
      autoStart: true
    },
    recentProjects: []
  },

  get: (key, defaultValue) => {
    return storage.data[key] || defaultValue;
  },

  set: (key, value) => {
    storage.data[key] = value;
    return true;
  }
};

// API endpoints for the web app
if (require.main === module) {
  const port = process.env.PORT || 5175;

  server.listen(port, () => {
    console.log(`Heady Buddy running on http://localhost:${port}`);
    console.log('Opening browser...');

    // Open browser
    const open = process.platform === 'darwin' ? 'open' :
      process.platform === 'win32' ? 'start' : 'xdg-open';

    spawn(open, [`http://localhost:${port}`], { stdio: 'ignore' });
  });
}

// Export for testing
module.exports = { server, storage };
