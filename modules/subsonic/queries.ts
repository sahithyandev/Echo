import { and, desc, eq, inArray, isNotNull, like, sql } from "drizzle-orm";
import {
	album_artists,
	albums,
	artists,
	play_history,
	track_artists,
	tracks,
	user_playback_state,
	users,
} from "../../db/schema";
import type { DbLike } from "../../db/types";

export type AlbumRow = {
	id: number;
	title: string;
	year: number | null;
	genre: string | null;
	cover_path: string | null;
};

export type SongRow = {
	id: number;
	title: string;
	track_number: number | null;
	year: number | null;
	duration_seconds: number | null;
	file_path: string;
	album_id: number | null;
	album_title: string | null;
	album_cover_path: string | null;
	genre: string | null;
};

const songColumns = {
	id: tracks.id,
	title: tracks.title,
	track_number: tracks.track_number,
	year: tracks.year,
	duration_seconds: tracks.duration_seconds,
	file_path: tracks.file_path,
	album_id: tracks.album_id,
	album_title: albums.title,
	album_cover_path: albums.cover_path,
	genre: albums.genre,
} as const;

export abstract class SubsonicQueries {
	static async getArtistsIndexed(db: DbLike) {
		return db
			.select({
				id: artists.id,
				name: artists.name,
				albumCount: sql<number>`count(distinct ${album_artists.album_id})`,
			})
			.from(artists)
			.leftJoin(album_artists, eq(album_artists.artist_id, artists.id))
			.groupBy(artists.id)
			.orderBy(artists.name);
	}

	static async getArtistById(db: DbLike, id: number) {
		const [row] = await db
			.select({ id: artists.id, name: artists.name })
			.from(artists)
			.where(eq(artists.id, id))
			.limit(1);
		return row ?? null;
	}

	static async getArtistAlbums(db: DbLike, artistId: number) {
		return db
			.select({
				id: albums.id,
				title: albums.title,
				year: albums.year,
				genre: albums.genre,
				cover_path: albums.cover_path,
				songCount: sql<number>`count(distinct ${tracks.id})`,
				duration: sql<number>`coalesce(sum(distinct ${tracks.duration_seconds}), 0)`,
			})
			.from(albums)
			.innerJoin(album_artists, eq(album_artists.album_id, albums.id))
			.leftJoin(tracks, eq(tracks.album_id, albums.id))
			.where(eq(album_artists.artist_id, artistId))
			.groupBy(albums.id)
			.orderBy(desc(albums.year));
	}

	static async getAlbumById(db: DbLike, id: number): Promise<AlbumRow | null> {
		const [row] = await db
			.select({
				id: albums.id,
				title: albums.title,
				year: albums.year,
				genre: albums.genre,
				cover_path: albums.cover_path,
			})
			.from(albums)
			.where(eq(albums.id, id))
			.limit(1);
		return row ?? null;
	}

	/** First-listed artist for an album (Subsonic's `album` object only carries one artist/artistId). */
	static async getAlbumPrimaryArtist(db: DbLike, albumId: number) {
		const [row] = await db
			.select({ id: artists.id, name: artists.name })
			.from(album_artists)
			.innerJoin(artists, eq(artists.id, album_artists.artist_id))
			.where(eq(album_artists.album_id, albumId))
			.orderBy(artists.name)
			.limit(1);
		return row ?? null;
	}

	static async getSongById(db: DbLike, id: number): Promise<SongRow | null> {
		const [row] = await db
			.select(songColumns)
			.from(tracks)
			.leftJoin(albums, eq(albums.id, tracks.album_id))
			.where(eq(tracks.id, id))
			.limit(1);
		return row ?? null;
	}

	static async getAlbumSongs(db: DbLike, albumId: number): Promise<SongRow[]> {
		return db
			.select(songColumns)
			.from(tracks)
			.leftJoin(albums, eq(albums.id, tracks.album_id))
			.where(eq(tracks.album_id, albumId))
			.orderBy(tracks.track_number, tracks.title);
	}

	/** First-listed artist name per track id, for the song `artist` field. */
	static async getTrackArtistNames(
		db: DbLike,
		trackIds: number[],
	): Promise<Map<number, string>> {
		if (trackIds.length === 0) return new Map();
		const rows = await db
			.select({ track_id: track_artists.track_id, name: artists.name })
			.from(track_artists)
			.innerJoin(artists, eq(artists.id, track_artists.artist_id))
			.where(inArray(track_artists.track_id, trackIds));
		const byTrack = new Map<number, string>();
		for (const row of rows)
			if (!byTrack.has(row.track_id)) byTrack.set(row.track_id, row.name);
		return byTrack;
	}

	static async getPlayCounts(
		db: DbLike,
		trackIds: number[],
	): Promise<Map<number, number>> {
		if (trackIds.length === 0) return new Map();
		const rows = await db
			.select({ track_id: play_history.track_id, count: sql<number>`count(*)` })
			.from(play_history)
			.where(inArray(play_history.track_id, trackIds))
			.groupBy(play_history.track_id);
		return new Map(rows.map((r) => [r.track_id, r.count]));
	}

	static async getGenres(db: DbLike) {
		return db
			.select({
				genre: albums.genre,
				albumCount: sql<number>`count(distinct ${albums.id})`,
				songCount: sql<number>`count(${tracks.id})`,
			})
			.from(albums)
			.leftJoin(tracks, eq(tracks.album_id, albums.id))
			.where(isNotNull(albums.genre))
			.groupBy(albums.genre)
			.orderBy(albums.genre);
	}

	static async getSongsByGenre(
		db: DbLike,
		genre: string,
		count: number,
		offset: number,
	): Promise<SongRow[]> {
		return db
			.select(songColumns)
			.from(tracks)
			.innerJoin(albums, eq(albums.id, tracks.album_id))
			.where(eq(albums.genre, genre))
			.orderBy(tracks.title)
			.limit(count)
			.offset(offset);
	}

	static async getRandomSongs(
		db: DbLike,
		size: number,
		genre?: string,
	): Promise<SongRow[]> {
		return db
			.select(songColumns)
			.from(tracks)
			.leftJoin(albums, eq(albums.id, tracks.album_id))
			.where(genre ? eq(albums.genre, genre) : undefined)
			.orderBy(sql`random()`)
			.limit(size);
	}

	static async getAlbumList(
		db: DbLike,
		opts: {
			type: string;
			size: number;
			offset: number;
			userId: number;
			genre?: string;
			fromYear?: number;
			toYear?: number;
		},
	): Promise<AlbumRow[]> {
		const cols = {
			id: albums.id,
			title: albums.title,
			year: albums.year,
			genre: albums.genre,
			cover_path: albums.cover_path,
		};

		switch (opts.type) {
			case "random":
				return db
					.select(cols)
					.from(albums)
					.orderBy(sql`random()`)
					.limit(opts.size);
			case "alphabeticalByName":
				return db
					.select(cols)
					.from(albums)
					.orderBy(albums.title)
					.limit(opts.size)
					.offset(opts.offset);
			case "byGenre":
				return db
					.select(cols)
					.from(albums)
					.where(eq(albums.genre, opts.genre ?? ""))
					.orderBy(albums.title)
					.limit(opts.size)
					.offset(opts.offset);
			case "byYear":
				return db
					.select(cols)
					.from(albums)
					.where(
						and(
							sql`${albums.year} >= ${opts.fromYear ?? 0}`,
							sql`${albums.year} <= ${opts.toYear ?? 9999}`,
						),
					)
					.orderBy(albums.year)
					.limit(opts.size)
					.offset(opts.offset);
			case "frequent":
				return db
					.select({ ...cols, plays: sql<number>`count(${play_history.id})` })
					.from(albums)
					.innerJoin(tracks, eq(tracks.album_id, albums.id))
					.innerJoin(
						play_history,
						and(
							eq(play_history.track_id, tracks.id),
							eq(play_history.user_id, opts.userId),
						),
					)
					.groupBy(albums.id)
					.orderBy(desc(sql`count(${play_history.id})`))
					.limit(opts.size)
					.offset(opts.offset);
			case "recent":
				return db
					.select({
						...cols,
						lastPlayed: sql<number>`max(${play_history.played_at})`,
					})
					.from(albums)
					.innerJoin(tracks, eq(tracks.album_id, albums.id))
					.innerJoin(
						play_history,
						and(
							eq(play_history.track_id, tracks.id),
							eq(play_history.user_id, opts.userId),
						),
					)
					.groupBy(albums.id)
					.orderBy(desc(sql`max(${play_history.played_at})`))
					.limit(opts.size)
					.offset(opts.offset);
			default:
				return db
					.select(cols)
					.from(albums)
					.orderBy(desc(albums.id))
					.limit(opts.size)
					.offset(opts.offset);
		}
	}

	/** Subsonic's search3: an empty/absent query means "list everything", paginated by limit/offset. */
	static async searchArtists(
		db: DbLike,
		query: string | undefined,
		limit: number,
		offset: number,
	) {
		return db
			.select({ id: artists.id, name: artists.name })
			.from(artists)
			.where(query ? like(artists.name, `%${query}%`) : undefined)
			.orderBy(artists.name)
			.limit(limit)
			.offset(offset);
	}

	static async searchAlbums(
		db: DbLike,
		query: string | undefined,
		limit: number,
		offset: number,
	): Promise<AlbumRow[]> {
		return db
			.select({
				id: albums.id,
				title: albums.title,
				year: albums.year,
				genre: albums.genre,
				cover_path: albums.cover_path,
			})
			.from(albums)
			.where(query ? like(albums.title, `%${query}%`) : undefined)
			.orderBy(albums.title)
			.limit(limit)
			.offset(offset);
	}

	static async searchSongs(
		db: DbLike,
		query: string | undefined,
		limit: number,
		offset: number,
	): Promise<SongRow[]> {
		return db
			.select(songColumns)
			.from(tracks)
			.leftJoin(albums, eq(albums.id, tracks.album_id))
			.where(query ? like(tracks.title, `%${query}%`) : undefined)
			.orderBy(tracks.title)
			.limit(limit)
			.offset(offset);
	}

	static async getNowPlaying(db: DbLike) {
		return db
			.select({
				username: users.name,
				position_seconds: user_playback_state.position_seconds,
				...songColumns,
			})
			.from(user_playback_state)
			.innerJoin(users, eq(users.id, user_playback_state.user_id))
			.innerJoin(tracks, eq(tracks.id, user_playback_state.track_id))
			.leftJoin(albums, eq(albums.id, tracks.album_id))
			.where(eq(user_playback_state.playing, true));
	}
}
