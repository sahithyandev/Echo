import { eq, inArray, like } from "drizzle-orm";
import { albums, artists, track_artists, tracks } from "../../db/schema";
import type { DbLike } from "../../db/types";
import type { TrackEntry } from "../library/service";

const LIMIT = 8;

export abstract class SearchService {
	static async searchAll(client: DbLike, q: string) {
		const query = q.trim();
		if (!query) return { artists: [], albums: [], tracks: [] as TrackEntry[] };

		const pattern = `%${query}%`;

		const [matchedArtists, matchedAlbums, matchedTrackIds] = await Promise.all([
			client
				.select({ id: artists.id, name: artists.name })
				.from(artists)
				.where(like(artists.name, pattern))
				.orderBy(artists.name)
				.limit(LIMIT),
			client
				.select({
					id: albums.id,
					title: albums.title,
					cover_path: albums.cover_path,
				})
				.from(albums)
				.where(like(albums.title, pattern))
				.orderBy(albums.title)
				.limit(LIMIT),
			client
				.select({ id: tracks.id })
				.from(tracks)
				.where(like(tracks.title, pattern))
				.orderBy(tracks.title)
				.limit(LIMIT),
		]);

		const ids = matchedTrackIds.map((t) => t.id);
		const matchedTracks = ids.length
			? await searchTracksByIds(client, ids)
			: [];

		return {
			artists: matchedArtists,
			albums: matchedAlbums,
			tracks: matchedTracks,
		};
	}
}

/** Re-attaches artists/album to the given track ids, mirroring LibraryService.listTracks. */
async function searchTracksByIds(
	client: DbLike,
	ids: number[],
): Promise<TrackEntry[]> {
	const rows = await client
		.select({
			id: tracks.id,
			title: tracks.title,
			duration_seconds: tracks.duration_seconds,
			artist_id: artists.id,
			artist_name: artists.name,
			album_id: albums.id,
			album_title: albums.title,
			album_cover_path: albums.cover_path,
		})
		.from(tracks)
		.leftJoin(track_artists, eq(track_artists.track_id, tracks.id))
		.leftJoin(artists, eq(artists.id, track_artists.artist_id))
		.leftJoin(albums, eq(albums.id, tracks.album_id))
		.where(inArray(tracks.id, ids));

	const trackMap = new Map<number, TrackEntry>();
	for (const row of rows) {
		if (!trackMap.has(row.id)) {
			trackMap.set(row.id, {
				id: row.id,
				title: row.title,
				duration_seconds: row.duration_seconds,
				artists: [],
				album:
					row.album_id && row.album_title
						? {
								id: row.album_id,
								title: row.album_title,
								cover_path: row.album_cover_path ?? null,
							}
						: null,
			});
		}
		if (row.artist_id && row.artist_name)
			trackMap
				.get(row.id)
				?.artists.push({ id: row.artist_id, name: row.artist_name });
	}
	// Preserve the title-ordered id sequence from the id query above.
	return ids.map((id) => trackMap.get(id)).filter((t): t is TrackEntry => !!t);
}
