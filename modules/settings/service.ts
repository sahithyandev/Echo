import { count, eq, sql } from "drizzle-orm";
import {
	albums,
	app_settings,
	artists,
	listening,
	play_history,
	tracks,
	user_playback_state,
	users,
} from "../../db/schema";
import type { DbLike } from "../../db/types";
import { getEnvVar } from "../../utils/env";
import type { SettingsModel } from "./model";

let dirsCache: { musicDir: string; dataDir: string } | undefined;

export abstract class SettingsService {
	static async getDirs(db: DbLike) {
		if (dirsCache) return dirsCache;
		const [row] = await db
			.select()
			.from(app_settings)
			.where(eq(app_settings.id, 1))
			.limit(1);
		dirsCache = {
			musicDir: row?.music_dir || getEnvVar("ECHO_MUSIC_DIR"),
			dataDir: row?.data_dir || getEnvVar("ECHO_DATA_DIR"),
		};
		return dirsCache;
	}

	static async setDirs(db: DbLike, musicDir: string, dataDir: string) {
		await db
			.insert(app_settings)
			.values({ id: 1, music_dir: musicDir, data_dir: dataDir })
			.onConflictDoUpdate({
				target: app_settings.id,
				set: { music_dir: musicDir, data_dir: dataDir },
			});
		dirsCache = { musicDir, dataDir };
	}

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

	static async getSubsonicPassword(db: DbLike, userId: number) {
		const [row] = await db
			.select({ subsonic_password: users.subsonic_password })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);
		return row?.subsonic_password ?? null;
	}

	static async setSubsonicPassword(
		db: DbLike,
		userId: number,
		password: string | null,
	) {
		await db
			.update(users)
			.set({ subsonic_password: password })
			.where(eq(users.id, userId));
	}

	/** Records a completed play (Subsonic scrobble submission=true): history + today's listening time. */
	static async scrobbleSubmission(db: DbLike, userId: number, trackId: number) {
		const [[track]] = await Promise.all([
			db
				.select({ duration_seconds: tracks.duration_seconds })
				.from(tracks)
				.where(eq(tracks.id, trackId))
				.limit(1),
			SettingsService.recordHistory(db, userId, trackId),
		]);
		await SettingsService.syncPlayback(db, userId, {
			track_id: trackId,
			seconds: track?.duration_seconds ?? 0,
			playing: false,
		});
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
