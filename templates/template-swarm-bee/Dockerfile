FROM node:20-alpine
WORKDIR /bee
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
# Bee self-destructs after execution, no persistent state
CMD ["node", "src/index.js"]
