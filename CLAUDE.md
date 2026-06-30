# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project

Echo is a personal music library and streaming application.

## Structure

- `echo-server/` — Elysia (Bun) HTTP server; entry point `index.ts`, dev: `bun run dev`
  - `bindings/` — Native bindings (`chromaprint.ts` for audio fingerprinting via FFI)
  - `components/` — Shared JSX components (e.g. `album-art.tsx`)
  - `db/` — Drizzle ORM with libsql (SQLite file `echo.db`); schema: `users`, `user_sessions`, `tracks`, `albums`, `artists`, `album_artists`, `track_artists`
  - `modules/auth/` — sign-up, sign-in, JWT-based session auth with revocation support
  - `modules/library/` — `LibraryService`: scans `~/Music` on startup, upserts tracks/albums/artists using `ffprobe` for metadata and chromaprint for fingerprinting
  - `pages/` — JSX pages rendered server-side via `@elysiajs/html`; Tailwind 4 for styling; includes `library.tsx`, `album.tsx`, `artist.tsx`, `login.tsx`
  - `public/` — static assets served at `/`
  - `utils/` — `jwt.ts`, `env.ts`, `request-info.ts`, `create-app.tsx`, `misc.ts`

## Tooling

- Bun is the package manager and runtime
- Elysia for HTTP routing
- Drizzle ORM + `drizzle-kit` for migrations
- Biome for linting/formatting (`bun run lint`, `bun run lint:fix`)
- `bun test` for tests (integration + unit tests exist for auth module and utils)
- `ffprobe` (from ffmpeg) for reading audio metadata tags
- `chromaprint` (via FFI) for generating audio fingerprints (capped at 30s)

## Context

The author is learning Swift/SwiftUI/macOS development. Explain concepts briefly
before implementing, and keep explanations concise.

## Style

- No emojis or Unicode symbol characters (arrows, music notes, etc.) in UI or code comments. Use SVG icons instead.
