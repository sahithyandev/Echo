import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { sql } from "drizzle-orm";
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

// Both distribution paths (Dockerfile, install.sh) pre-create the data
// directory; if it's missing, ECHO_DATA_DIR/ECHO_DATABASE_URL is misconfigured.
// The db file itself is fine to auto-create on first run — libsql does that.
const dbPath = dbUrl.replace(/^file:/, "");
if (!existsSync(dirname(dbPath))) {
	throw new Error(
		`Data directory for ECHO_DATABASE_URL (${dbPath}) does not exist. Create it before starting the server.`,
	);
}

console.log(
	existsSync(dbPath)
		? `Opening existing database at ${dbPath}`
		: `Creating new database at ${dbPath}`,
);

export const client = drizzle(
	dbUrl.startsWith("file:") ? dbUrl : `file:${dbUrl}`,
);

// SQLite disables FK enforcement per-connection by default; without this,
// every .references()/onDelete in schema.ts is silently unenforced.
try {
	await client.run(sql`PRAGMA foreign_keys = ON`);
} catch (err) {
	console.error(`Failed to open database at ${dbPath}:`, err);
	throw err;
}
