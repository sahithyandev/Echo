import { eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { listening, play_history, users } from "../../db/schema";
import type { DbLike } from "../../db/types";
import createAuthMiddleware from "../auth/middleware";

const settingsBody = t.Object({
	shuffle: t.Boolean(),
	repeat_mode: t.Union([t.Literal("off"), t.Literal("all"), t.Literal("one")]),
});

const playbackBody = t.Object({
	track_id: t.Nullable(t.Integer()),
	position_seconds: t.Nullable(t.Integer()),
	playing: t.Boolean(),
});

const heartbeatBody = t.Object({
	track_id: t.Integer(),
	seconds: t.Number({ minimum: 0, maximum: 15 }),
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
					.select({
						shuffle: users.shuffle,
						repeat_mode: users.repeat_mode,
						playback_track_id: users.playback_track_id,
						playback_position_seconds: users.playback_position_seconds,
						playback_playing: users.playback_playing,
					})
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
		)
		.put(
			"/settings/playback",
			async ({ currentUser, status, body }) => {
				if (!currentUser) return status(401);
				await db
					.update(users)
					.set({
						playback_track_id: body.track_id,
						playback_position_seconds: body.position_seconds,
						playback_playing: body.playing,
					})
					.where(eq(users.id, currentUser.id));
				return body;
			},
			{ currentUser: true, body: playbackBody },
		)
		.post(
			"/history",
			async ({ currentUser, status, body }) => {
				if (!currentUser) return status(401);
				await db
					.insert(play_history)
					.values({ user_id: currentUser.id, track_id: body.track_id });
				return status(204);
			},
			{ currentUser: true, body: t.Object({ track_id: t.Integer() }) },
		)
		.post(
			"/playback/heartbeat",
			async ({ currentUser, status, body }) => {
				if (!currentUser) return status(401);
				if (body.seconds <= 0) return status(204);
				await db
					.insert(listening)
					.values({
						user_id: currentUser.id,
						track_id: body.track_id,
						seconds: Math.round(body.seconds),
						day: new Date().toISOString().slice(0, 10),
					})
					.onConflictDoUpdate({
						target: [listening.day, listening.user_id, listening.track_id],
						set: { seconds: sql`${listening.seconds} + excluded.seconds` },
					});
				return status(204);
			},
			{ currentUser: true, body: heartbeatBody },
		);
}
