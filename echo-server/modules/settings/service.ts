import { count, eq, sql } from "drizzle-orm";
import {
	albums,
	artists,
	listening,
	play_history,
	tracks,
	users,
} from "../../db/schema";
import type { DbLike } from "../../db/types";
import type { SettingsModel } from "./model";

export abstract class SettingsService {
	static async getStats(db: DbLike) {
		const [[t], [al], [ar], [u]] = await Promise.all([
			db.select({ count: count() }).from(tracks),
			db.select({ count: count() }).from(albums),
			db.select({ count: count() }).from(artists),
			db.select({ count: count() }).from(users),
		]);
		return {
			tracks: t.count,
			albums: al.count,
			artists: ar.count,
			users: u.count,
		};
	}

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

	static async recordHistory(db: DbLike, userId: number, trackId: number) {
		await db
			.insert(play_history)
			.values({ user_id: userId, track_id: trackId });
	}

	static async syncPlayback(
		db: DbLike,
		userId: number,
		body: SettingsModel.PlaybackSyncBody,
	) {
		if (body.position_seconds !== undefined || body.playing !== undefined) {
			await db
				.update(users)
				.set({
					playback_track_id: body.track_id,
					playback_position_seconds: body.position_seconds ?? null,
					playback_playing: body.playing ?? false,
				})
				.where(eq(users.id, userId));
		}
		if (body.seconds > 0 && body.track_id) {
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
}
