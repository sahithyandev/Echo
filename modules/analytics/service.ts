import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
	albums,
	artists,
	listening,
	play_history,
	track_artists,
	tracks,
} from "../../db/schema";
import type { DbLike } from "../../db/types";

export abstract class AnalyticsService {
	/** Per-user play counts for a set of tracks, keyed by track id. */
	static async getPlayCounts(
		client: DbLike,
		userId: number,
		trackIds: number[],
	): Promise<Map<number, number>> {
		if (trackIds.length === 0) return new Map();
		const rows = await client
			.select({ track_id: play_history.track_id, count: sql<number>`count(*)` })
			.from(play_history)
			.where(
				and(
					eq(play_history.user_id, userId),
					inArray(play_history.track_id, trackIds),
				),
			)
			.groupBy(play_history.track_id);
		return new Map(rows.map((r) => [r.track_id, r.count]));
	}

	/** Most recent completed plays for a user, newest first. */
	static async recentPlays(client: DbLike, userId: number, limit = 100) {
		const rows = await client
			.select({
				track_id: tracks.id,
				title: tracks.title,
				album_title: albums.title,
				cover_path: albums.cover_path,
				artist_name: artists.name,
				played_at: play_history.played_at,
			})
			.from(play_history)
			.innerJoin(tracks, eq(tracks.id, play_history.track_id))
			.leftJoin(albums, eq(albums.id, tracks.album_id))
			.leftJoin(track_artists, eq(track_artists.track_id, tracks.id))
			.leftJoin(artists, eq(artists.id, track_artists.artist_id))
			.where(eq(play_history.user_id, userId))
			.groupBy(play_history.id)
			.orderBy(desc(play_history.played_at))
			.limit(limit);
		return rows;
	}

	static async totalPlaybackSeconds(
		client: DbLike,
		userId: number,
	): Promise<number> {
		const [row] = await client
			.select({ total: sql<number>`coalesce(sum(${listening.seconds}), 0)` })
			.from(listening)
			.where(eq(listening.user_id, userId));
		return row?.total ?? 0;
	}

	static async playbackByArtist(client: DbLike, userId: number) {
		return client
			.select({
				artist_id: artists.id,
				artist_name: artists.name,
				seconds: sql<number>`coalesce(sum(${listening.seconds}), 0)`,
			})
			.from(listening)
			.innerJoin(tracks, eq(tracks.id, listening.track_id))
			.innerJoin(track_artists, eq(track_artists.track_id, tracks.id))
			.innerJoin(artists, eq(artists.id, track_artists.artist_id))
			.where(eq(listening.user_id, userId))
			.groupBy(artists.id)
			.orderBy(desc(sql`sum(${listening.seconds})`));
	}

	static async playbackByAlbum(client: DbLike, userId: number) {
		return client
			.select({
				album_id: albums.id,
				album_title: albums.title,
				cover_path: albums.cover_path,
				seconds: sql<number>`coalesce(sum(${listening.seconds}), 0)`,
			})
			.from(listening)
			.innerJoin(tracks, eq(tracks.id, listening.track_id))
			.innerJoin(albums, eq(albums.id, tracks.album_id))
			.where(eq(listening.user_id, userId))
			.groupBy(albums.id)
			.orderBy(desc(sql`sum(${listening.seconds})`));
	}

	static async playbackByDay(client: DbLike, userId: number) {
		return client
			.select({
				day: listening.day,
				seconds: sql<number>`coalesce(sum(${listening.seconds}), 0)`,
			})
			.from(listening)
			.where(eq(listening.user_id, userId))
			.groupBy(listening.day)
			.orderBy(listening.day);
	}

	static async playbackByYear(client: DbLike, userId: number) {
		return client
			.select({
				year: tracks.year,
				seconds: sql<number>`coalesce(sum(${listening.seconds}), 0)`,
			})
			.from(listening)
			.innerJoin(tracks, eq(tracks.id, listening.track_id))
			.where(eq(listening.user_id, userId))
			.groupBy(tracks.year)
			.orderBy(desc(tracks.year));
	}
}
