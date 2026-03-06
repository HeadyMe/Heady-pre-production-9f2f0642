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
<!-- ║  FILE: configs/pycharm/pycharm-setup-guide.md                                                    ║
<!-- ║  LAYER: config                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# Heady Systems PyCharm Setup Guide
# Production-ready PyCharm configuration for Heady development

## Quick Setup

### 1. Import Deployment Configuration
1. Open PyCharm
2. Go to `File > Settings > Build, Execution, Deployment > Deployment`
3. Click `Import` and select `configs/pycharm/deployment.xml`
4. Configure SSH keys for each server

### 2. Configure Remote Interpreters
1. Go to `File > Settings > Project > Python Interpreter`
2. Click `Add > SSH Interpreter`
3. Use the SSH credentials from deployment.xml
4. Set Python path to `/usr/bin/python3`
5. Set virtual environment to `/var/www/headysystems.com/venv`

### 3. Set Up Run/Debug Configurations
1. Go to `Run > Edit Configurations`
2. Import the configurations from deployment.xml
3. Set environment variables for each environment
4. Test each configuration

## Environment-Specific Setup

### Production Environment
- **Server**: headysystems.com
- **Python**: `/usr/bin/python3`
- **Virtual Env**: `/var/www/headysystems.com/venv`
- **Settings**: `heady.settings.production`
- **Domain**: https://headysystems.com
- **Database**: PostgreSQL on headysystems.com

### Staging Environment
- **Server**: staging.headysystems.com
- **Python**: `/usr/bin/python3`
- **Virtual Env**: `/var/www/staging.headysystems.com/venv`
- **Settings**: `heady.settings.staging`
- **Domain**: https://staging.headysystems.com
- **Database**: PostgreSQL on staging.headysystems.com

### Local Development
- **Server**: Local machine
- **Python**: `./venv/Scripts/python.exe`
- **Virtual Env**: `./venv`
- **Settings**: `heady.settings.local`
- **Domain**: http://app.heady.local
- **Database**: SQLite (./db.sqlite3)

## SSH Key Setup

### Generate SSH Key
```bash
ssh-keygen -t ed25519 -C "erich@headysystems.com"
```

### Add to Servers
```bash
ssh-copy-id deploy@headysystems.com
ssh-copy-id deploy@staging.headysystems.com
```

### Configure PyCharm
1. Go to `File > Settings > SSH Configurations`
2. Add each server with your private key
3. Test connection to ensure access

## Deployment Workflow

### 1. Development
- Use local configuration
- Test with `app.heady.local` domains
- Commit changes to Git

### 2. Staging Deployment
1. Right-click project > `Deployment > Upload to Staging`
2. Run migrations on staging server
3. Test functionality on staging.headysystems.com

### 3. Production Deployment
1. Ensure staging tests pass
2. Right-click project > `Deployment > Upload to Production`
3. Run migrations on production server
4. Verify functionality on headysystems.com

## Debugging Remote Issues

### 1. Remote Debugging
1. Set up remote interpreter
2. Install PyCharm helpers on server
3. Use breakpoints as normal
4. Debug runs on remote server

### 2. Log Monitoring
1. Use PyCharm's `Log Files` tab
2. Add remote log paths:
   - `/var/log/nginx/headysystems.com-access.log`
   - `/var/log/nginx/headysystems.com-error.log`
   - `/var/log/headysystems/app.log`

### 3. Database Access
1. Configure PyCharm Database tool window
2. Add PostgreSQL connection for each environment
3. Use SSH tunnel for secure access

## Environment Variables

### Required Variables
```bash
# Production
DATABASE_URL=postgresql://user:pass@headysystems.com:5432/heady_prod
SECRET_KEY=<production-secret>
DEBUG=False
ALLOWED_HOSTS=headysystems.com,www.headysystems.com

# Staging
DATABASE_URL=postgresql://user:pass@staging.headysystems.com:5432/heady_staging
SECRET_KEY=<staging-secret>
DEBUG=True
ALLOWED_HOSTS=staging.headysystems.com,*.heady.local

# Local
DATABASE_URL=sqlite:///./db.sqlite3
SECRET_KEY=local-dev-secret-key
DEBUG=True
ALLOWED_HOSTS=*.heady.local,localhost,127.0.0.1
```

## Performance Optimization

### 1. PyCharm Settings
- Increase memory allocation: `Help > Edit Custom VM Options`
- Set `-Xmx8g` for large projects
- Enable `Power Save Mode` when not debugging

### 2. Indexing
- Exclude unnecessary directories:
  - `node_modules`
  - `__pycache__`
  - `.git`
  - `venv`
  - `logs`

### 3. Code Completion
- Use remote interpreter for accurate completion
- Enable type checking in Python settings
- Configure Django support for template completion

## Troubleshooting

### Common Issues
1. **SSH Connection Failed**
   - Check SSH key permissions
   - Verify server accessibility
   - Test with `ssh deploy@headysystems.com`

2. **Remote Interpreter Not Working**
   - Install PyCharm helpers on server
   - Check Python path on server
   - Verify virtual environment exists

3. **Deployment Fails**
   - Check file permissions on server
   - Verify sudo access for deployment user
   - Check disk space on server

4. **Database Connection Issues**
   - Test connection with `psql` command
   - Check firewall rules
   - Verify database is running

## Security Best Practices

1. **SSH Keys**
   - Use ed25519 keys
   - Protect private key with passphrase
   - Rotate keys regularly

2. **Environment Variables**
   - Never commit secrets to Git
   - Use different secrets per environment
   - Rotate secrets regularly

3. **Deployment Security**
   - Use dedicated deployment user
   - Limit sudo permissions
   - Audit deployment logs

## Automation Scripts

### Pre-deployment Script
```bash
#!/bin/bash
# Run tests
python manage.py test

# Check code quality
flake8 .
black --check .

# Security scan
bandit -r .
```

### Post-deployment Script
```bash
#!/bin/bash
# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Collect static files
python manage.py collectstatic --noinput

# Restart services
sudo systemctl restart gunicorn
sudo systemctl reload nginx
```

This setup provides a complete, production-ready PyCharm environment for Heady Systems development.
