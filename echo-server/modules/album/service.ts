import { eq } from "drizzle-orm";
import { album_artists, albums, artists, tracks } from "../../db/schema";
import type { DbLike } from "../../db/types";

export abstract class AlbumService {
	static async findAlbum(client: DbLike, id: number) {
		const rows = await client.select().from(albums).where(eq(albums.id, id));
		return rows[0] ?? null;
	}

	static async getAlbumTracks(client: DbLike, albumId: number) {
		return client
			.select({
				id: tracks.id,
				title: tracks.title,
				duration_seconds: tracks.duration_seconds,
				track_number: tracks.track_number,
			})
			.from(tracks)
			.where(eq(tracks.album_id, albumId))
			.orderBy(tracks.track_number);
	}

	static async getAlbumArtists(
		client: DbLike,
		albumId: number,
	): Promise<string[]> {
		const rows = await client
			.select({ name: artists.name })
			.from(artists)
			.innerJoin(album_artists, eq(album_artists.artist_id, artists.id))
			.where(eq(album_artists.album_id, albumId));
		return rows.map((r) => r.name);
	}
}
