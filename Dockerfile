FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Prune the workspace to the minimum needed for each app
FROM base AS builder
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
# RUN apk add --no-cache libc6-compat
# Set working directory
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

# Build everything
RUN pnpm build

# Runner stage
FROM base AS runner
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs athena

WORKDIR /app

# Install production dependencies only (running as root)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/api/package.json ./packages/api/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json

RUN pnpm install --prod --frozen-lockfile

# Copy built server artifacts
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/packages/api/dist ./packages/api/dist
# Copy built web artifacts
COPY --from=builder /app/apps/web/dist ./apps/server/public

# Setup directories and define volume for SQLite
RUN mkdir -p /data /pnpm && chown -R athena:nodejs /app /data /pnpm

USER athena

VOLUME /data

EXPOSE 4000

ENV NODE_ENV=production
ENV DB_PATH=/data/athena.db

# Run the server
CMD ["node", "apps/server/dist/index.js"]
