# Multi-stage Dockerfile for GeM Compliance Backend API
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript code and generate Prisma client
RUN npx prisma generate
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

# Install postgresql client for trigger lockdown script execution
RUN apk add --no-cache postgresql-client bash

ENV NODE_ENV=production

# Copy dependencies and build artifacts
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY src/db/seed.ts ./src/db/
COPY test_phase11.ps1 test_phase12.ps1 test_ai_contract.ts ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
