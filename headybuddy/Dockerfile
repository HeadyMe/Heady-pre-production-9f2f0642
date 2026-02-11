# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: headybuddy/Dockerfile                                                    ║
# ║  LAYER: headybuddy                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
# ╔═══════════════════════════════════════════════════════════════╗
# ║  HEADY SYSTEMS — HeadyBuddy Widget Dockerfile                ║
# ║  Multi-stage build: npm install + vite build → nginx serve    ║
# ╚═══════════════════════════════════════════════════════════════╝

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY <<'EOF' /etc/nginx/conf.d/default.conf
resolver 127.0.0.11 valid=30s ipv6=off;

server {
    listen 3400;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        set $backend "heady-manager:3300";
        proxy_pass http://$backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF
EXPOSE 3400
CMD ["nginx", "-g", "daemon off;"]
