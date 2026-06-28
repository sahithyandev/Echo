import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const users = sqliteTable("users", {
	name: text("name").notNull(),
	email: text("email").notNull(),
	password: text("password").notNull(),
	is_admin: integer("is_admin", {mode: "boolean"}).default(false).notNull()
});
