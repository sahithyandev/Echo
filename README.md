# Echo

My own music library and streaming setup.

## Installation

Echo ships ready-to-run artifacts on every release: a multi-arch Docker
image on GHCR and 4 platform binaries on GitHub Releases. No build tooling
required.

### Quick install

```sh
curl -fsSL https://raw.githubusercontent.com/sahithyandev/echo/main/install.sh | bash
```

Prompts for Docker vs. binary (defaults to Docker if installed), port, and
music directory; generates `ECHO_JWT_SECRET` for you. On Linux it can also
offer to install the binary as a systemd service. Review `install.sh` before
piping it to `bash` if you'd rather not run a remote script blind.

For manual control over each step, see below.

### Docker

```sh
docker pull ghcr.io/sahithyandev/echo:latest
ECHO_JWT_SECRET=$(openssl rand -hex 32) docker compose up -d
```

Open `:3000` — the first account you create becomes the admin. Music is
mounted at `./music` (writable, e.g. for the upload feature); data (SQLite +
album art) persists in the `echo-data` volume.

**Upgrade:** `docker compose pull && docker compose up -d` — migrations run
idempotently on boot.

### Binary

```sh
target="$(uname -s | tr A-Z a-z)-$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')"
curl -LO "https://github.com/sahithyandev/echo/releases/latest/download/echo-$target.tar.gz"
mkdir echo && tar -xzf "echo-$target.tar.gz" -C echo/
cd echo && ECHO_JWT_SECRET=$(openssl rand -hex 32) NODE_ENV=production ./echo
```

`target` resolves to one of `linux-x64 | linux-arm64 | darwin-x64 | darwin-arm64`.
Config is all `ECHO_*` environment variables (`ECHO_PORT`, `ECHO_HOST`,
`ECHO_DATABASE_URL`, `ECHO_DATA_DIR`, `ECHO_MUSIC_DIR`, `ECHO_JWT_SECRET`);
every var besides `ECHO_JWT_SECRET` has a sane default (see `utils/env.ts`).

**Run as a systemd service:** copy the extracted folder to `/opt/echo`, set
`ECHO_*` vars in `/etc/echo/echo.env` (see `.env.example`), then:

```sh
sudo cp echo.service /etc/systemd/system/
sudo systemctl enable --now echo
```

**Upgrade:** replace the binary, `sudo systemctl restart echo`.

### Reverse proxy (Caddy example)

```
music.example.com {
	reverse_proxy localhost:3000
}
```

Caddy handles TLS automatically; any reverse proxy that forwards to `:3000`
(or `ECHO_PORT`) works the same way.

### Backup

The SQLite file (`echo.db` in the `echo-data` volume, or wherever
`ECHO_DATABASE_URL` points) is the entire database. Copy it while the server
is stopped, or use `sqlite3 echo.db ".backup backup.db"` for a live,
WAL-safe copy.

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

### Self-hosting notes

Docker and the standalone binary share one production code path: client
assets and DB migrations are embedded at build time
(`scripts/build-client.ts`, `scripts/build-migrations.ts`), so neither
distribution needs the source tree or dev tooling at runtime — this is also
why migrations run through a custom idempotent migrator (`db/migrate.ts`)
reading a generated manifest instead of `drizzle-kit`'s filesystem-based
migrator, which can't read a migrations folder from inside a compiled
binary.

Building a binary yourself instead of using a release:

```sh
bun run build:binary -- <target>   # linux-x64 | linux-arm64 | darwin-x64 | darwin-arm64
```

This produces `dist-binaries/<target>/` containing the binary, the
platform's native `@libsql` addon, and `public/` — the same layout as the
release tarball. Windows isn't a supported target; untested and not a
priority for a self-hosted app meant to run on a home server/NAS.

### CI

`.github/workflows/ci.yml` runs lint + tests on every push/PR, plus a matrix
build of all 4 binary targets (each on a matching-architecture runner, since
the `@libsql` native addon is a platform-specific optional dependency and
can't be cross-compiled from a single host). `.github/workflows/release.yml`
publishes a multi-arch (`linux/amd64,linux/arm64`) image to GHCR and attaches
all 4 binaries to the GitHub Release on every `v*` tag push (triggered by a
`VERSION.txt` bump).

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
