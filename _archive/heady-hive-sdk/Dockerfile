FROM node:20-alpine
WORKDIR /app
COPY server/package.json ./
RUN npm install --production
COPY lib/ ./lib/
COPY server/index.js ./
EXPOSE 8080
CMD ["node", "index.js"]
