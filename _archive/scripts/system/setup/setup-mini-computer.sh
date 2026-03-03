# © 2026 Heady Systems LLC.
# PROPRIETARY AND CONFIDENTIAL.
# Unauthorized copying, modification, or distribution is strictly prohibited.
#!/bin/bash
# setup-mini-computer.sh - Deploy Heady to mini-computer/edge device

set -e

echo "🖥️  DEPLOYING HEADY SYSTEMS TO MINI-COMPUTER"
echo "============================================"

# Check if running on supported architecture
ARCH=$(uname -m)
OS=$(uname -s)

echo "Architecture: $ARCH"
echo "Operating System: $OS"

# Install dependencies if needed
install_dependencies() {
    echo "📦 Installing dependencies..."
    
    if command -v apt >/dev/null 2>&1; then
        sudo apt update
        sudo apt install -y nginx python3 python3-pip nodejs npm certbot
    elif command -v yum >/dev/null 2>&1; then
        sudo yum update -y
        sudo yum install -y nginx python3 python3-pip nodejs npm
    elif command -v pacman >/dev/null 2>&1; then
        sudo pacman -Syu --noconfirm
        sudo pacman -S --noconfirm nginx python python-pip nodejs npm
    else
        echo "❌ Unsupported package manager. Please install nginx, python3, nodejs manually."
        exit 1
    fi
    
    # Install Python dependencies
    pip3 install flask requests
    
    # Install Node.js dependencies
    npm install -g pm2
}

# Setup Nginx configuration
setup_nginx() {
    echo "🌐 Setting up Nginx configuration..."
    
    # Create sites-available directory
    sudo mkdir -p /etc/nginx/sites-available
    
    # Create main configuration
    sudo tee /etc/nginx/sites-available/heady-systems > /dev/null << 'EOF'
# Heady Systems Nginx Configuration
upstream headybuddy {
    server 127.0.0.1:9000;
}

upstream headysystems {
    server 127.0.0.1:9001;
}

upstream headyconnection {
    server 127.0.0.1:9002;
}

upstream headymcp {
    server 127.0.0.1:9003;
}

upstream headyio {
    server 127.0.0.1:9004;
}

upstream headyme {
    server 127.0.0.1:9005;
}

# HeadyBuddy.org
server {
    listen 80;
    server_name headybuddy.org www.headybuddy.org;
    
    location / {
        proxy_pass http://headybuddy;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:3300;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HeadySystems.com
server {
    listen 80;
    server_name headysystems.com www.headysystems.com;
    
    location / {
        proxy_pass http://headysystems;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:3300;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HeadyConnection.org
server {
    listen 80;
    server_name headyconnection.org www.headyconnection.org;
    
    location / {
        proxy_pass http://headyconnection;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HeadyMCP.com
server {
    listen 80;
    server_name headymcp.com www.headymcp.com;
    
    location / {
        proxy_pass http://headymcp;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HeadyIO.com
server {
    listen 80;
    server_name headyio.com www.headyio.com;
    
    location / {
        proxy_pass http://headyio;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HeadyMe.com
server {
    listen 80;
    server_name headyme.com www.headyme.com;
    
    location / {
        proxy_pass http://headyme;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

    # Enable site
    sudo ln -sf /etc/nginx/sites-available/heady-systems /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test configuration
    sudo nginx -t
}

# Setup SSL certificates
setup_ssl() {
    echo "🔐 Setting up SSL certificates..."
    
    # Check if domains point to this server
    for domain in headybuddy.org headysystems.com headyconnection.org headymcp.com headyio.com headyme.com; do
        echo "Checking $domain..."
        if dig +short $domain | grep -q "$(curl -s ifconfig.me)"; then
            echo "✅ $domain points to this server"
            sudo certbot --nginx -d $domain -d www.$domain --non-interactive --agree-tos --email admin@$domain || true
        else
            echo "⚠️  $domain does not point to this server. Skipping SSL setup."
        fi
    done
}

# Create service management scripts
create_services() {
    echo "🔧 Creating service management scripts..."
    
    # Create PM2 configuration
    cat > /home/headyme/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'headybuddy',
      script: 'python3',
      args: '-m http.server 9000 --directory /home/headyme/headybuddy/dist',
      cwd: '/home/headyme',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'headysystems',
      script: 'python3',
      args: '-m http.server 9001 --directory /home/headyme/headysystems/dist',
      cwd: '/home/headyme',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'headyconnection',
      script: 'python3',
      args: '-m http.server 9002 --directory /home/headyme/headyconnection/dist',
      cwd: '/home/headyme',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'headymcp',
      script: 'python3',
      args: '-m http.server 9003 --directory /home/headyme/headymcp/dist',
      cwd: '/home/headyme',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'headyio',
      script: 'python3',
      args: '-m http.server 9004 --directory /home/headyme/headyio/dist',
      cwd: '/home/headyme',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'headyme',
      script: 'python3',
      args: '-m http.server 9005 --directory /home/headyme/headyme/dist',
      cwd: '/home/headyme',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
EOF

    # Start services with PM2
    pm2 start /home/headyme/ecosystem.config.js
    pm2 save
    pm2 startup
}

# Setup monitoring
setup_monitoring() {
    echo "📊 Setting up monitoring..."
    
    # Create monitoring script
    cat > /home/headyme/monitor-heady.sh << 'EOF'
#!/bin/bash
# Heady Systems Monitoring Script

LOG_FILE="/var/log/heady-monitor.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# Check if all services are running
check_services() {
    echo "[$DATE] Checking services..." >> $LOG_FILE
    
    for port in 9000 9001 9002 9003 9004 9005; do
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:$port | grep -q "200"; then
            echo "[$DATE] Service on port $port: OK" >> $LOG_FILE
        else
            echo "[$DATE] Service on port $port: FAILED" >> $LOG_FILE
            # Restart failed service
            pm2 restart all
        fi
    done
    
    # Check Nginx
    if systemctl is-active --quiet nginx; then
        echo "[$DATE] Nginx: OK" >> $LOG_FILE
    else
        echo "[$DATE] Nginx: FAILED" >> $LOG_FILE
        sudo systemctl restart nginx
    fi
}

# Check disk space
check_disk() {
    DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ $DISK_USAGE -gt 80 ]; then
        echo "[$DATE] WARNING: Disk usage at ${DISK_USAGE}%" >> $LOG_FILE
    fi
}

# Check memory
check_memory() {
    MEM_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    if [ $MEM_USAGE -gt 80 ]; then
        echo "[$DATE] WARNING: Memory usage at ${MEM_USAGE}%" >> $LOG_FILE
    fi
}

check_services
check_disk
check_memory

echo "[$DATE] Monitoring check completed" >> $LOG_FILE
EOF

    chmod +x /home/headyme/monitor-heady.sh
    
    # Add to crontab
    (crontab -l 2>/dev/null; echo "*/5 * * * * /home/headyme/monitor-heady.sh") | crontab -
}

# Main execution
main() {
    echo "Starting Heady Systems deployment to mini-computer..."
    
    # Check if running as root for system operations
    if [ "$EUID" -ne 0 ]; then
        echo "Some operations require sudo. You may be prompted for password."
    fi
    
    install_dependencies
    setup_nginx
    create_services
    
    echo ""
    echo "🔧 Starting services..."
    sudo systemctl restart nginx
    sudo systemctl enable nginx
    
    setup_monitoring
    
    echo ""
    echo "✅ Heady Systems deployed to mini-computer!"
    echo ""
    echo "🌐 Services running on:"
    echo "   • HeadyBuddy.org -> http://localhost:9000"
    echo "   • HeadySystems.com -> http://localhost:9001"
    echo "   • HeadyConnection.org -> http://localhost:9002"
    echo "   • HeadyMCP.com -> http://localhost:9003"
    echo "   • HeadyIO.com -> http://localhost:9004"
    echo "   • HeadyMe.com -> http://localhost:9005"
    echo ""
    echo "🔧 Management commands:"
    echo "   • pm2 status - Check service status"
    echo "   • pm2 logs - View logs"
    echo "   • pm2 restart all - Restart all services"
    echo "   • sudo systemctl status nginx - Check Nginx"
    echo ""
    echo "📊 Monitoring:"
    echo "   • tail -f /var/log/heady-monitor.log - View monitoring logs"
    echo "   • crontab -l - View scheduled tasks"
    echo ""
    echo "🔐 For SSL certificates:"
    echo "   • Ensure domains point to this server"
    echo "   • Run: sudo certbot --nginx"
    echo ""
    echo "🎉 Mini-computer deployment complete!"
}

# Run main function
main
