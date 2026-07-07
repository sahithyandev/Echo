FROM oven/bun:1.3.14-alpine AS base
WORKDIR /app

# --- builder: full deps + source, produces embeddable client/migration bundles ---
FROM base AS builder
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build:client && bun run build:migrations

# --- runtime: production deps only + built output, no dev tooling ---
FROM base AS runtime
ENV NODE_ENV=production \
	ECHO_HOST=0.0.0.0 \
	ECHO_DATA_DIR=/data \
	ECHO_MUSIC_DIR=/music \
	ECHO_DATABASE_URL=file:/data/echo.db

COPY package.json bun.lock tsconfig.json ./
RUN bun install --frozen-lockfile --production

COPY index.ts ./
COPY db ./db
COPY modules ./modules
COPY pages ./pages
COPY components ./components
COPY utils ./utils
COPY bindings ./bindings
COPY public ./public
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/db/migrations.generated.ts ./db/migrations.generated.ts

RUN mkdir -p /data /music && chown -R bun:bun /data /music /app

EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --retries=6 \
	CMD wget -qO- http://127.0.0.1:3000/health || exit 1

USER bun
CMD ["bun", "run", "index.ts"]
