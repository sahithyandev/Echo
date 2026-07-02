import { eq, sql } from "drizzle-orm";
import { listening, play_history, users } from "../../db/schema";
import type { DbLike } from "../../db/types";
import type { SettingsModel } from "./model";

export abstract class SettingsService {
	static async getSettings(db: DbLike, userId: number) {
		const rows = await db
			.select({
				shuffle: users.shuffle,
				repeat_mode: users.repeat_mode,
				playback_track_id: users.playback_track_id,
				playback_position_seconds: users.playback_position_seconds,
				playback_playing: users.playback_playing,
			})
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);
		return rows[0];
	}

	static async updateSettings(
		db: DbLike,
		userId: number,
		body: SettingsModel.SettingsBody,
	) {
		await db.update(users).set(body).where(eq(users.id, userId));
	}

	static async updatePlayback(
		db: DbLike,
		userId: number,
		body: SettingsModel.PlaybackBody,
	) {
		await db
			.update(users)
			.set({
				playback_track_id: body.track_id,
				playback_position_seconds: body.position_seconds,
				playback_playing: body.playing,
			})
			.where(eq(users.id, userId));
	}

	static async recordHistory(db: DbLike, userId: number, trackId: number) {
		await db
			.insert(play_history)
			.values({ user_id: userId, track_id: trackId });
	}

	static async recordHeartbeat(
		db: DbLike,
		userId: number,
		body: SettingsModel.HeartbeatBody,
	) {
		await db
			.insert(listening)
			.values({
				user_id: userId,
				track_id: body.track_id,
				seconds: Math.round(body.seconds),
				day: new Date().toISOString().slice(0, 10),
			})
			.onConflictDoUpdate({
				target: [listening.day, listening.user_id, listening.track_id],
				set: { seconds: sql`${listening.seconds} + excluded.seconds` },
			});
	}
}
