import { unlink } from "node:fs/promises";
import { and, eq, ne } from "drizzle-orm";
import { album_artists, albums, artists, tracks } from "../../db/schema";
import type { DbLike } from "../../db/types";
import { LibraryService } from "../library/service";
import { SettingsService } from "../settings/service";

export abstract class AlbumService {
	static async findAlbum(client: DbLike, id: number) {
		const rows = await client.select().from(albums).where(eq(albums.id, id));
		return rows[0] ?? null;
	}

	/** Renames an album, merging into an existing album of the same title if one exists. */
	static async renameAlbum(
		client: DbLike,
		id: number,
		title: string,
	): Promise<{ merged: boolean; id: number }> {
		const existing = await client
			.select({ id: albums.id })
			.from(albums)
			.where(and(eq(albums.title, title), ne(albums.id, id)));
		const survivorId = existing[0]?.id;

		if (survivorId === undefined) {
			await client.update(albums).set({ title }).where(eq(albums.id, id));
			void AlbumService.syncAlbumTrackTags(client, id);
			return { merged: false, id };
		}

		await client
			.update(tracks)
			.set({ album_id: survivorId })
			.where(eq(tracks.album_id, id));
		for (const row of await client
			.select({ artist_id: album_artists.artist_id })
			.from(album_artists)
			.where(eq(album_artists.album_id, id))) {
			await client
				.insert(album_artists)
				.values({ album_id: survivorId, artist_id: row.artist_id })
				.onConflictDoNothing();
		}
		await client.delete(album_artists).where(eq(album_artists.album_id, id));
		await client.delete(albums).where(eq(albums.id, id));

		const { dataDir } = await SettingsService.getDirs(client);
		await unlink(`${dataDir}/art/${id}.jpg`).catch(() => null);
		void AlbumService.syncAlbumTrackTags(client, survivorId);
		return { merged: true, id: survivorId };
	}

	/** Background: pushes the current DB title/artists for every track in an album out to its file tags. */
	static async syncAlbumTrackTags(client: DbLike, albumId: number) {
		const rows = await client
			.select({ id: tracks.id })
			.from(tracks)
			.where(eq(tracks.album_id, albumId));
		await LibraryService.syncTracksTags(
			client,
			rows.map((r) => r.id),
		);
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
