FROM node:20-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Build context is repo root, so paths are relative to that
COPY server/package*.json ./
RUN npm ci

COPY server/ .

EXPOSE 3001
CMD ["node", "src/index.js"]
