# Echo

My own music library and streaming setup.

## Development

### Prerequisites

| Prereq.     | Version | Notes                                         |
| ----------- | ------- | --------------------------------------------- |
| chromaprint | ≥ 1.0   | Required in prod. `brew install chromaprint`. |
| ffprobe     | any     | Part of ffmpeg. `brew install ffmpeg`.        |
| bun         | v1.3.14 | Required in dev.                              |

### Folder Structure

```
Echo/
└── echo-server/        # Elysia HTTP server (Bun)
    ├── index.ts        # Entry point; runs migrations + music scan on startup
    ├── bindings/       # Native bindings (chromaprint for audio fingerprinting)
    ├── components/     # Shared JSX components (e.g. album art)
    ├── db/             # Drizzle ORM + libsql (SQLite file `echo.db`)
    ├── modules/
    │   ├── auth/       # Sign-up, sign-in, JWT session management with revocation
    │   └── library/    # Music library: scan, upsert tracks/albums/artists
    ├── pages/          # JSX pages (HTML via @elysiajs/html); Tailwind 4
    ├── public/         # Static assets (favicons)
    └── utils/          # JWT, env, request-info, create-app, misc
```

### Running the server

```sh
cd echo-server
bun run dev   # watch mode on port 3000
```

### Testing

```sh
cd echo-server
bun test
```

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
