# syntax=docker/dockerfile:1.7
FROM node:26-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g corepack@latest --force
RUN corepack enable

FROM base AS builder
# Build tools for native modules (e.g. better-sqlite3) that lack prebuilt
# binaries for the current Node version and fall back to node-gyp.
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy only manifests first so the install layer caches across source changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY apps/server/package.json ./apps/server/
COPY packages/api/package.json ./packages/api/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/

RUN CI=true pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
RUN pnpm deploy --filter-prod=server --prod --legacy /prod/server

FROM base AS runner
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs athena

WORKDIR /app

# Copy the deployed server (includes prod dependencies)
COPY --from=builder --chown=athena:nodejs /prod/server ./

# Copy compiled code
COPY --from=builder --chown=athena:nodejs /app/apps/server/dist ./dist

# Copy web assets
COPY --from=builder --chown=athena:nodejs /app/apps/web/dist ./public

# Setup directories
RUN mkdir -p /data && chown -R athena:nodejs /data

USER athena
VOLUME /data
EXPOSE 4000
ENV NODE_ENV=production
ENV DB_PATH=/data

CMD ["node", "dist/index.js"]
