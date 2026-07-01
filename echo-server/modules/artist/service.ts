import { eq } from "drizzle-orm";
import { artists, track_artists, tracks } from "../../db/schema";
import type { DbLike } from "../../db/types";

export abstract class ArtistService {
	static async findArtist(client: DbLike, id: number) {
		const rows = await client.select().from(artists).where(eq(artists.id, id));
		return rows[0] ?? null;
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
