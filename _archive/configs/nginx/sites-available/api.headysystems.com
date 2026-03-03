# API.HeadySystems.com - Commercial API Endpoint
# Production configuration for API subdomain

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name api.headysystems.com;
    
    return 301 https://$host$request_uri;
}

# HTTPS API server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.headysystems.com;
    
    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/headysystems.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/headysystems.com/privkey.pem;
    
    # Include security headers
    include /etc/nginx/conf.d/security-headers.conf;
    
    # API-specific CORS (more permissive for APIs)
    add_header Access-Control-Allow-Origin "$http_origin" always;
    add_header Access-Control-Allow-Credentials "true" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,X-API-Key" always;
    
    # Rate limiting
    limit_req zone=api burst=50 nodelay;
    
    # Main API proxy
    location / {
        include /etc/nginx/conf.d/proxy-params.conf;
        proxy_pass http://api_headysystems;
        
        # API-specific settings
        proxy_set_header X-API-Version "v1";
        proxy_set_header X-Service "headysystems-api";
        
        # Response caching for GET requests
        if ($request_method = GET) {
            proxy_cache api_cache;
            proxy_cache_valid 200 5m;
            proxy_cache_valid 404 1m;
            add_header X-API-Cache $upstream_cache_status;
        }
    }
    
    # Authentication endpoints (no caching, stricter rate limiting)
    location /auth/ {
        include /etc/nginx/conf.d/proxy-params.conf;
        proxy_pass http://api_headysystems;
        
        # Stricter rate limiting for auth
        limit_req zone=login burst=5 nodelay;
        
        # No caching for auth
        proxy_no_cache 1;
        proxy_cache_bypass 1;
    }
    
    # WebSocket API endpoints
    location /ws {
        include /etc/nginx/conf.d/proxy-params.conf;
        proxy_pass http://websocket_headysystems;
        
        # WebSocket settings
        proxy_cache_bypass $http_upgrade;
        proxy_no_cache $http_upgrade;
    }
    
    # API documentation
    location /docs {
        root /var/www/api.headysystems.com;
        index index.html;
        try_files $uri $uri/ =404;
    }
    
    # Health check
    location /health {
        access_log off;
        proxy_pass http://api_headysystems/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # API metrics (restricted access)
    location /metrics {
        allow 127.0.0.1;
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        allow 192.168.0.0/16;
        deny all;
        
        proxy_pass http://api_headysystems/metrics;
        include /etc/nginx/conf.d/proxy-params.conf;
    }
    
    # Security: Deny access to sensitive paths
    location ~ /\.(git|svn|env) {
        deny all;
    }
}

# API cache configuration
proxy_cache_path /var/cache/nginx/api levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=60m;
