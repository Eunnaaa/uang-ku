# Multi-stage Bun Dockerfile for @uangku/api
FROM oven/bun:1-alpine AS base
WORKDIR /app

# Stage 1: Install dependencies
FROM base AS dependencies
COPY package.json turbo.json ./
COPY packages/contracts ./packages/contracts
COPY apps/api/package.json ./apps/api/package.json

RUN bun install

# Stage 2: Build bundle
FROM dependencies AS builder
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN bun run build

# Stage 3: Production runner
FROM oven/bun:1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app/apps/api/dist ./dist

EXPOSE 3001

CMD ["bun", "dist/index.js"]
