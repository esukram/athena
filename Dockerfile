FROM node:25-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g corepack@latest --force
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY . .
RUN CI=true pnpm install --frozen-lockfile
RUN pnpm build
RUN pnpm deploy --filter-prod=server --prod /prod/server

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

# Cleanup build artifacts
RUN find /app -name ".turbo" -type d -exec rm -rf {} +

USER athena
VOLUME /data
EXPOSE 4000
ENV NODE_ENV=production
ENV DB_PATH=/data

CMD ["node", "dist/index.js"]
