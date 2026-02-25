<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# 🚀 Heady Systems - Complete Production Deployment

## 📋 Overview
This deployment package provides everything needed to launch the complete Heady ecosystem with:
- ✅ Production-ready websites for all 6 domains
- ✅ Drupal 11 admin interface with full system control
- ✅ Cloudflare WARP integration for zero-trust security
- ✅ Cross-domain navigation and HeadyBuddy sync
- ✅ Real-time monitoring and one-click deployments

## 🌐 Domains Included
- **HeadyBuddy.org** - AI Companion & Cross-Device Launcher
- **HeadySystems.com** - Commercial Platform  
- **HeadyConnection.org** - Nonprofit Mission
- **HeadyMCP.com** - Model Context Protocol Server
- **HeadyIO.com** - Developer Platform
- **HeadyMe.com** - Personal Cloud

## ⚡ Quick Start

### 1. Environment Setup
```bash
# Copy and configure environment variables
cp .env.example .env
# Edit .env with your actual credentials
```

### 2. Deploy All Websites
```bash
# Deploy all domains with production builds
./deploy-all-heady-domains.sh

# Deploy with WARP security (recommended)
./deploy-all-heady-domains.sh --with-warp
```

### 3. Setup WARP Tunnel (Optional but Recommended)
```bash
# Creates secure internal network
./setup-warp-tunnel.sh
```

### 4. Launch Drupal Admin
```bash
cd drupal
docker-compose up -d

# Install Drupal (first time only)
docker-compose exec drupal drush site:install standard \
  --db-url=postgresql://heady:$DB_PASSWORD@db/heady_admin \
  --account-name=admin \
  --account-pass=$ADMIN_PASSWORD \
  --site-name="Heady Control Center" \
  -y

# Enable custom module
docker-compose exec drupal drush en heady_control -y
docker-compose exec drupal drush cr
```

## 🔧 Configuration Required

### Cloudflare Setup
1. **API Token**: Generate at https://dash.cloudflare.com/profile/api-tokens
   - Permissions: Zone:Zone:Read, Zone:DNS:Edit, Account:Cloudflare Pages:Edit
   - Zone Resources: Include all your domains

2. **Custom Domains**: Add each domain in Cloudflare Pages dashboard
   - Go to Workers & Pages → Your Project → Custom domains
   - Add: headybuddy.org, headysystems.com, etc.

3. **WARP Zero Trust** (Optional but Recommended):
   - Set up team at https://dash.cloudflare.com/signup/teams
   - Configure device enrollment and access policies

### GitHub Setup (For Deployments)
```bash
# Create Personal Access Token
# Settings → Developer settings → Personal access tokens
# Permissions: repo, workflow
export GITHUB_TOKEN=your_token_here
```

## 🎛️ Drupal Admin Features

Once deployed, access **https://admin.headysystems.com** for:

### Live Dashboard
- **Service Monitoring**: Real-time status of all Heady services
- **Domain Health**: SSL certificates, response times, uptime
- **Pipeline Status**: HCFullPipeline visualization
- **WARP Network**: Active connections, device management

### Quick Actions
- 🔄 Full System Sync
- 🚀 Deploy All Domains  
- 🔨 Clean Build All
- 🏥 Health Check
- 📋 View Logs
- 🔄 Restart Services

### HeadyBuddy Control
- Cross-device sync management
- Active session monitoring
- Cache control
- Connection testing

## 🔐 WARP Security Benefits

When enabled, WARP provides:
- **Zero Trust Security**: All traffic encrypted through Cloudflare
- **Private Network**: Internal APIs not exposed publicly
- **30-50% Faster**: Argo Smart Routing reduces latency
- **DDoS Protection**: Automatic mitigation at edge
- **Device Management**: Enroll devices for secure access

## 📁 File Structure

```
/home/headyme/
├── deploy-all-heady-domains.sh    # Main deployment script
├── setup-warp-tunnel.sh           # WARP tunnel setup
├── .env.example                   # Environment variables template
├── drupal/                        # Drupal 11 admin interface
│   ├── docker-compose.yml
│   └── web/modules/custom/heady_control/
├── headybuddy/                    # Built website (after deployment)
├── headysystems/                  # Built website (after deployment)
├── headyconnection/               # Built website (after deployment)
├── headymcp/                      # Built website (after deployment)
├── headyio/                       # Built website (after deployment)
└── headyme/                       # Built website (after deployment)
```

## 🌟 Cross-Domain Features

All websites include:
- **Universal Navigation**: Seamless links between all Heady domains
- **HeadyBuddy Sync**: Cross-device context sharing
- **WARP Integration**: Automatic secure routing when available
- **Responsive Design**: Works on desktop, tablet, mobile
- **Production Optimized**: Minified, cached, CDN-ready

## 📊 Monitoring & Analytics

### Built-in Metrics
- Response time monitoring
- SSL certificate status
- Service health checks
- User session tracking
- Cross-domain navigation analytics

### External Integrations
- Cloudflare Analytics
- Drupal logging system
- WARP connection metrics
- GitHub deployment tracking

## 🚨 Troubleshooting

### Common Issues

**Websites not loading:**
1. Check Cloudflare DNS settings
2. Verify custom domain configuration in Cloudflare Pages
3. Check SSL certificate status

**Deployments failing:**
1. Verify GitHub token permissions
2. Check repository names match configuration
3. Ensure build scripts are executable

**WARP connection issues:**
1. Verify cloudflared installation
2. Check tunnel token validity
3. Ensure firewall allows outbound connections

**Drupal admin not accessible:**
1. Check Docker containers are running
2. Verify database connection
3. Ensure port 8080 is available

### Debug Commands
```bash
# Check deployment status
./deploy-all-heady-domains.sh

# Test WARP tunnel
cloudflared tunnel list

# Check Drupal status
cd drupal && docker-compose ps

# View logs
docker-compose logs -f
```

## 🔄 Maintenance

### Regular Tasks
- **Weekly**: Update dependencies, check SSL certificates
- **Monthly**: Review WARP access policies, rotate secrets
- **Quarterly**: Update Drupal core, review security settings

### Backup Strategy
- **Drupal Database**: Automated daily backups
- **Configuration**: Version controlled in Git
- **SSL Certificates**: Managed by Cloudflare
- **WARP Config**: Backed up in cloudflared/

## 📞 Support

### Documentation
- **Drupal Admin**: Built-in help system
- **API Documentation**: Available at each domain's /api/docs
- **WARP Guide**: https://developers.cloudflare.com/warp/

### Monitoring
- **System Status**: Drupal dashboard
- **Performance**: Cloudflare Analytics
- **Security**: WARP device management

## ✅ Success Criteria

Your deployment is successful when:
- [ ] All 6 domains load without errors
- [ ] Cross-domain navigation works seamlessly
- [ ] Drupal admin dashboard shows all services online
- [ ] WARP tunnel is running (if enabled)
- [ ] HeadyBuddy sync functions across devices
- [ ] One-click deployments work from Drupal admin

## 🎉 Next Steps

After successful deployment:
1. **Configure Monitoring**: Set up alerts for downtime
2. **User Testing**: Test cross-device HeadyBuddy functionality
3. **Performance Tuning**: Optimize based on real usage metrics
4. **Security Review**: Audit WARP policies and access controls
5. **Documentation**: Create user guides for your team

---

**🚀 Your Heady ecosystem is now production-ready with enterprise-grade security, monitoring, and cross-domain integration!**
