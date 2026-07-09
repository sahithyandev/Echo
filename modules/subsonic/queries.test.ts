import { beforeEach, describe, expect, it } from "bun:test";
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
import { makeTestDb } from "../../db/test-client";
import type { DbLike } from "../../db/types";
import { SubsonicQueries } from "./queries";

let db: DbLike;

async function seed() {
	const [artistA] = await db
		.insert(artists)
		.values({ name: "Artist A" })
		.returning({ id: artists.id });
	const [artistB] = await db
		.insert(artists)
		.values({ name: "Artist B" })
		.returning({ id: artists.id });
	const [album] = await db
		.insert(albums)
		.values({ title: "Album One", year: 2020, genre: "Jazz" })
		.returning({ id: albums.id });
	await db
		.insert(album_artists)
		.values({ album_id: album.id, artist_id: artistA.id });

	const [trackA] = await db
		.insert(tracks)
		.values({
			title: "Alpha",
			album_id: album.id,
			track_number: 1,
			duration_seconds: 200,
			file_path: "/music/alpha.mp3",
		})
		.returning({ id: tracks.id });
	const [trackB] = await db
		.insert(tracks)
		.values({
			title: "Beta",
			album_id: album.id,
			track_number: 2,
			duration_seconds: 180,
			file_path: "/music/beta.mp3",
		})
		.returning({ id: tracks.id });
	await db
		.insert(track_artists)
		.values({ track_id: trackA.id, artist_id: artistA.id });
	await db
		.insert(track_artists)
		.values({ track_id: trackB.id, artist_id: artistB.id });

	const [user] = await db
		.insert(users)
		.values({ name: "alice", email: "alice@example.com", password: "x" })
		.returning({ id: users.id });

	await db
		.insert(play_history)
		.values({ user_id: user.id, track_id: trackA.id });
	await db
		.insert(play_history)
		.values({ user_id: user.id, track_id: trackA.id });

	return { artistA, artistB, album, trackA, trackB, user };
}

beforeEach(() => {
	db = makeTestDb();
});

describe("SubsonicQueries artists", () => {
	it("indexes artists with album counts", async () => {
		const { artistA } = await seed();
		const rows = await SubsonicQueries.getArtistsIndexed(db);
		expect(rows.find((r) => r.id === artistA.id)?.albumCount).toBe(1);
	});

	it("gets an artist by id", async () => {
		const { artistA } = await seed();
		const row = await SubsonicQueries.getArtistById(db, artistA.id);
		expect(row?.name).toBe("Artist A");
	});

	it("returns null for an unknown artist", async () => {
		const row = await SubsonicQueries.getArtistById(db, 9999);
		expect(row).toBeNull();
	});

	it("gets an artist's albums", async () => {
		const { artistA, album } = await seed();
		const rows = await SubsonicQueries.getArtistAlbums(db, artistA.id);
		expect(rows).toHaveLength(1);
		expect(rows[0].id).toBe(album.id);
		expect(rows[0].songCount).toBe(2);
	});
});

describe("SubsonicQueries albums", () => {
	it("gets an album by id", async () => {
		const { album } = await seed();
		const row = await SubsonicQueries.getAlbumById(db, album.id);
		expect(row?.title).toBe("Album One");
	});

	it("returns null for an unknown album", async () => {
		const row = await SubsonicQueries.getAlbumById(db, 9999);
		expect(row).toBeNull();
	});

	it("gets the album's primary artist", async () => {
		const { album, artistA } = await seed();
		const row = await SubsonicQueries.getAlbumPrimaryArtist(db, album.id);
		expect(row?.id).toBe(artistA.id);
	});

	it("returns null for an album with no artist", async () => {
		const [album] = await db
			.insert(albums)
			.values({ title: "Solo" })
			.returning({ id: albums.id });
		const row = await SubsonicQueries.getAlbumPrimaryArtist(db, album.id);
		expect(row).toBeNull();
	});
});

describe("SubsonicQueries songs", () => {
	it("gets a song by id", async () => {
		const { trackA } = await seed();
		const row = await SubsonicQueries.getSongById(db, trackA.id);
		expect(row?.title).toBe("Alpha");
	});

	it("returns null for an unknown song", async () => {
		const row = await SubsonicQueries.getSongById(db, 9999);
		expect(row).toBeNull();
	});

	it("gets an album's songs ordered by track number", async () => {
		const { album } = await seed();
		const rows = await SubsonicQueries.getAlbumSongs(db, album.id);
		expect(rows.map((r) => r.title)).toEqual(["Alpha", "Beta"]);
	});

	it("maps track ids to their first artist name", async () => {
		const { trackA, trackB } = await seed();
		const names = await SubsonicQueries.getTrackArtistNames(db, [
			trackA.id,
			trackB.id,
		]);
		expect(names.get(trackA.id)).toBe("Artist A");
		expect(names.get(trackB.id)).toBe("Artist B");
	});

	it("returns an empty map for an empty track id list", async () => {
		const names = await SubsonicQueries.getTrackArtistNames(db, []);
		expect(names.size).toBe(0);
	});

	it("counts plays per track", async () => {
		const { trackA, trackB } = await seed();
		const counts = await SubsonicQueries.getPlayCounts(db, [
			trackA.id,
			trackB.id,
		]);
		expect(counts.get(trackA.id)).toBe(2);
		expect(counts.get(trackB.id)).toBeUndefined();
	});

	it("returns an empty map when given no track ids", async () => {
		const counts = await SubsonicQueries.getPlayCounts(db, []);
		expect(counts.size).toBe(0);
	});
});

describe("SubsonicQueries genres", () => {
	it("aggregates genres with album/song counts", async () => {
		await seed();
		const rows = await SubsonicQueries.getGenres(db);
		expect(rows).toHaveLength(1);
		expect(rows[0].genre).toBe("Jazz");
		expect(rows[0].songCount).toBe(2);
	});

	it("fetches songs filtered by genre with pagination", async () => {
		await seed();
		const rows = await SubsonicQueries.getSongsByGenre(db, "Jazz", 1, 0);
		expect(rows).toHaveLength(1);
		expect(rows[0].title).toBe("Alpha");
	});
});

describe("SubsonicQueries random and album list", () => {
	it("returns random songs, optionally filtered by genre", async () => {
		await seed();
		const rows = await SubsonicQueries.getRandomSongs(db, 10, "Jazz");
		expect(rows).toHaveLength(2);
	});

	it("returns no random songs for a non-matching genre", async () => {
		await seed();
		const rows = await SubsonicQueries.getRandomSongs(db, 10, "Rock");
		expect(rows).toHaveLength(0);
	});

	it("lists albums alphabetically", async () => {
		await seed();
		const rows = await SubsonicQueries.getAlbumList(db, {
			type: "alphabeticalByName",
			size: 10,
			offset: 0,
			userId: 1,
		});
		expect(rows.map((r) => r.title)).toEqual(["Album One"]);
	});

	it("lists albums by genre", async () => {
		await seed();
		const rows = await SubsonicQueries.getAlbumList(db, {
			type: "byGenre",
			size: 10,
			offset: 0,
			userId: 1,
			genre: "Jazz",
		});
		expect(rows).toHaveLength(1);
	});

	it("lists albums by year range", async () => {
		await seed();
		const rows = await SubsonicQueries.getAlbumList(db, {
			type: "byYear",
			size: 10,
			offset: 0,
			userId: 1,
			fromYear: 2019,
			toYear: 2021,
		});
		expect(rows).toHaveLength(1);
	});

	it("lists random albums", async () => {
		await seed();
		const rows = await SubsonicQueries.getAlbumList(db, {
			type: "random",
			size: 10,
			offset: 0,
			userId: 1,
		});
		expect(rows).toHaveLength(1);
	});

	it("lists recently played albums for a user", async () => {
		const { user } = await seed();
		const rows = await SubsonicQueries.getAlbumList(db, {
			type: "recent",
			size: 10,
			offset: 0,
			userId: user.id,
		});
		expect(rows).toHaveLength(1);
	});

	it("lists frequently played albums for a user", async () => {
		const { user } = await seed();
		const rows = await SubsonicQueries.getAlbumList(db, {
			type: "frequent",
			size: 10,
			offset: 0,
			userId: user.id,
		});
		expect(rows).toHaveLength(1);
	});

	it("falls back to newest-by-id for an unknown type", async () => {
		await seed();
		const rows = await SubsonicQueries.getAlbumList(db, {
			type: "bogus",
			size: 10,
			offset: 0,
			userId: 1,
		});
		expect(rows).toHaveLength(1);
	});
});

describe("SubsonicQueries search", () => {
	it("searches artists by substring", async () => {
		await seed();
		const rows = await SubsonicQueries.searchArtists(db, "Artist A", 10, 0);
		expect(rows.map((r) => r.name)).toEqual(["Artist A"]);
	});

	it("lists everything when the search query is undefined", async () => {
		await seed();
		const rows = await SubsonicQueries.searchArtists(db, undefined, 10, 0);
		expect(rows).toHaveLength(2);
	});

	it("searches albums by substring", async () => {
		await seed();
		const rows = await SubsonicQueries.searchAlbums(db, "One", 10, 0);
		expect(rows).toHaveLength(1);
	});

	it("searches songs by substring", async () => {
		await seed();
		const rows = await SubsonicQueries.searchSongs(db, "Alpha", 10, 0);
		expect(rows.map((r) => r.title)).toEqual(["Alpha"]);
	});
});

describe("SubsonicQueries now playing", () => {
	it("returns rows for users currently playing a track", async () => {
		const { user, trackA } = await seed();
		await db.insert(user_playback_state).values({
			user_id: user.id,
			track_id: trackA.id,
			position_seconds: 10,
			playing: true,
		});
		const rows = await SubsonicQueries.getNowPlaying(db);
		expect(rows).toHaveLength(1);
		expect(rows[0].username).toBe("alice");
		expect(rows[0].title).toBe("Alpha");
	});

	it("excludes users who are not currently playing", async () => {
		const { user, trackA } = await seed();
		await db.insert(user_playback_state).values({
			user_id: user.id,
			track_id: trackA.id,
			playing: false,
		});
		const rows = await SubsonicQueries.getNowPlaying(db);
		expect(rows).toHaveLength(0);
	});
});
