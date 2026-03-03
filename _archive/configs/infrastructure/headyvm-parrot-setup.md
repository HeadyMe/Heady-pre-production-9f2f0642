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
<!-- ║  FILE: configs/headyvm-parrot-setup.md                                                    ║
<!-- ║  LAYER: config                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# HeadyVM — Parrot OS 7 + Windsurf Complete Setup

> **Target:** Parrot OS 7 (Security/Home Edition) virtual machine  
> **Purpose:** Linux-based Heady Project development node with Windsurf IDE  
> **Generated:** 2026-02-11  

---

## System Identity

```yaml
vm_name: HeadyVM
os: Parrot OS 7 (Debian bookworm base)
role: development-node
user: erich
heady_home: /home/erich/Heady
cloud_layer: cloud-me
```

---

## Phase 0 — Pre-flight

```bash
# Verify Parrot OS / Debian base
cat /etc/os-release
# Must NOT run as root — script uses sudo internally
whoami
```

---

## Phase 1 — System Update & Core Packages

```bash
sudo apt-get update -qq && sudo apt-get upgrade -y -qq

sudo apt-get install -y \
  build-essential gcc g++ make cmake pkg-config autoconf automake libtool \
  libssl-dev libffi-dev zlib1g-dev libbz2-dev libreadline-dev libsqlite3-dev \
  libncursesw5-dev xz-utils tk-dev libxml2-dev libxmlsec1-dev liblzma-dev \
  curl wget gnupg2 apt-transport-https ca-certificates lsb-release \
  software-properties-common unzip zip jq yq tree htop btop tmux screen \
  net-tools dnsutils nmap traceroute iptables ufw wireguard-tools \
  git git-lfs \
  uidmap dbus-user-session fuse-overlayfs slirp4netns \
  open-vm-tools open-vm-tools-desktop qemu-guest-agent spice-vdagent \
  btrfs-progs lvm2 parted \
  xclip xsel xdg-utils libx11-xcb1 libxkbcommon0 libdrm2 libgbm1 \
  libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 libgtk-3-0 \
  libpango-1.0-0 libcairo2 libxcomposite1 libxdamage1 libxrandr2 \
  libnspr4 libnss3 libxshmfence1 \
  vim neovim nano ripgrep fd-find bat exa fzf \
  sysstat iotop dstat \
  python3-dev python3-pip python3-venv python3-full \
  fail2ban
```

---

## Phase 2 — Node.js 20 LTS (nvm)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source "$HOME/.nvm/nvm.sh"
nvm install 20
nvm alias default 20
nvm use default
npm install -g nodemon concurrently pm2
```

**Verify:** `node -v` → v20.x, `npm -v` → 10.x+

---

## Phase 3 — Python 3.12 + Virtual Environment

```bash
python3 -m venv "$HOME/.heady-venv"
source "$HOME/.heady-venv/bin/activate"
pip install --upgrade pip setuptools wheel
pip install numpy pandas matplotlib jupyter ipykernel requests pyyaml \
  transformers torch --extra-index-url https://download.pytorch.org/whl/cpu
```

**Shell profile** — append to `~/.bashrc` or `~/.zshrc`:

```bash
export HEADY_HOME="$HOME/Heady"
export HEADY_PYTHON_BIN="$HOME/.heady-venv/bin/python"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
[ -s "$HOME/.heady-venv/bin/activate" ] && source "$HOME/.heady-venv/bin/activate"
export PATH="$HOME/.local/bin:$PATH"
```

---

## Phase 4 — Docker Engine + Compose v2

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/debian bookworm stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -qq
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker erich
sudo systemctl enable docker && sudo systemctl start docker
sudo docker network create heady_heady-main-network 2>/dev/null || true
```

**Verify:** `docker compose version`, `docker ps`

---

## Phase 5 — Git & SSH Configuration

```bash
git lfs install --skip-repo

git config --global user.name "Eric (HeadyVM)"
git config --global user.email "dev@headyio.com"
git config --global init.defaultBranch main
git config --global pull.rebase true
git config --global core.autocrlf input
git config --global push.autoSetupRemote true
git config --global lfs.activitytimeout 60
```

**SSH key:**

```bash
ssh-keygen -t ed25519 -C "heady-vm@headysystems.com" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
# → Add to https://github.com/settings/ssh/new
```

**~/.ssh/config:**

```
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
  AddKeysToAgent yes

Host heady-desktop
  HostName heady-desktop
  User erich
  Port 22
  IdentityFile ~/.ssh/id_ed25519
```

---

## Phase 6 — Windsurf IDE

```bash
WINDSURF_URL="https://windsurf-stable.codeiumdata.com/linux-x64/stable/latest/Windsurf-linux-x64.deb"
curl -fSL -o /tmp/windsurf-latest.deb "$WINDSURF_URL"
sudo dpkg -i /tmp/windsurf-latest.deb || sudo apt-get install -f -y
```

**Windsurf config** — `~/.windsurf/model_config.yaml`:

```yaml
default_model: claude-sonnet-4-20250514
auto_context: true
memory_enabled: true
workspace_indexing: true
```

---

## Phase 7 — Cloudflared Tunnel Agent

```bash
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | \
  sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] \
  https://pkg.cloudflare.com/cloudflared bookworm main" | \
  sudo tee /etc/apt/sources.list.d/cloudflared.list >/dev/null
sudo apt-get update -qq && sudo apt-get install -y cloudflared
```

**/etc/cloudflared/config.yml:**

```yaml
tunnel: heady-vm-tunnel
credentials-file: /etc/cloudflared/heady-vm-tunnel.json

ingress:
  - hostname: vm.headysystems.com
    service: http://localhost:3300
  - hostname: vm-buddy.headysystems.com
    service: http://localhost:3301
  - hostname: vm-web.headysystems.com
    service: http://localhost:3000
  - service: http_status:404

originRequest:
  connectTimeout: 30s
  noTLSVerify: false
```

**Activate tunnel:**

```bash
cloudflared tunnel login
cloudflared tunnel create heady-vm-tunnel
# Copy credentials JSON to /etc/cloudflared/heady-vm-tunnel.json
```

---

## Phase 8 — Heady Project Clone & Bootstrap

```bash
git clone git@github.com:HeadySystems/Heady.git ~/Heady
cd ~/Heady

git remote add heady-me git@github.com:HeadyMe/Heady.git
git remote add heady-sys git@github.com:HeadySystems/Heady.git

cp .env.example .env
sed -i 's|HEADY_PYTHON_BIN=python|HEADY_PYTHON_BIN=/home/erich/.heady-venv/bin/python|' .env
# Edit .env → set HEADY_API_KEY, ADMIN_TOKEN, HF_TOKEN

npm ci
cd frontend && npm ci && cd ..
cd headybuddy && npm ci && cd ..
pip install -r requirements.txt
```

**Git remotes (expected):**

```
origin      git@github.com:HeadySystems/Heady.git
heady-me    git@github.com:HeadyMe/Heady.git
heady-sys   git@github.com:HeadySystems/Heady.git
```

**Cloud endpoints:**

```
HeadyMe:         https://me.headysystems.com
HeadySystems:    https://api.headysystems.com
HeadyConnection: https://api.headyconnection.org
Brain:           https://brain.headysystems.com
```

**Key ports:**

| Port  | Service         |
|-------|-----------------|
| 3300  | Heady Manager   |
| 3301  | Heady Buddy     |
| 3000  | Web Frontend    |
| 8080  | RAG Service     |
| 11434 | Ollama          |

---

## Phase 9 — Firewall & Security Hardening

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow from 127.0.0.0/8 to any port 3300 proto tcp comment 'Heady Manager'
sudo ufw allow from 127.0.0.0/8 to any port 3301 proto tcp comment 'Heady Buddy'
sudo ufw allow from 127.0.0.0/8 to any port 3000 proto tcp comment 'Heady Web'
sudo ufw allow from 127.0.0.0/8 to any port 8080 proto tcp comment 'RAG'
sudo ufw allow from 127.0.0.0/8 to any port 11434 proto tcp comment 'Ollama'
sudo ufw allow from 172.16.0.0/12 to any comment 'Docker networks'
sudo ufw --force enable
```

**SSH hardening** (`/etc/ssh/sshd_config`):

```
PermitRootLogin no
PasswordAuthentication no
X11Forwarding no
MaxAuthTries 3
```

**Kernel hardening** (`/etc/sysctl.d/99-heady-hardening.conf`):

```ini
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv4.tcp_syncookies = 1
kernel.randomize_va_space = 2
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
```

```bash
sudo sysctl --system
```

---

## Phase 10 — Systemd Services

**heady-manager.service:**

```ini
[Unit]
Description=Heady Manager (Node.js MCP Server)
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=erich
WorkingDirectory=/home/erich/Heady
Environment=NODE_ENV=production
Environment=PORT=3300
ExecStart=/home/erich/.nvm/versions/node/v20.18.1/bin/node heady-manager.js
Restart=on-failure
RestartSec=10
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/erich/Heady/data /home/erich/Heady/logs /home/erich/Heady/.cache
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

**heady-cloudflared.service:**

```ini
[Unit]
Description=Heady Cloudflared Tunnel
After=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/cloudflared tunnel --config /etc/cloudflared/config.yml run
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**heady-docker.service:**

```ini
[Unit]
Description=Heady Docker Stack
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
User=erich
Group=docker
WorkingDirectory=/home/erich/Heady
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down

[Install]
WantedBy=multi-user.target
```

**Enable all:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now heady-manager
sudo systemctl enable --now heady-cloudflared
sudo systemctl enable --now heady-docker
```

---

## Phase 11 — VM Optimizations

```bash
# I/O scheduler (none is best for VMs)
for d in /sys/block/sd*/queue/scheduler /sys/block/vd*/queue/scheduler; do
  [ -f "$d" ] && echo none | sudo tee "$d" > /dev/null
done

# Low swappiness
echo "vm.swappiness=10" | sudo tee -a /etc/sysctl.d/99-heady-vm.conf
sudo sysctl -w vm.swappiness=10

# Disable unused services
for svc in bluetooth cups avahi-daemon ModemManager; do
  sudo systemctl disable "$svc" 2>/dev/null; sudo systemctl stop "$svc" 2>/dev/null
done

# Transparent hugepages
echo madvise | sudo tee /sys/kernel/mm/transparent_hugepage/enabled

# File descriptor limits (/etc/security/limits.d/99-heady.conf)
cat <<'EOF' | sudo tee /etc/security/limits.d/99-heady.conf
*  soft  nofile  65536
*  hard  nofile  131072
*  soft  nproc   65536
*  hard  nproc   131072
EOF

# Journal rotation
sudo mkdir -p /etc/systemd/journald.conf.d
cat <<'EOF' | sudo tee /etc/systemd/journald.conf.d/heady.conf
[Journal]
SystemMaxUse=500M
MaxRetentionSec=7day
Compress=yes
EOF
sudo systemctl restart systemd-journald
```

---

## Phase 12 — Verification Checklist

```bash
node -v                          # v20.x
npm -v                           # 10.x+
python3 --version                # 3.12.x
docker --version                 # 27.x+
docker compose version           # v2.x
git --version                    # 2.x
git lfs version                  # 3.x
cloudflared --version            # 2024.x+
windsurf --version               # installed
pm2 --version                    # 5.x
sudo ufw status                  # active
test -d ~/Heady/.git && echo OK  # repo cloned
test -f ~/Heady/.env && echo OK  # env exists
test -d ~/Heady/node_modules && echo OK
curl -s http://localhost:3300/api/health | jq .
```

---

## .env Template (fill in secrets)

```bash
PORT=3300
NODE_ENV=development
HEADY_API_KEY=<your_key>
ADMIN_TOKEN=<your_token>
HEADY_TARGET=CloudOnly
HEADY_VERSION=3.0.0
HEADY_CLOUD_MODE=true
HEADY_LOCAL_SERVICES_ENABLED=false
HEADY_ACTIVE_ENDPOINT=https://cloud.headysystems.com
HEADY_POSTGRES_ENABLED=false
HEADY_REDIS_ENABLED=false
HEADY_MANAGER_LOCAL=false
HF_TOKEN=<your_hf_token>
HEADY_PYTHON_BIN=/home/erich/.heady-venv/bin/python
PYTHON_WORKER_PATH=backend/python_worker
CLOUD_HEADYME_URL=https://me.headysystems.com
CLOUD_HEADYSYSTEMS_URL=https://api.headysystems.com
CLOUD_HEADYCONNECTION_URL=https://api.headyconnection.org
```

---

## Docker Compose (docker-compose.yml)

The project uses a `heady_heady-main-network` external Docker network. Key services:

- **heady-manager** — Node.js MCP server on port 3300, cloud-only mode
- **heady** — Python 3.11 Alpine worker

Volumes: `heady-data`, `heady-logs`, `heady-cache`, `heady-config`, `heady-plugins`, `heady-exports`, `heady-backups`, `heady-temp`, `heady-models`, `heady-embeddings`, `heady-sessions`, `heady-uploads`, `heady-downloads`

---

## Project Structure (key paths)

```
~/Heady/
├── heady-manager.js          # Main MCP server entry point
├── package.json              # Node deps (Express, MCP SDK, Helmet, etc.)
├── requirements.txt          # Python deps (numpy, pandas, jupyter, etc.)
├── docker-compose.yml        # Docker stack
├── Dockerfile                # node:20-alpine based
├── .env                      # Secrets (not committed)
├── configs/                  # All YAML configs
├── frontend/                 # React (Vite) web UI
├── headybuddy/               # HeadyBuddy overlay app
├── scripts/                  # PowerShell & Bash automation
├── src/                      # Backend JS modules
├── services/                 # API, orchestrator, billing
├── extensions/               # Chrome, VS Code, PyCharm
├── workers/                  # Cloudflare Workers
├── docs/                     # Documentation
├── .windsurf/workflows/      # Windsurf workflow definitions
└── heady-registry.json       # Central catalog
```

---

## Quick Start After Setup

```bash
# 1. Start heady-manager directly
cd ~/Heady && node heady-manager.js

# 2. Or via pm2
pm2 start heady-manager.js --name heady-manager

# 3. Or via systemd
sudo systemctl start heady-manager

# 4. Frontend dev
cd ~/Heady/frontend && npm run dev

# 5. Full Docker stack
cd ~/Heady && docker compose up -d

# 6. Auto-deploy (push to all remotes)
cd ~/Heady && bash scripts/run-auto-deploy.sh
# Or from Windows: pwsh scripts/run-auto-deploy.ps1

# 7. Health check
curl http://localhost:3300/api/health
```
