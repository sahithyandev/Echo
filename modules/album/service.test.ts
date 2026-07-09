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
		expect(result.map((a) => a.name)).toEqual(["Artist A"]);
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

describe("AlbumService.listAlbums", () => {
	it("dedupes albums with multiple artists into one entry", async () => {
		const { album } = await seed(db);
		const [artistB] = await db
			.insert(artists)
			.values({ name: "Artist B" })
			.returning({ id: artists.id });
		await db
			.insert(album_artists)
			.values({ album_id: album.id, artist_id: artistB.id });

		const result = await AlbumService.listAlbums(db);
		expect(result).toHaveLength(1);
		expect(result[0].artists).toEqual(["Artist A", "Artist B"]);
	});

	it("returns album with empty artists array when it has none", async () => {
		await db.insert(albums).values({ title: "Solo" });
		const result = await AlbumService.listAlbums(db);
		expect(result.find((a) => a.title === "Solo")?.artists).toEqual([]);
	});

	it("includes a 'No Album' entry when unalbumed tracks exist", async () => {
		await db.insert(tracks).values({
			title: "Loose",
			track_number: 1,
			duration_seconds: 100,
			file_path: "/music/loose.mp3",
		});
		const result = await AlbumService.listAlbums(db);
		expect(result.find((a) => a.title === "No Album")).toBeTruthy();
	});
});

describe("AlbumService.getUnalbumedTracks", () => {
	it("returns tracks with no album, ordered by title", async () => {
		await seed(db);
		await db.insert(tracks).values({
			title: "Zeta",
			track_number: 1,
			duration_seconds: 100,
			file_path: "/music/zeta.mp3",
		});
		await db.insert(tracks).values({
			title: "Aardvark",
			track_number: 1,
			duration_seconds: 100,
			file_path: "/music/aardvark.mp3",
		});
		const result = await AlbumService.getUnalbumedTracks(db);
		expect(result.map((t) => t.title)).toEqual(["Aardvark", "Zeta"]);
	});
});

describe("AlbumService.renameAlbum", () => {
	it("renames an album when no title collision exists", async () => {
		const { album } = await seed(db);
		const result = await AlbumService.renameAlbum(db, album.id, "New Title");
		expect(result).toEqual({ merged: false, id: album.id });
		const updated = await AlbumService.findAlbum(db, album.id);
		expect(updated?.title).toBe("New Title");
	});

	it("merges into an existing album with the same title", async () => {
		const { album } = await seed(db);
		const [other] = await db
			.insert(albums)
			.values({ title: "Album Two" })
			.returning({ id: albums.id });
		await db.insert(tracks).values({
			title: "Gamma",
			album_id: other.id,
			track_number: 1,
			duration_seconds: 150,
			file_path: "/music/gamma.mp3",
		});

		const result = await AlbumService.renameAlbum(db, album.id, "Album Two");
		expect(result).toEqual({ merged: true, id: other.id });

		const survivorTracks = await AlbumService.getAlbumTracks(db, other.id);
		expect(survivorTracks.map((t) => t.title).sort()).toEqual([
			"Alpha",
			"Beta",
			"Gamma",
		]);

		const gone = await AlbumService.findAlbum(db, album.id);
		expect(gone).toBeNull();
	});

	it("merges artists from the renamed album into the survivor without duplicating", async () => {
		const { album } = await seed(db);
		const [other] = await db
			.insert(albums)
			.values({ title: "Album Two" })
			.returning({ id: albums.id });

		await AlbumService.renameAlbum(db, album.id, "Album Two");

		const survivorArtists = await AlbumService.getAlbumArtists(db, other.id);
		expect(survivorArtists.map((a) => a.name)).toEqual(["Artist A"]);
	});
});
