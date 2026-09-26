# Docker-Exit-Pfad (docs/ARCHITEKTUR.md): dieselbe App ohne Vercel betreiben, z. B. auf Hetzner.
# Build: docker build -t planetclaire .   (setzt NEXT_OUTPUT_STANDALONE=1)
# Basis: https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile

FROM node:24-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_OUTPUT_STANDALONE=1
RUN corepack enable pnpm && pnpm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
RUN mkdir .next
RUN chown nextjs:nodejs .next
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["sh", "-c", "HOSTNAME=0.0.0.0 node server.js"]
