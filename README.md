# Echo

My own music library and streaming setup.

## Development

### Prerequisites

| Prereq.     | Version | Notes                                                                    |
| ----------- | ------- | ------------------------------------------------------------------------ |
| chromaprint | ≥ 1.0   | Optional; enables duplicate track detection. `brew install chromaprint`. |
| ffprobe     | any     | Part of ffmpeg. `brew install ffmpeg`.                                   |
| bun         | v1.3.14 | Required in dev.                                                         |

### Folder Structure

```
Echo/                  # Elysia HTTP server (Bun)
├── index.ts           # Entry point; runs migrations + music scan on startup
├── bindings/          # Native bindings (chromaprint for audio fingerprinting)
├── components/        # Shared JSX components (e.g. album art)
├── db/                # Drizzle ORM + libsql (SQLite file `echo.db`)
├── modules/
│   ├── auth/          # Sign-up, sign-in, JWT session management with revocation
│   └── library/       # Music library: scan, upsert tracks/albums/artists
├── pages/             # JSX pages (HTML via @elysiajs/html); Tailwind 4
├── public/            # Static assets (favicons)
└── utils/             # JWT, env, request-info, create-app, misc
```

### Running the server

```sh
bun run dev   # watch mode on port 3000
```

### Testing

```sh
bun test
```

## Self-Hosting

Echo can run as a Docker container or a standalone single-file binary; both
share the same production code path (embedded client assets + migrations, no
source tree or dev tooling required at runtime).

### Docker

```sh
ECHO_JWT_SECRET=$(openssl rand -hex 32) docker compose up -d
```

Open `:3000` — the first account you create becomes the admin. Music is
mounted at `./music` (writable, e.g. for the upload feature); data (SQLite +
album art) persists in the `echo-data` volume.

### Standalone binary

```sh
bun run build:binary -- <target>   # linux-x64 | linux-arm64 | darwin-x64 | darwin-arm64
```

Windows isn't a supported target for now; untested and not a priority for a
self-hosted app that's meant to run on a home server/NAS.

Produces `dist-binaries/<target>/` containing the binary, the platform's
native `@libsql` addon, and `public/` — copy the whole folder to the target
machine and run it. Set `ECHO_JWT_SECRET` and `NODE_ENV=production`; every
other `ECHO_*` var has a sane default (see `utils/env.ts`).

Config is all environment variables (`ECHO_PORT`, `ECHO_HOST`,
`ECHO_DATABASE_URL`, `ECHO_DATA_DIR`, `ECHO_MUSIC_DIR`, `ECHO_JWT_SECRET`),
mirroring the Docker setup — no separate bare-metal config format.

### Bare metal (systemd)

Copy a `dist-binaries/<target>/` build to `/opt/echo`, set `ECHO_*` vars in
`/etc/echo/echo.env` (see `.env.example`), then install `echo.service`:

```sh
sudo cp echo.service /etc/systemd/system/
sudo systemctl enable --now echo
```

### Upgrading

- **Docker:** `docker compose pull && docker compose up -d` — migrations run
  idempotently on boot.
- **Binary/systemd:** replace the binary, `sudo systemctl restart echo`.

### Backup

The SQLite file (`echo.db` in the `echo-data` volume, or wherever
`ECHO_DATABASE_URL` points) is the entire database. Copy it while the server
is stopped, or use `sqlite3 echo.db ".backup backup.db"` for a live,
WAL-safe copy.

### Reverse proxy (Caddy example)

```
music.example.com {
	reverse_proxy localhost:3000
}
```

Caddy handles TLS automatically; any reverse proxy that forwards to `:3000`
(or `ECHO_PORT`) works the same way.

### CI

`.github/workflows/ci.yml` runs lint + tests on every push/PR, plus a matrix
build of all 4 binary targets (each on a matching-architecture runner, since
the `@libsql` native addon is platform-specific) to catch cross-target
breakage early. `.github/workflows/release.yml` publishes a multi-arch
(`linux/amd64,linux/arm64`) image to GHCR and attaches all 4 binaries to the
GitHub Release on every `v*` tag push.

### Commits

This project follows
[Conventional Commits](https://www.conventionalcommits.org/). Format:
`<type>: <description>`

| Type       | When to use                         |
| ---------- | ----------------------------------- |
| `feat`     | New feature                         |
| `fix`      | Bug fix                             |
| `chore`    | Tooling, config, deps, maintenance  |
| `docs`     | Documentation only                  |
| `refactor` | Code change with no behavior change |

## Author

Sahithyan K. (https://sahithyan.dev)
