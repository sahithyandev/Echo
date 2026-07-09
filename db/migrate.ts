import { sql } from "drizzle-orm";
import { migrations } from "./migrations.generated";
import type { DbLike } from "./types";

/**
 * Idempotent migrator that reads migrations baked into migrations.generated.ts
 * (by scripts/build-migrations.ts) instead of the filesystem, so it works
 * inside a `bun build --compile` standalone binary with no db/migrations
 * folder on disk.
 */
export async function runMigrations(db: DbLike) {
	await db.run(sql`
		CREATE TABLE IF NOT EXISTS __drizzle_migrations (
			name TEXT PRIMARY KEY,
			applied_at TEXT NOT NULL
		)
	`);

	const appliedRows = await db.all<{ name: string }>(
		sql`SELECT name FROM __drizzle_migrations`,
	);
	const applied = new Set(appliedRows.map((row) => row.name));

	let ranCount = 0;
	for (const migration of migrations) {
		if (applied.has(migration.name)) continue;

		console.log(`Applying migration ${migration.name}...`);
		for (const statement of migration.sql.split("--> statement-breakpoint")) {
			const trimmed = statement.trim();
			if (trimmed) await db.run(sql.raw(trimmed));
		}

		await db.run(
			sql`INSERT INTO __drizzle_migrations (name, applied_at) VALUES (${migration.name}, ${new Date().toISOString()})`,
		);
		ranCount++;
	}

	console.log(
		ranCount === 0
			? `Migrations: database up to date (${applied.size} previously applied)`
			: `Migrations: ${ranCount} applied, ${applied.size} already up to date`,
	);
}
