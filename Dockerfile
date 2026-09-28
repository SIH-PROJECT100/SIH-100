FROM node:20-slim

# Install OpenSSL and CA certificates for Prisma and HTTPS
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests
COPY backend-api/package*.json ./

# Install dependencies
RUN npm install

# Copy backend source code
COPY backend-api/ ./

# Build TypeScript and generate Prisma Client
RUN npm run build

# Render supplies PORT dynamically at runtime via process.env.PORT
EXPOSE 4000

CMD ["node", "dist/index.js"]
