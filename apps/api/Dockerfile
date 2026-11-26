# Multi-stage Bun Dockerfile for @uangku/api
FROM oven/bun:1.3.14-alpine AS base
WORKDIR /app

# Stage 1: Install dependencies
FROM base AS dependencies
COPY package.json bun.lock turbo.json ./
COPY packages/contracts ./packages/contracts
COPY apps/api/package.json ./apps/api/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json

RUN bun install --frozen-lockfile

# Stage 2: Build bundle
FROM dependencies AS builder
COPY apps/api/src ./apps/api/src
COPY apps/api/drizzle ./apps/api/drizzle
WORKDIR /app/apps/api
RUN bun run build

# Stage 3: Production runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/drizzle ./drizzle

EXPOSE 3001

CMD ["bun", "dist/index.js"]
