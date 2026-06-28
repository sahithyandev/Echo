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
└── echo-server/   # Elysia HTTP server (Bun)
    └── src/
        └── index.ts
```

### Running the server

```sh
cd echo-server
bun run dev   # watch mode on port 3000
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
