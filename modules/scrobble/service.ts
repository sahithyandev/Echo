import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import {
	artists,
	play_history,
	track_artists,
	tracks,
	users,
} from "../../db/schema";
import type { DbLike } from "../../db/types";

function md5(input: string): string {
	return createHash("md5").update(input).digest("hex");
}

export abstract class ScrobbleService {
	/**
	 * Validates an AudioScrobbler 1.2 handshake auth token against the same
	 * `subsonic_password` credential Subsonic clients already use:
	 * token == md5(md5(password) + timestamp).
	 */
	static async authenticate(
		db: DbLike,
		username: string,
		timestamp: string,
		token: string,
	): Promise<number | null> {
		const [user] = await db
			.select({ id: users.id, subsonic_password: users.subsonic_password })
			.from(users)
			.where(eq(users.name, username))
			.limit(1);
		if (!user?.subsonic_password) return null;
		const expected = md5(md5(user.subsonic_password) + timestamp);
		return expected === token.toLowerCase() ? user.id : null;
	}

	/** Case-insensitive artist+title lookup against the library. */
	static async findTrack(
		db: DbLike,
		artist: string,
		title: string,
	): Promise<number | null> {
		const [row] = await db
			.select({ id: tracks.id })
			.from(tracks)
			.innerJoin(track_artists, eq(track_artists.track_id, tracks.id))
			.innerJoin(artists, eq(artists.id, track_artists.artist_id))
			.where(
				and(
					sql`lower(${tracks.title}) = lower(${title})`,
					sql`lower(${artists.name}) = lower(${artist})`,
				),
			)
			.limit(1);
		return row?.id ?? null;
	}

	/**
	 * Records a submitted scrobble against a matching library track. Silently
	 * a no-op if artist+title don't match anything in the library — Echo only
	 * tracks plays of music it already knows about.
	 */
	static async submit(
		db: DbLike,
		userId: number,
		artist: string,
		title: string,
		timestampUtc: number,
	): Promise<void> {
		const trackId = await ScrobbleService.findTrack(db, artist, title);
		if (!trackId) return;
		await db.insert(play_history).values({
			user_id: userId,
			track_id: trackId,
			played_at: new Date(timestampUtc * 1000),
		});
	}
}
