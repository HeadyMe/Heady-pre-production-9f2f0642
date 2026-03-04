FROM nginx:alpine

# Copy static files
COPY index.html /usr/share/nginx/html/
COPY 404.html /usr/share/nginx/html/

# Custom nginx config for Cloud Run (port 8080)
RUN echo 'server { listen 8080; server_name _; root /usr/share/nginx/html; index index.html; location / { try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
