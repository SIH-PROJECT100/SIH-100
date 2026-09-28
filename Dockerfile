FROM node:20-slim

# Install OpenSSL and CA certificates for Prisma and HTTPS
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests and Prisma schema (required for postinstall prisma generate)
COPY backend-api/package*.json ./
COPY backend-api/prisma ./prisma/

# Install dependencies
RUN npm install

# Copy backend source code
COPY backend-api/ ./

# Build TypeScript
RUN npm run build

EXPOSE 4000

CMD ["node", "dist/index.js"]
