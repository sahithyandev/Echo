import { describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { runMigrations } from "./migrate";
import { migrations } from "./migrations.generated";

describe("runMigrations", () => {
	it("applies all migrations to a fresh database", async () => {
		const db = drizzle("file::memory:");
		await runMigrations(db);

		const tables = await db.all<{ name: string }>(
			sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'`,
		);
		expect(tables.length).toBe(1);

		const applied = await db.all<{ name: string }>(
			sql`SELECT name FROM __drizzle_migrations`,
		);
		expect(applied.map((row) => row.name).sort()).toEqual(
			migrations.map((m) => m.name).sort(),
		);
	});

	it("is idempotent on a second run", async () => {
		const db = drizzle("file::memory:");
		await runMigrations(db);
		await runMigrations(db);

		const applied = await db.all<{ name: string }>(
			sql`SELECT name FROM __drizzle_migrations`,
		);
		expect(applied.length).toBe(migrations.length);
	});
});
