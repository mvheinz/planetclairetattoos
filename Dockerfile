# Docker-Exit-Pfad (docs/ARCHITEKTUR.md §13): dieselbe App ohne Vercel betreiben, z. B. auf Hetzner.
# Build: docker build -t planetclaire .   (setzt NEXT_OUTPUT_STANDALONE=1 und BUILD_WITHOUT_DB=1: kein Datenbankzugriff
# und keine Zugangsdaten beim Build, Spike B-08). Ziele: `migrator` (einmalig `payload migrate`), `runner` (Standard).
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
ENV BUILD_WITHOUT_DB=1
RUN corepack enable pnpm && pnpm run build

# Migrationen (docker-compose.prod.yml, Dienst `migrate`): Quellcode, Migrationen und Abhängigkeiten aus dem Build.
FROM builder AS migrator
ENV NODE_ENV=production
CMD ["pnpm", "payload", "migrate"]

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
# Schriften zur Laufzeit (OG-Bilder, PDFs): nicht immer vom Standalone-Tracing erfasst – sicherheitshalber mitnehmen.
COPY --from=builder --chown=nextjs:nodejs /app/src/styles/fonts ./src/styles/fonts
COPY --from=builder --chown=nextjs:nodejs /app/src/og/fonts ./src/og/fonts

USER nextjs
EXPOSE 3000
ENV PORT=3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["sh", "-c", "HOSTNAME=0.0.0.0 node server.js"]
