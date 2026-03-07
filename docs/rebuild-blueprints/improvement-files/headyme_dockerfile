FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
ENV NODE_ENV=production
ENV PORT=8080
RUN groupadd -r heady && useradd -r -g heady heady
RUN chown -R heady:heady /app
USER heady
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s \
    CMD node -e "const h=require('http');h.get('http://localhost:8080/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"
EXPOSE 8080
CMD ["node", "index.js"]
