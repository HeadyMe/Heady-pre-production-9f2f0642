# HeadySystems.com - Commercial Hub
# Production configuration for main commercial domain

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name headysystems.com www.headysystems.com;
    
    # Redirect all HTTP traffic to HTTPS
    return 301 https://$host$request_uri;
}

# HTTPS main site
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name headysystems.com;
    
    # SSL certificates (use Certbot or your CA)
    ssl_certificate /etc/letsencrypt/live/headysystems.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/headysystems.com/privkey.pem;
    
    # Include security headers
    include /etc/nginx/conf.d/security-headers.conf;
    
    # Root directory for static files
    root /var/www/headysystems.com/public;
    index index.html;
    
    # Main site content
    location / {
        try_files $uri $uri/ @backend;
        
        # Cache static assets
        location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            add_header Vary Accept-Encoding;
        }
        
        # HTML files - shorter cache
        location ~* \.html$ {
            expires 1h;
            add_header Cache-Control "public, must-revalidate";
        }
    }
    
    # Fallback to backend application
    location @backend {
        include /etc/nginx/conf.d/proxy-params.conf;
        proxy_pass http://headysystems_backend;
    }
    
    # API endpoints
    location /api/ {
        include /etc/nginx/conf.d/proxy-params.conf;
        proxy_pass http://api_headysystems/;
        
        # Rate limiting for API
        limit_req zone=api burst=20 nodelay;
        
        # API-specific headers
        add_header Content-Type "application/json" always;
    }
    
    # WebSocket endpoints
    location /ws/ {
        include /etc/nginx/conf.d/proxy-params.conf;
        proxy_pass http://websocket_headysystems;
        
        # WebSocket-specific settings
        proxy_cache_bypass $http_upgrade;
        proxy_no_cache $http_upgrade;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    # Security: Deny access to sensitive files
    location ~ /\. {
        deny all;
    }
    
    location ~ \.(env|log|conf|key|pem)$ {
        deny all;
    }
}

# WWW redirect
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.headysystems.com;
    
    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/headysystems.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/headysystems.com/privkey.pem;
    
    # Redirect WWW to non-WWW
    return 301 https://headysystems.com$request_uri;
}
