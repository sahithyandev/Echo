import { count, eq, sql } from "drizzle-orm";
import {
	albums,
	artists,
	listening,
	play_history,
	tracks,
	user_playback_state,
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
		const [[userRow], [playbackRow]] = await Promise.all([
			db
				.select({ shuffle: users.shuffle, repeat_mode: users.repeat_mode })
				.from(users)
				.where(eq(users.id, userId))
				.limit(1),
			db
				.select({
					track_id: user_playback_state.track_id,
					position_seconds: user_playback_state.position_seconds,
					playing: user_playback_state.playing,
				})
				.from(user_playback_state)
				.where(eq(user_playback_state.user_id, userId))
				.limit(1),
		]);
		return {
			shuffle: userRow.shuffle,
			repeat_mode: userRow.repeat_mode,
			playback_track_id: playbackRow?.track_id ?? null,
			playback_position_seconds: playbackRow?.position_seconds ?? null,
			playback_playing: playbackRow?.playing ?? false,
		};
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
			const values = {
				track_id: body.track_id,
				position_seconds: body.position_seconds ?? null,
				playing: body.playing ?? false,
			};
			await db
				.insert(user_playback_state)
				.values({ user_id: userId, ...values })
				.onConflictDoUpdate({
					target: user_playback_state.user_id,
					set: values,
				});
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
