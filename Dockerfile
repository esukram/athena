FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY . .
RUN CI=true canvas_binary_host_mirror=https://github.com/Automattic/node-canvas/releases/download/v2.11.2 pnpm install --frozen-lockfile
RUN pnpm build
RUN pnpm deploy --filter=server --prod /prod/server --legacy

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
