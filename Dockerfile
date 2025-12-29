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
WORKDIR /app

# Don't run production as root
# RUN addgroup --system --gid 1001 nodejs
# RUN adduser --system --uid 1001 nestjs
# USER nestjs

# Install production dependencies only
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/api/package.json ./packages/api/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json

RUN pnpm install --prod --frozen-lockfile

# Copy built server artifacts
COPY --from=builder /app/apps/server/dist ./apps/server/dist
# Copy built web artifacts
COPY --from=builder /app/apps/web/dist ./apps/server/public

# Copy other necessary files (like the db if it was part of the image, although it should be a volume)
# For this task, we assume the DB schema is initialized or the file is copied.
# Since we are using sqlite, we might want to ensure the folder exists or copy a seed.
# COPY --from=builder /app/athena.db ./athena.db 
# Note: In a real prod env, the DB should probably be volume mounted. 
# But for simplicity here, we can copy the existing one or let the server create it.

EXPOSE 4000

ENV NODE_ENV=production

# Run the server
CMD ["node", "apps/server/dist/index.js"]
