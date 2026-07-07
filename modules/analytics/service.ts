import { desc, eq, sql } from "drizzle-orm";
import {
	albums,
	artists,
	listening,
	track_artists,
	tracks,
} from "../../db/schema";
import type { DbLike } from "../../db/types";

export abstract class AnalyticsService {
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
