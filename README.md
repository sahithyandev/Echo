# Echo

My own music library and streaming setup.

## Development

### Prerequisites

| Prereq. | Version | Notes |
| ------- | ------- | ----- |
| bun     | v1.3.14 |       |

### Folder Structure

```
Echo/
└── echo-server/        # Elysia HTTP server (Bun)
    ├── index.ts        # Entry point
    ├── db/             # Drizzle ORM + libsql (SQLite)
    ├── modules/
    │   └── auth/       # Sign-up, sign-in, session management
    ├── pages/          # JSX pages (HTML via @elysiajs/html)
    ├── public/         # Static assets (CSS, favicons)
    └── utils/          # JWT, env, misc helpers
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
