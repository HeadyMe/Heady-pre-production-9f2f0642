FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN mkdir -p data configs
EXPOSE 3301
CMD ["node", "heady-manager.js"]
