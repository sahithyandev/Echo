import { beforeEach, describe, expect, it } from "bun:test";
import {
	album_artists,
	albums,
	artists,
	play_history,
	tracks,
	user_playback_state,
	users,
} from "../../db/schema";
import { makeTestDb } from "../../db/test-client";
import type { DbLike } from "../../db/types";
import { subsonicHandlers } from "./handlers";
import { makeId } from "./ids";
import { SubsonicError } from "./respond";

let db: DbLike;
type SubsonicUser = { id: number; name: string; email: string };

interface ArtistEntry {
	id: string;
	name: string;
	albumCount?: number;
}
interface ArtistIndexGroup {
	name: string;
	artist: ArtistEntry[];
}
interface DirectoryChild {
	isDir?: boolean;
	title?: string;
}
interface GenreEntry {
	value: string;
	songCount: number;
	albumCount: number;
}
interface AlbumListEntry {
	artist?: string;
}
interface NowPlayingEntry {
	username: string;
}
interface ResponsePayload {
	status: string;
	artists?: { index: ArtistIndexGroup[] };
	indexes?: { index: ArtistIndexGroup[] };
	directory?: { child: DirectoryChild[] };
	artist?: { name: string; album: unknown[] };
	album?: { name: string; song: unknown[] };
	song?: { title: string };
	genres?: { genre: GenreEntry[] };
	albumList2?: { album: AlbumListEntry[] };
	randomSongs?: { song: unknown[] };
	songsByGenre?: { song: unknown[] };
	searchResult3?: { artist: unknown[]; album: unknown[]; song: unknown[] };
	scanStatus?: { scanning: boolean };
	starred2?: { artist: unknown[] };
	starred?: { artist: unknown[] };
	playlists?: { playlist: unknown[] };
	nowPlaying?: { entry: NowPlayingEntry[] };
}

function payloadOf(result: { "subsonic-response": unknown }): ResponsePayload {
	return result["subsonic-response"] as unknown as ResponsePayload;
}

async function seed() {
	const [artistA] = await db
		.insert(artists)
		.values({ name: "Artist A" })
		.returning({ id: artists.id });
	const [album] = await db
		.insert(albums)
		.values({ title: "Album One", year: 2020, genre: "Jazz" })
		.returning({ id: albums.id });
	await db
		.insert(album_artists)
		.values({ album_id: album.id, artist_id: artistA.id });
	const [track] = await db
		.insert(tracks)
		.values({
			title: "Alpha",
			album_id: album.id,
			track_number: 1,
			duration_seconds: 200,
			file_path: "/music/alpha.mp3",
		})
		.returning({ id: tracks.id });
	const [user] = await db
		.insert(users)
		.values({ name: "alice", email: "alice@example.com", password: "x" })
		.returning({ id: users.id });
	return { artistA, album, track, user };
}

function asUser(user: { id: number }): SubsonicUser {
	return { id: user.id, name: "alice", email: "alice@example.com" };
}

beforeEach(() => {
	db = makeTestDb();
});

describe("simple handlers", () => {
	it("ping returns ok", async () => {
		const result = await subsonicHandlers.ping(db, asUser({ id: 1 }), {});
		expect(payloadOf(result).status).toBe("ok");
	});

	it("getArtists groups artists by first letter", async () => {
		await seed();
		const result = await subsonicHandlers.getArtists(db, asUser({ id: 1 }), {});
		const payload = payloadOf(result);
		expect(payload.artists?.index[0].name).toBe("A");
		expect(payload.artists?.index[0].artist[0].albumCount).toBe(1);
	});

	it("getIndexes groups artists without album counts", async () => {
		await seed();
		const result = await subsonicHandlers.getIndexes(db, asUser({ id: 1 }), {});
		const payload = payloadOf(result);
		expect(payload.indexes?.index[0].artist[0].albumCount).toBeUndefined();
	});
});

describe("getMusicDirectory", () => {
	it("lists albums as children for an artist id", async () => {
		const { artistA } = await seed();
		const result = await subsonicHandlers.getMusicDirectory(
			db,
			asUser({ id: 1 }),
			{ id: makeId("ar", artistA.id) },
		);
		const payload = payloadOf(result);
		expect(payload.directory?.child).toHaveLength(1);
		expect(payload.directory?.child[0].isDir).toBe(true);
	});

	it("lists songs as children for an album id", async () => {
		const { album } = await seed();
		const result = await subsonicHandlers.getMusicDirectory(
			db,
			asUser({ id: 1 }),
			{ id: makeId("al", album.id) },
		);
		const payload = payloadOf(result);
		expect(payload.directory?.child).toHaveLength(1);
		expect(payload.directory?.child[0].title).toBe("Alpha");
	});

	it("throws not found for a track id", async () => {
		const { track } = await seed();
		await expect(
			subsonicHandlers.getMusicDirectory(db, asUser({ id: 1 }), {
				id: makeId("tr", track.id),
			}),
		).rejects.toBeInstanceOf(SubsonicError);
	});

	it("throws not found for an unknown artist id", async () => {
		await expect(
			subsonicHandlers.getMusicDirectory(db, asUser({ id: 1 }), {
				id: makeId("ar", 9999),
			}),
		).rejects.toBeInstanceOf(SubsonicError);
	});
});

describe("getArtist / getAlbum / getSong", () => {
	it("returns an artist with its albums", async () => {
		const { artistA } = await seed();
		const result = await subsonicHandlers.getArtist(db, asUser({ id: 1 }), {
			id: makeId("ar", artistA.id),
		});
		const payload = payloadOf(result);
		expect(payload.artist?.name).toBe("Artist A");
		expect(payload.artist?.album).toHaveLength(1);
	});

	it("throws not found for a bogus id on getArtist", async () => {
		await expect(
			subsonicHandlers.getArtist(db, asUser({ id: 1 }), { id: "nope" }),
		).rejects.toBeInstanceOf(SubsonicError);
	});

	it("returns an album with its songs", async () => {
		const { album } = await seed();
		const result = await subsonicHandlers.getAlbum(db, asUser({ id: 1 }), {
			id: makeId("al", album.id),
		});
		const payload = payloadOf(result);
		expect(payload.album?.name).toBe("Album One");
		expect(payload.album?.song).toHaveLength(1);
	});

	it("throws not found for an unknown album", async () => {
		await expect(
			subsonicHandlers.getAlbum(db, asUser({ id: 1 }), {
				id: makeId("al", 9999),
			}),
		).rejects.toBeInstanceOf(SubsonicError);
	});

	it("returns a single song", async () => {
		const { track } = await seed();
		const result = await subsonicHandlers.getSong(db, asUser({ id: 1 }), {
			id: makeId("tr", track.id),
		});
		const payload = payloadOf(result);
		expect(payload.song?.title).toBe("Alpha");
	});

	it("throws not found for an unknown song", async () => {
		await expect(
			subsonicHandlers.getSong(db, asUser({ id: 1 }), {
				id: makeId("tr", 9999),
			}),
		).rejects.toBeInstanceOf(SubsonicError);
	});
});

describe("getGenres", () => {
	it("lists genres with counts, skipping null genres", async () => {
		await seed();
		const result = await subsonicHandlers.getGenres(db, asUser({ id: 1 }), {});
		const payload = payloadOf(result);
		expect(payload.genres?.genre).toEqual([
			{ value: "Jazz", songCount: 1, albumCount: 1 },
		]);
	});
});

describe("getAlbumList2 / getRandomSongs / getSongsByGenre", () => {
	it("lists albums with resolved primary artist", async () => {
		await seed();
		const result = await subsonicHandlers.getAlbumList2(db, asUser({ id: 1 }), {
			type: "alphabeticalByName",
		});
		const payload = payloadOf(result);
		expect(payload.albumList2?.album[0].artist).toBe("Artist A");
	});

	it("returns random songs", async () => {
		await seed();
		const result = await subsonicHandlers.getRandomSongs(
			db,
			asUser({ id: 1 }),
			{},
		);
		const payload = payloadOf(result);
		expect(payload.randomSongs?.song).toHaveLength(1);
	});

	it("requires a genre param for getSongsByGenre", async () => {
		await expect(
			subsonicHandlers.getSongsByGenre(db, asUser({ id: 1 }), {}),
		).rejects.toBeInstanceOf(SubsonicError);
	});

	it("returns songs for the given genre", async () => {
		await seed();
		const result = await subsonicHandlers.getSongsByGenre(
			db,
			asUser({ id: 1 }),
			{
				genre: "Jazz",
			},
		);
		const payload = payloadOf(result);
		expect(payload.songsByGenre?.song).toHaveLength(1);
	});
});

describe("search3 / search2", () => {
	it("lists everything when query is absent", async () => {
		await seed();
		const result = await subsonicHandlers.search3(db, asUser({ id: 1 }), {});
		const payload = payloadOf(result);
		expect(payload.searchResult3?.artist).toHaveLength(1);
		expect(payload.searchResult3?.album).toHaveLength(1);
		expect(payload.searchResult3?.song).toHaveLength(1);
	});

	it("filters by query text", async () => {
		await seed();
		const result = await subsonicHandlers.search3(db, asUser({ id: 1 }), {
			query: "Alpha",
		});
		const payload = payloadOf(result);
		expect(payload.searchResult3?.song).toHaveLength(1);
		expect(payload.searchResult3?.album).toHaveLength(0);
	});

	it("search2 behaves like search3", async () => {
		await seed();
		const result = await subsonicHandlers.search2(db, asUser({ id: 1 }), {
			query: "Alpha",
		});
		const payload = payloadOf(result);
		expect(payload.searchResult3?.song).toHaveLength(1);
	});
});

describe("scrobble", () => {
	it("throws not found for a non-track id", async () => {
		const { artistA } = await seed();
		await expect(
			subsonicHandlers.scrobble(db, asUser({ id: 1 }), {
				id: makeId("ar", artistA.id),
			}),
		).rejects.toBeInstanceOf(SubsonicError);
	});

	it("records a completed play when submission=true (default)", async () => {
		const { track, user } = await seed();
		await subsonicHandlers.scrobble(db, asUser(user), {
			id: makeId("tr", track.id),
		});
		const history = await db.select().from(play_history);
		expect(history).toHaveLength(1);
	});

	it("syncs now-playing state without recording history when submission=false", async () => {
		const { track, user } = await seed();
		await subsonicHandlers.scrobble(db, asUser(user), {
			id: makeId("tr", track.id),
			submission: "false",
		});
		const history = await db.select().from(play_history);
		expect(history).toHaveLength(0);
		const [state] = await db.select().from(user_playback_state);
		expect(state.playing).toBe(true);
	});
});

describe("scanStatus / getStarred / getPlaylists", () => {
	it("getScanStatus reports the current scan state", async () => {
		const result = await subsonicHandlers.getScanStatus(
			db,
			asUser({ id: 1 }),
			{},
		);
		const payload = payloadOf(result);
		expect(payload.scanStatus?.scanning).toBe(false);
	});

	it("getStarred2 and getStarred return empty collections", async () => {
		const r2 = await subsonicHandlers.getStarred2(db, asUser({ id: 1 }), {});
		const r1 = await subsonicHandlers.getStarred(db, asUser({ id: 1 }), {});
		expect(payloadOf(r2).starred2?.artist).toEqual([]);
		expect(payloadOf(r1).starred?.artist).toEqual([]);
	});

	it("getPlaylists returns an empty playlist collection", async () => {
		const result = await subsonicHandlers.getPlaylists(
			db,
			asUser({ id: 1 }),
			{},
		);
		expect(payloadOf(result).playlists?.playlist).toEqual([]);
	});
});

describe("getNowPlaying", () => {
	it("returns currently playing users", async () => {
		const { track, user } = await seed();
		await db.insert(user_playback_state).values({
			user_id: user.id,
			track_id: track.id,
			playing: true,
		});
		const result = await subsonicHandlers.getNowPlaying(
			db,
			asUser({ id: 1 }),
			{},
		);
		const payload = payloadOf(result);
		expect(payload.nowPlaying?.entry).toHaveLength(1);
		expect(payload.nowPlaying?.entry[0].username).toBe("alice");
	});
});
