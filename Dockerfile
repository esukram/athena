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

# Set ownership of the working directories and pnpm store
RUN mkdir -p /data /pnpm && chown -R athena:nodejs /app /data /pnpm

USER athena

# Install production dependencies only
COPY --chown=athena:nodejs package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY --chown=athena:nodejs apps/server/package.json ./apps/server/package.json
COPY --chown=athena:nodejs apps/web/package.json ./apps/web/package.json
COPY --chown=athena:nodejs packages/api/package.json ./packages/api/package.json
COPY --chown=athena:nodejs packages/typescript-config/package.json ./packages/typescript-config/package.json

RUN pnpm install --prod --frozen-lockfile

# Copy built server artifacts
COPY --chown=athena:nodejs --from=builder /app/apps/server/dist ./apps/server/dist
# Copy built web artifacts
COPY --chown=athena:nodejs --from=builder /app/apps/web/dist ./apps/server/public

# Define volume for SQLite
VOLUME /data

EXPOSE 4000

ENV NODE_ENV=production
ENV DB_PATH=/data/athena.db

# Run the server
CMD ["node", "apps/server/dist/index.js"]
