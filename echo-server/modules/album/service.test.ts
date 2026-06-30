import { beforeEach, describe, expect, it } from "bun:test";
import { album_artists, albums, artists, tracks } from "../../db/schema";
import { makeTestDb } from "../../db/test-client";
import type { DbLike } from "../../db/types";
import { AlbumService } from "./service";

let db: DbLike;

async function seed(client: DbLike) {
	const [artistA] = await client
		.insert(artists)
		.values({ name: "Artist A" })
		.returning({ id: artists.id });
	const [album] = await client
		.insert(albums)
		.values({ title: "Album One", year: 2021, genre: "Jazz" })
		.returning({ id: albums.id });
	await client
		.insert(album_artists)
		.values({ album_id: album.id, artist_id: artistA.id });

	await client.insert(tracks).values({
		title: "Alpha",
		album_id: album.id,
		track_number: 1,
		duration_seconds: 200,
		file_path: "/music/alpha.mp3",
	});
	await client.insert(tracks).values({
		title: "Beta",
		album_id: album.id,
		track_number: 2,
		duration_seconds: 180,
		file_path: "/music/beta.mp3",
	});

	return { album };
}

beforeEach(() => {
	db = makeTestDb();
});

describe("AlbumService.findAlbum", () => {
	it("returns album by id", async () => {
		const { album } = await seed(db);
		const result = await AlbumService.findAlbum(db, album.id);
		expect(result?.title).toBe("Album One");
	});

	it("returns null for unknown id", async () => {
		const result = await AlbumService.findAlbum(db, 9999);
		expect(result).toBeNull();
	});
});

describe("AlbumService.getAlbumTracks", () => {
	it("returns tracks ordered by track_number", async () => {
		const { album } = await seed(db);
		const result = await AlbumService.getAlbumTracks(db, album.id);
		expect(result.map((t) => t.title)).toEqual(["Alpha", "Beta"]);
	});

	it("returns empty array for album with no tracks", async () => {
		const [newAlbum] = await db
			.insert(albums)
			.values({ title: "Empty" })
			.returning({ id: albums.id });
		const result = await AlbumService.getAlbumTracks(db, newAlbum.id);
		expect(result).toHaveLength(0);
	});
});

describe("AlbumService.getAlbumArtists", () => {
	it("returns artist names for an album", async () => {
		const { album } = await seed(db);
		const result = await AlbumService.getAlbumArtists(db, album.id);
		expect(result).toEqual(["Artist A"]);
	});

	it("returns empty array for album with no artists", async () => {
		const [newAlbum] = await db
			.insert(albums)
			.values({ title: "Solo" })
			.returning({ id: albums.id });
		const result = await AlbumService.getAlbumArtists(db, newAlbum.id);
		expect(result).toHaveLength(0);
	});
});
