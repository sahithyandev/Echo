import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { drizzle } from "drizzle-orm/libsql";
import { getEnvVar } from "../utils/env";

const dbUrl = getEnvVar("ECHO_DATABASE_URL");

// The dev-only default resolves relative to import.meta.url, which points
// inside the virtual filesystem when running a `bun build --compile`
// standalone binary without NODE_ENV=production set — that path doesn't
// exist on real disk. Safety net for that misconfiguration; the compiled
// binary's actual production default (see utils/env.ts) doesn't hit this.
if (dbUrl.includes("/$bunfs/")) {
	throw new Error(
		"ECHO_DATABASE_URL must be set explicitly when running the compiled binary, e.g. file:/path/to/data/echo.db — the default only works when running from source.",
	);
}

// Docker's Dockerfile pre-creates /data; a bare binary/systemd deployment
// has no such step, so the production default (~/.echo/echo.db) may not
// have a parent dir yet on a fresh machine.
mkdirSync(dirname(dbUrl.replace(/^file:/, "")), { recursive: true });

export const client = drizzle(
	dbUrl.startsWith("file:") ? dbUrl : `file:${dbUrl}`,
);
