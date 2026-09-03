# syntax=docker/dockerfile:1.7
# Multi-stage build: deps → (tools | builder) → runner. The `tools` stage keeps the
# full dependency tree so the `migrate` compose service can run drizzle + seed;
# the `runner` stage ships only Next's standalone output (~150 MB).

FROM node:22-alpine AS base
RUN npm install -g pnpm@11 && apk add --no-cache libc6-compat wget
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS tools
COPY . .
CMD ["sh", "-c", "pnpm db:migrate && pnpm db:seed"]

FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache wget && addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
