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
	): Promise<{ id: number; name: string }[]> {
		return client
			.select({ id: artists.id, name: artists.name })
			.from(artists)
			.innerJoin(album_artists, eq(album_artists.artist_id, artists.id))
			.where(eq(album_artists.album_id, albumId));
	}

	static async listAlbums(client: DbLike) {
		const rows = await client
			.select({
				id: albums.id,
				title: albums.title,
				cover_path: albums.cover_path,
				artist_name: artists.name,
			})
			.from(albums)
			.leftJoin(album_artists, eq(album_artists.album_id, albums.id))
			.leftJoin(artists, eq(artists.id, album_artists.artist_id))
			.orderBy(albums.title);

		const byId = new Map<
			number,
			{
				id: number;
				title: string;
				cover_path: string | null;
				artists: string[];
			}
		>();
		for (const row of rows) {
			let album = byId.get(row.id);
			if (!album) {
				album = {
					id: row.id,
					title: row.title,
					cover_path: row.cover_path,
					artists: [],
				};
				byId.set(row.id, album);
			}
			if (row.artist_name) album.artists.push(row.artist_name);
		}
		return Array.from(byId.values());
	}
}
