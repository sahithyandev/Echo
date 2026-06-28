import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	password: text("password").notNull(),
	is_admin: integer("is_admin", { mode: "boolean" }).default(false).notNull(),
	verified_at: integer("verified_at", { mode: "timestamp" }),
	created_at: integer("created_at", { mode: "timestamp" })
		.$defaultFn(() => new Date())
		.notNull(),
});

export const user_sessions = sqliteTable("user_sessions", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	user_id: integer("user_id")
		.notNull()
		.references(() => users.id),
	token_hash: text("token_hash").notNull(),
	ip_address: text("ip_address"),
	user_agent: text("user_agent"),
	created_at: integer("created_at", { mode: "timestamp" })
		.$defaultFn(() => new Date())
		.notNull(),
	last_active_at: integer("last_active_at", { mode: "timestamp" })
		.$defaultFn(() => new Date())
		.notNull(),
	revoked_at: integer("revoked_at", { mode: "timestamp" }),
});
