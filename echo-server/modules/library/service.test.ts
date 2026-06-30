import { beforeEach, describe, expect, it } from "bun:test";
import {
	album_artists,
	albums,
	artists,
	track_artists,
	tracks,
} from "../../db/schema";
import { makeTestDb } from "../../db/test-client";
import type { DbLike } from "../../db/types";
import { LibraryService } from "./service";

let db: DbLike;

async function seed(client: DbLike) {
	const [artistA] = await client
		.insert(artists)
		.values({ name: "Artist A" })
		.returning({ id: artists.id });
	const [artistB] = await client
		.insert(artists)
		.values({ name: "Artist B" })
		.returning({ id: artists.id });
	const [album] = await client
		.insert(albums)
		.values({ title: "Album One", year: 2021, genre: "Jazz" })
		.returning({ id: albums.id });
	await client
		.insert(album_artists)
		.values({ album_id: album.id, artist_id: artistA.id });

	const [t1] = await client
		.insert(tracks)
		.values({
			title: "Alpha",
			album_id: album.id,
			track_number: 1,
			duration_seconds: 200,
			file_path: "/music/alpha.mp3",
		})
		.returning({ id: tracks.id });
	const [t2] = await client
		.insert(tracks)
		.values({
			title: "Beta",
			album_id: album.id,
			track_number: 2,
			duration_seconds: 180,
			file_path: "/music/beta.mp3",
		})
		.returning({ id: tracks.id });
	const [t3] = await client
		.insert(tracks)
		.values({
			title: "Gamma",
			album_id: null,
			duration_seconds: null,
			file_path: "/music/gamma.mp3",
		})
		.returning({ id: tracks.id });

	await client
		.insert(track_artists)
		.values({ track_id: t1.id, artist_id: artistA.id });
	await client
		.insert(track_artists)
		.values({ track_id: t1.id, artist_id: artistB.id });
	await client
		.insert(track_artists)
		.values({ track_id: t2.id, artist_id: artistA.id });
	// t3 has no artists

	return { artistA, artistB, album, t1, t2, t3 };
}

beforeEach(() => {
	db = makeTestDb();
});

describe("LibraryService.listTracks", () => {
	it("returns all tracks", async () => {
		await seed(db);
		const result = await LibraryService.listTracks(db);
		expect(result).toHaveLength(3);
	});

	it("collects multiple artists onto one track", async () => {
		await seed(db);
		const result = await LibraryService.listTracks(db);
		const alpha = result.find((t) => t.title === "Alpha");
		expect(alpha?.artists).toHaveLength(2);
	});

	it("attaches album info", async () => {
		await seed(db);
		const result = await LibraryService.listTracks(db);
		const alpha = result.find((t) => t.title === "Alpha");
		expect(alpha?.album?.title).toBe("Album One");
	});

	it("sets album null for tracks without one", async () => {
		await seed(db);
		const result = await LibraryService.listTracks(db);
		const gamma = result.find((t) => t.title === "Gamma");
		expect(gamma?.album).toBeNull();
		expect(gamma?.artists).toHaveLength(0);
	});

	it("returns empty array when no tracks", async () => {
		const result = await LibraryService.listTracks(db);
		expect(result).toHaveLength(0);
	});
});

describe("LibraryService.findArtist", () => {
	it("returns artist by id", async () => {
		const { artistA } = await seed(db);
		const result = await LibraryService.findArtist(db, artistA.id);
		expect(result?.name).toBe("Artist A");
	});

	it("returns null for unknown id", async () => {
		const result = await LibraryService.findArtist(db, 9999);
		expect(result).toBeNull();
	});
});

describe("LibraryService.getArtistTracks", () => {
	it("returns tracks for an artist", async () => {
		const { artistA } = await seed(db);
		const result = await LibraryService.getArtistTracks(db, artistA.id);
		expect(result.map((t) => t.title).sort()).toEqual(["Alpha", "Beta"]);
	});

	it("returns empty array for artist with no tracks", async () => {
		const { artistB } = await seed(db);
		// artistB is only on t1 (Alpha)
		const result = await LibraryService.getArtistTracks(db, artistB.id);
		expect(result.map((t) => t.title)).toEqual(["Alpha"]);
	});
});

describe("LibraryService.findAlbum", () => {
	it("returns album by id", async () => {
		const { album } = await seed(db);
		const result = await LibraryService.findAlbum(db, album.id);
		expect(result?.title).toBe("Album One");
	});

	it("returns null for unknown id", async () => {
		const result = await LibraryService.findAlbum(db, 9999);
		expect(result).toBeNull();
	});
});

describe("LibraryService.getAlbumTracks", () => {
	it("returns tracks for an album ordered by track_number", async () => {
		const { album } = await seed(db);
		const result = await LibraryService.getAlbumTracks(db, album.id);
		expect(result.map((t) => t.title)).toEqual(["Alpha", "Beta"]);
	});

	it("returns empty array for album with no tracks", async () => {
		const [newAlbum] = await db
			.insert(albums)
			.values({ title: "Empty" })
			.returning({ id: albums.id });
		const result = await LibraryService.getAlbumTracks(db, newAlbum.id);
		expect(result).toHaveLength(0);
	});
});

describe("LibraryService.getAlbumArtists", () => {
	it("returns artist names for an album", async () => {
		const { album } = await seed(db);
		const result = await LibraryService.getAlbumArtists(db, album.id);
		expect(result).toEqual(["Artist A"]);
	});

	it("returns empty array for album with no artists", async () => {
		const [newAlbum] = await db
			.insert(albums)
			.values({ title: "Solo" })
			.returning({ id: albums.id });
		const result = await LibraryService.getAlbumArtists(db, newAlbum.id);
		expect(result).toHaveLength(0);
	});
});
