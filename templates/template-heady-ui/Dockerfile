FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY server.js .
RUN npm install express@4
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
