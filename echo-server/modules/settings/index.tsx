import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { users } from "../../db/schema";
import type { DbLike } from "../../db/types";
import createAuthMiddleware from "../auth/middleware";

const settingsBody = t.Object({
	shuffle: t.Boolean(),
	repeat_mode: t.Union([t.Literal("off"), t.Literal("all"), t.Literal("one")]),
});

export default function createSettingsModule(db: DbLike) {
	const authMiddleware = createAuthMiddleware(db);
	return new Elysia()
		.use(authMiddleware)
		.get(
			"/settings",
			async ({ currentUser, status }) => {
				if (!currentUser) return status(401);
				const rows = await db
					.select({ shuffle: users.shuffle, repeat_mode: users.repeat_mode })
					.from(users)
					.where(eq(users.id, currentUser.id))
					.limit(1);
				return rows[0];
			},
			{ currentUser: true },
		)
		.put(
			"/settings",
			async ({ currentUser, status, body }) => {
				if (!currentUser) return status(401);
				await db.update(users).set(body).where(eq(users.id, currentUser.id));
				return body;
			},
			{ currentUser: true, body: settingsBody },
		);
}
