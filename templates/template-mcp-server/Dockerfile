FROM node:20-alpine
WORKDIR /mcp
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 8080
ENV PORT=8080 NODE_ENV=production
CMD ["node", "src/index.js"]
