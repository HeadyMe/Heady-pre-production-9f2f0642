FROM node:20-bullseye-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY app.js ./

# Hugging Face Spaces expose port 7860 by default
EXPOSE 7860

# Start server
CMD ["npm", "start"]
