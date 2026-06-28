# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project

Echo is a personal music library and streaming application.

## Structure

- `echo-server/` — Elysia (Bun) HTTP server; entry point `index.ts`, dev: `bun run dev`
  - `db/` — Drizzle ORM with libsql (SQLite file `echo.db`); schema: `users`, `user_sessions`
  - `modules/auth/` — sign-up, sign-in, JWT-based session auth with revocation support
  - `pages/` — JSX pages rendered server-side via `@elysiajs/html`; Tailwind 4 for styling
  - `public/` — static assets served at `/`
  - `utils/` — `jwt.ts`, `env.ts`, `request-info.ts`, `create-app.tsx`, `misc.ts`

## Tooling

- Bun is the package manager and runtime
- Elysia for HTTP routing
- Drizzle ORM + `drizzle-kit` for migrations
- Biome for linting/formatting (`bun run lint`, `bun run lint:fix`)
- `bun test` for tests (integration + unit tests exist for auth module and utils)

## Context

The author is learning Swift/SwiftUI/macOS development. Explain concepts briefly
before implementing, and keep explanations concise.
