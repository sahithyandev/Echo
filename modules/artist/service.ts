import { and, eq, ne } from "drizzle-orm";
import { album_artists, artists, track_artists, tracks } from "../../db/schema";
import type { DbLike } from "../../db/types";
import { LibraryService } from "../library/service";

export abstract class ArtistService {
	static async findArtist(client: DbLike, id: number) {
		const rows = await client.select().from(artists).where(eq(artists.id, id));
		return rows[0] ?? null;
	}

	/** Renames an artist, merging into an existing artist of the same name if one exists. */
	static async renameArtist(
		client: DbLike,
		id: number,
		name: string,
	): Promise<{ merged: boolean; id: number }> {
		const existing = await client
			.select({ id: artists.id })
			.from(artists)
			.where(and(eq(artists.name, name), ne(artists.id, id)));
		const survivorId = existing[0]?.id;

		if (survivorId === undefined) {
			await client.update(artists).set({ name }).where(eq(artists.id, id));
			const affected = await client
				.select({ track_id: track_artists.track_id })
				.from(track_artists)
				.where(eq(track_artists.artist_id, id));
			void LibraryService.syncTracksTags(
				client,
				affected.map((r) => r.track_id),
			);
			return { merged: false, id };
		}

		const loserTracks = await client
			.select({ track_id: track_artists.track_id })
			.from(track_artists)
			.where(eq(track_artists.artist_id, id));
		await client.transaction(async (tx) => {
			if (loserTracks.length > 0) {
				await tx
					.insert(track_artists)
					.values(
						loserTracks.map((row) => ({
							track_id: row.track_id,
							artist_id: survivorId,
						})),
					)
					.onConflictDoNothing();
			}
			const loserAlbums = await tx
				.select({ album_id: album_artists.album_id })
				.from(album_artists)
				.where(eq(album_artists.artist_id, id));
			if (loserAlbums.length > 0) {
				await tx
					.insert(album_artists)
					.values(
						loserAlbums.map((row) => ({
							album_id: row.album_id,
							artist_id: survivorId,
						})),
					)
					.onConflictDoNothing();
			}
			await tx.delete(track_artists).where(eq(track_artists.artist_id, id));
			await tx.delete(album_artists).where(eq(album_artists.artist_id, id));
			await tx.delete(artists).where(eq(artists.id, id));
		});
		void LibraryService.syncTracksTags(
			client,
			loserTracks.map((r) => r.track_id),
		);
		return { merged: true, id: survivorId };
	}

	static async listArtists(client: DbLike) {
		return client
			.select({ id: artists.id, name: artists.name })
			.from(artists)
			.orderBy(artists.name);
	}

	static async getArtistTracks(client: DbLike, artistId: number) {
		return client
			.select({
				id: tracks.id,
				title: tracks.title,
				duration_seconds: tracks.duration_seconds,
			})
			.from(tracks)
			.innerJoin(track_artists, eq(track_artists.track_id, tracks.id))
			.where(eq(track_artists.artist_id, artistId))
			.orderBy(tracks.title);
	}
}
