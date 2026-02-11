<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: README-DEPLOYMENT.md                                                    ║
<!-- ║  LAYER: root                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# Heady Systems Production Deployment Guide
# Complete deployment instructions for the localhost-free domain architecture

## Quick Start

### One-Command Production Setup
```bash
# Clone the repository
git clone https://github.com/HeadySystems/Heady.git
cd Heady

# Run the production setup script
sudo bash scripts/setup-production-domain-system.sh

# Include local development (optional)
sudo bash scripts/setup-production-domain-system.sh --include-local
```

## Architecture Overview

Heady Systems uses a **reverse proxy architecture** that completely eliminates localhost and internal IP exposure:

```
Internet → Cloudflare Tunnel → Backend Applications
    ↓              ↓                ↓
HTTPS Only    Security Headers    Internal Ports
```

### Key Benefits
- **No localhost exposure** in any user-facing content
- **HTTPS everywhere** with valid SSL certificates
- **Security headers** applied automatically
- **Consistent domains** across all environments
- **Production-ready** configuration out of the box

## Domain Structure

### Primary Domains
- **Nonprofit**: `https://headyconnection.org`
- **Commercial**: `https://headysystems.com`
- **Program**: `https://headybuddy.org`

### API Endpoints
- **Commercial API**: `https://api.headysystems.com`
- **Nonprofit API**: `https://api.headyconnection.org`
- **Applications**: `https://app.headysystems.com`

### Development
- **Local**: `http://*.heady.local` (via /etc/hosts)
- **Staging**: `https://staging.headysystems.com`

## Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04+ or Debian 11+
- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: 20GB minimum
- **Network**: Public IP with ports 80/443 accessible

### DNS Configuration
Point these domains to your server IP:
```
headysystems.com
www.headysystems.com
api.headysystems.com
app.headysystems.com
admin.headysystems.com
headyconnection.org
www.headyconnection.org
api.headyconnection.org
headybuddy.org
www.headybuddy.org
```

## Cloudflare Tunnel Deployment

### 1. Install Cloudflared
```bash
# Download and install cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
```

### 2. Configure Tunnel
```bash
# Authenticate and create tunnel
cloudflared tunnel login
cloudflared tunnel create heady-tunnel

# Configure ingress rules
cat > ~/.cloudflared/config.yml <<EOL
tunnel: <TUNNEL-ID>
credentials-file: ~/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: api.headymcp.com
    service: http://localhost:3300
  - hostname: app.headymcp.com
    service: http://localhost:3000
  - service: http_status:404
EOL
```

### 3. Run Tunnel
```bash
# Run as systemd service
cloudflared service install
systemctl start cloudflared
```

### 4. Update DNS
In Cloudflare DNS, point your domains to the tunnel:
```
api.headymcp.com CNAME <TUNNEL-ID>.cfargotunnel.com
app.headymcp.com CNAME <TUNNEL-ID>.cfargotunnel.com
```

## Application Deployment

### Backend Applications
Your applications should listen on the internal ports defined in `upstreams.conf`:

- **HeadySystems API**: Port 8000
- **HeadySystems App**: Port 3000
- **HeadySystems Admin**: Port 3001
- **HeadyConnection API**: Port 8001
- **HeadyConnection App**: Port 3002
- **HeadyBuddy Backend**: Port 4000

### Example: Python Application
```python
# app.py
from flask import Flask

app = Flask(__name__)

@app.route('/health')
def health():
    return {"status": "healthy", "service": "headysystems-api"}

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8000)
```

### Example: Node.js Application
```javascript
// server.js
const express = require('express');
const app = express();

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'headysystems-app' });
});

app.listen(3000, '127.0.0.1');
```

### Systemd Service Example
```ini
# /etc/systemd/system/headysystems-api.service
[Unit]
Description=HeadySystems API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/headysystems.com
Environment=FLASK_ENV=production
Environment=PORT=8000
ExecStart=/usr/bin/python3 /var/www/headysystems.com/app.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl enable headysystems-api.service
sudo systemctl start headysystems-api.service
```

## Local Development Setup

### 1. Configure /etc/hosts
Add these entries to your local `/etc/hosts` (Linux/Mac) or `C:\Windows\System32\drivers\etc\hosts` (Windows):

```bash
# From configs/local-development/hosts-file
127.0.0.1 app.heady.local
127.0.0.1 api.heady.local
127.0.0.1 admin.heady.local
127.0.0.1 buddy.heady.local
127.0.0.1 connection.heady.local
127.0.0.1 systems.heady.local
```

### 2. Enable Local Development Site
```bash
# Copy local development config
sudo cp configs/nginx/sites-available/local-dev.conf /etc/nginx/sites-available/

# Enable the site
sudo ln -s /etc/nginx/sites-available/local-dev.conf /etc/nginx/sites-enabled/

# Reload nginx
sudo nginx -t && sudo systemctl reload nginx
```

### 3. Test Local Development
```bash
# Test the local domains
curl http://app.heady.local/health
curl http://api.heady.local/health
```

## Internal mTLS Configuration

For secure internal communication behind Cloudflare Tunnel:

1. **Generate Certificates**:
```bash
cd scripts
./generate-mtls-certs.ps1
```

2. **Configure Nginx**:
```bash
# Copy config and certificates
sudo cp configs/nginx/mtls.conf /etc/nginx/conf.d/
sudo mkdir -p /etc/nginx/ssl
sudo cp configs/nginx/ssl/* /etc/nginx/ssl/
```

3. **Set Up Cloudflare Tunnel**:
```bash
# Install and configure cloudflared
sudo cp configs/cloudflared/ingress-rules.yaml /etc/cloudflared/config.yaml
sudo cp configs/nginx/ssl/ca.crt /etc/cloudflared/
sudo cp configs/nginx/ssl/client.pem /etc/cloudflared/
sudo cp configs/nginx/ssl/client.key /etc/cloudflared/

# Start services
sudo systemctl enable nginx-mtls
sudo systemctl enable cloudflared
```

4. **Verify Connection**:
```bash
curl --cert configs/nginx/ssl/client.pem --key configs/nginx/ssl/client.key \
    https://api.internal.headymcp.com/health
```

## PyCharm Integration

### 1. Import Deployment Configuration
1. Open PyCharm
2. Go to `File > Settings > Build, Execution, Deployment > Deployment`
3. Import `configs/pycharm/deployment.xml`

### 2. Configure Remote Interpreter
1. Go to `File > Settings > Project > Python Interpreter`
2. Add SSH Interpreter pointing to your server
3. Set Python path to `/usr/bin/python3`
4. Set virtual environment to `/var/www/headysystems.com/venv`

### 3. Set Up Run Configurations
1. Ensure staging tests pass
2. Import run configurations from the deployment XML file for:
- Production environment
- Staging environment  
- Local development

### HCFullPipeline (HCFP) Deployment Flow

All deployments now follow the HCFullPipeline (HCFP) master protocol. Skip ad-hoc manual checks—assume the workflow in `.windsurf/workflows/hcfp-master-protocol.md` and its child flows (`hcfp-clean-build`, `hcfp-error-recovery`, `hcfp-localhost-domain-migration`, etc.) is the single source of truth.

1. Start from the `hcfp-master-protocol` plan and confirm each step is signed off before proceeding.
2. Use the `scripts/checkpoint-sync.ps1` and `scripts/validate-localhost.sh` helpers only when HCFP explicitly asks for them (HCFP gates are the verification path).
3. Keep `heady-registry.json`, `.heady/stories.json`, and workflow artifacts in sync before checkout or release.

### Workspace Files + Documentation Sync

- When touching other workspace-specific files (e.g., `.windsurf/workflows`, `configs/pycharm`, `docs/BRAND_ARCHITECTURE_GUIDE.md`), add matching registry + documentation edits so the checkpoint protocol remains satisfied.
- Use the `heady-registry.json` to capture new entries, and re-run `scripts/checkpoint-sync.ps1` in `full` mode as part of the HCFP flow.

## Security Configuration

### SSL/TLS
- **Certificates**: Cloudflare-managed
- **Protocols**: TLS 1.2 and 1.3 only
- **Ciphers**: Modern, secure cipher suite
- **HSTS**: Enabled with preload

### Security Headers
All sites include:
- **Content Security Policy**: Prevents XSS attacks
- **HSTS**: Enforces HTTPS
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing
- **Referrer Policy**: Controls referrer information

### Firewall Rules
- **SSH**: Port 22 (restricted to your IP if possible)
- **HTTP/HTTPS**: Ports 80/443 (Cloudflare-managed)
- **All other ports**: Denied by default

## Monitoring and Maintenance

### Health Checks
```bash
# Check site health
curl https://headysystems.com/health
curl https://api.headysystems.com/health

# Check cloudflared status
cloudflared tunnel status
```

### Log Locations
- **Cloudflare Access**: `/var/log/cloudflared/access.log`
- **Cloudflare Error**: `/var/log/cloudflared/error.log`
- **Application Logs**: `/var/log/headysystems/`

### Log Rotation
Logs are automatically rotated by the configuration in `/etc/logrotate.d/heady-systems`.

### SSL Certificate Renewal
Certificates are automatically renewed by Cloudflare.

## Troubleshooting

### Common Issues

#### 1. SSL Certificate Issues
```bash
# Check certificate status
cloudflared tunnel certificate

# Check cloudflared SSL config
cloudflared tunnel config
```

#### 2. Application Not Responding
```bash
# Check if application is running
sudo netstat -tlnp | grep :8000

# Check application logs
sudo journalctl -u headysystems-api.service

# Restart application
sudo systemctl restart headysystems-api.service
```

#### 3. Cloudflare Configuration Errors
```bash
# Test cloudflared configuration
cloudflared tunnel config

# Check cloudflared error log
sudo tail -f /var/log/cloudflared/error.log

# Reload cloudflared
sudo systemctl reload cloudflared
```

#### 4. Domain Not Resolving
```bash
# Check DNS resolution
nslookup headysystems.com

# Check cloudflared is listening
sudo netstat -tlnp | grep :443

# Check firewall status
sudo ufw status
```

### Performance Optimization

#### 1. Enable Caching
```bash
# Add to cloudflared config
cat > ~/.cloudflared/config.yml <<EOL
tunnel: <TUNNEL-ID>
credentials-file: ~/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: api.headymcp.com
    service: http://localhost:3300
    cache:
      - cacheTtl: 1h
        cacheKey: url
EOL
```

#### 2. Enable Gzip Compression
Already configured in the main cloudflared.conf.

#### 3. Optimize Worker Connections
```bash
# In cloudflared.conf
num_workers: 4
```

## Validation and Testing

### Automated Validation
Run the localhost validation script:
```bash
bash scripts/validate-localhost.sh
```

### Manual Testing Checklist
- [ ] All domains resolve correctly
- [ ] SSL certificates are valid
- [ ] HTTPS redirects work
- [ ] Applications respond on correct ports
- [ ] Security headers are present
- [ ] Health endpoints return 200
- [ ] No localhost references in responses

### Load Testing
```bash
# Install Apache Bench
sudo apt install -y apache2-utils

# Test API endpoint
ab -n 1000 -c 10 https://api.headysystems.com/health

# Test main site
ab -n 1000 -c 10 https://headysystems.com/
```

## Backup and Recovery

### Configuration Backup
```bash
# Backup cloudflared configuration
sudo tar -czf cloudflared-config-backup.tar.gz ~/.cloudflared/

# Backup web directories
sudo tar -czf web-backup.tar.gz /var/www/
```

### Disaster Recovery
1. Restore cloudflared configuration
2. Restore web directories
3. Restart services
4. Test all endpoints

## Scaling Considerations

### Load Balancing
For high-traffic deployments, consider:
- Multiple backend servers
- Cloudflare load balancing configuration
- Database replication
- CDN integration

### Database Scaling
- Read replicas for read-heavy applications
- Connection pooling
- Query optimization
- Regular backups

## Support

### Documentation
- **URL Style Guide**: `docs/URL_DOMAIN_STYLE_GUIDE.md`
- **Brand Architecture**: `docs/BRAND_ARCHITECTURE_GUIDE.md`
- **Domain Configuration**: `configs/domain-architecture.yaml`

### Community
- **GitHub Issues**: Report bugs and request features
- **Discussions**: Ask questions and share experiences
- **Wiki**: Community-maintained documentation

### Professional Support
For enterprise support, contact:
- **Email**: support@headysystems.com
- **Phone**: +1-555-HEADY-1
- **Chat**: https://headysystems.com/support

---

This deployment guide provides everything needed to run Heady Systems in production with zero localhost exposure and enterprise-grade security.
