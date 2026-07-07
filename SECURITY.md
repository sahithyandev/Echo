# Security

Echo is a personal, self-hosted app — there's no dedicated security team, but
reports are welcome.

## Reporting a vulnerability

Open a private report via
[GitHub Security Advisories](https://github.com/sahithyandev/Echo/security/advisories/new),
or email sahithyan2701@gmail.com. Please don't open a public issue for
security bugs.

## `ECHO_JWT_SECRET`

Session tokens are signed with `ECHO_JWT_SECRET`. In production
(`NODE_ENV=production`) the app refuses to boot if it's unset — there is no
fallback secret, so a leaked/known default can never sign a real session.
Generate one with `openssl rand -hex 32` and keep it out of version control
(`.env` is gitignored; Docker Compose requires it via `${ECHO_JWT_SECRET:?}`).

Rotating the secret invalidates all existing sessions.
