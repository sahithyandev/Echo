# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project

Echo is a personal music library and streaming application.

## Structure

Elysia (Bun) HTTP server at the repo root; entry point `index.ts`, dev: `bun run dev`

- `bindings/` — Native bindings (`chromaprint.ts` for audio fingerprinting via FFI, `dlopen` lazily deferred so importing it is safe without the lib present)
- `components/` — Shared JSX components (e.g. `album-art.tsx`)
- `db/` — Drizzle ORM with libsql (SQLite file `echo.db`); schema: `users`, `user_sessions`, `tracks`, `albums`, `artists`, `album_artists`, `track_artists`. Dev uses `drizzle-kit push`; production uses a custom idempotent migrator (`db/migrate.ts`) reading `db/migrations.generated.ts` (gitignored, baked from `db/migrations/*/migration.sql` by `scripts/build-migrations.ts`) — this embeddable-manifest approach is what makes migrations work inside a compiled binary (no filesystem access to a migrations folder)
- `modules/auth/` — sign-up, sign-in, JWT-based session auth with revocation support
- `modules/library/` — `LibraryService`: scans `~/Music` on startup, upserts tracks/albums/artists using `ffprobe` for metadata and chromaprint for fingerprinting (fingerprinting and duplicate detection are skipped if `fpcalc` isn't installed, gated by `FPCALC_AVAILABLE`)
- `pages/` — JSX pages rendered server-side via `@elysiajs/html`; Tailwind 4 for styling; includes `library.tsx`, `album.tsx`, `artist.tsx`, `login.tsx`
- `public/` — static assets served at `/`
- `scripts/` — `build-client.ts` (emits `dist/` client JS/CSS, embedded in prod instead of the dev-only runtime `Bun.build`), `build-migrations.ts` (see above), `build-binary.ts` (compiles + stages a standalone binary for one target: `linux-x64 | linux-arm64 | darwin-x64 | darwin-arm64 | windows-x64` — see `package.json`'s `build:binary`)
- `utils/` — `jwt.ts`, `env.ts`, `request-info.ts`, `create-app.tsx`, `misc.ts`
- `Dockerfile` / `docker-compose.yml` — multi-stage image, non-root user, healthcheck on `/health`
- `.github/workflows/ci.yml` — lint + test on push/PR, plus a 5-target binary build matrix (one matching-architecture runner per target, since `@libsql`'s native addon is platform-specific)

## Tooling

- Bun is the package manager and runtime
- Elysia for HTTP routing
- Drizzle ORM + `drizzle-kit` for migrations
- Biome for linting/formatting (`bun run lint`, `bun run lint:fix`)
- `bun test` for tests (integration + unit tests exist for auth module and utils)
- `ffprobe` (from ffmpeg) for reading audio metadata tags
- `chromaprint` (via FFI, and `fpcalc` CLI) for generating audio fingerprints (capped at 30s); optional, enables duplicate track detection in settings

## Self-hosting

Config is env vars, `ECHO_`-prefixed (`ECHO_PORT`, `ECHO_HOST`,
`ECHO_DATABASE_URL`, `ECHO_DATA_DIR`, `ECHO_MUSIC_DIR`, `ECHO_JWT_SECRET`),
resolved via `getEnvVar` (`utils/env.ts`) with defaults where sensible; no
`.env.example` yet. `ECHO_JWT_SECRET` is required and fails fast at boot when
`NODE_ENV=production`. Two distribution paths, sharing the same production
code path (embedded assets + migrations): Docker (`docker compose up -d`)
and a standalone binary (`bun run build:binary -- <target>`, see README).
First signup becomes the admin — no separate admin bootstrap env vars.

## Context

The author is learning Swift/SwiftUI/macOS development. Explain concepts briefly
before implementing, and keep explanations concise.

## Style

- No emojis or Unicode symbol characters (arrows, music notes, etc.) in UI or code comments. Use SVG icons instead.
