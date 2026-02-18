# 🌐 Heady Branded Domains - COMPLETE SETUP
# headyme.com - Your Home for Everything

## 🏠 PRIMARY HOME DOMAIN
**headyme.com** - Your main home base for all Heady operations

## 📋 COMPLETE DOMAIN ARCHITECTURE

### 🎯 **Primary Home Services**
| Service | Branded Domain | Purpose | Port |
|---------|----------------|---------|------|
| **Home Dashboard** | https://headyme.com | Main control center | 443 |
| **API Gateway** | https://api.headyme.com | All API endpoints | 443 |
| **Admin Panel** | https://admin.headyme.com | System administration | 443 |
| **HeadyBuddy Chat** | https://chat.headyme.com | AI assistant | 443 |
| **Development** | https://dev.headyme.com | Code & projects | 443 |

### 🛠️ **Specialized Services**
| Service | Branded Domain | Purpose | Port |
|---------|----------------|---------|------|
| **MCP Tools** | https://tools.headyme.com | Security & dev tools | 443 |
| **Stories** | https://stories.headyme.com | Narrative tracking | 443 |
| **Monitoring** | https://lens.headyme.com | System observability | 443 |
| **Voice** | https://voice.headyme.com | Audio interface | 443 |
| **Sync** | https://sync.headyme.com | File synchronization | 443 |

### 🗄️ **Infrastructure Services**
| Service | Branded Domain | Purpose | Port |
|---------|----------------|---------|------|
| **Database** | https://db.headyme.com | PostgreSQL | 5432 |
| **Cache** | https://cache.headyme.com | Redis | 6379 |
| **Storage** | https://storage.headyme.com | File storage | 9000 |

## 🔧 IMMEDIATE FIXES NEEDED

### 1. Update Environment Configuration
```bash
# Replace all .env files with headyme.com domains
HEADY_DOMAIN_SCHEME=headyme.com
HEADY_BASE_URL=https://api.headyme.com
HEADY_HOME_URL=https://headyme.com
HEADY_ADMIN_URL=https://admin.headyme.com
HEADY_CHAT_URL=https://chat.headyme.com
HEADY_DEV_URL=https://dev.headyme.com
```

### 2. Update Hosts File
```bash
# Add to /etc/hosts
manager.headyme.com headyme.com
127.0.0.1 api.headyme.com
127.0.0.1 admin.headyme.com
127.0.0.1 chat.headyme.com
127.0.0.1 dev.headyme.com
127.0.0.1 tools.headyme.com
127.0.0.1 stories.headyme.com
127.0.0.1 lens.headyme.com
127.0.0.1 voice.headyme.com
127.0.0.1 sync.headyme.com
127.0.0.1 db.headyme.com
127.0.0.1 cache.headyme.com
127.0.0.1 storage.headyme.com
```

### 3. Update Service Configuration
- All API endpoints → `https://api.headyme.com`
- Main dashboard → `https://headyme.com`
- Admin interface → `https://admin.headyme.com`
- Chat interface → `https://chat.headyme.com`

## 🚀 EXECUTION COMMANDS

### Run This Now:
```bash
# Fix all domains immediately
cd /home/headyme/CascadeProjects/Heady
./scripts/fix-headyme-domains.sh
```

### Manual Fix:
```bash
# Update hosts file
sudo echo "manager.headyme.com headyme.com api.headyme.com admin.headyme.com chat.headyme.com dev.headyme.com tools.headyme.com stories.headyme.com lens.headyme.com voice.headyme.com sync.headyme.com db.headyme.com cache.headyme.com storage.headyme.com" >> /etc/hosts

# Restart services
node heady-manager.js
```

## 📊 EXPECTED RESULT

After fixes, you should see:
```
🌐 HeadyMe Domain Access:
  Home: https://headyme.com
  API: https://api.headyme.com
  Admin: https://admin.headyme.com
  Chat: https://chat.headyme.com
  Dev: https://dev.headyme.com
```

## ✅ SUCCESS CRITERIA

- [ ] headyme.com resolves to your local server
- [ ] All subdomains work (api, admin, chat, dev, tools, etc.)
- [ ] ZERO localhost/127.0.0.1 references anywhere
- [ ] All services use headyme.com branding
- [ ] headyme.com is your main home dashboard

## 🎯 YOUR HOME BASE

**headyme.com** will be:
- Your main dashboard and control center
- Home for all Heady operations
- Central hub for development, chat, admin, tools
- Primary entry point for everything Heady

This gives you ONE DOMAIN to rule them all: **headyme.com**
