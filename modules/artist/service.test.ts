import { beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import {
	album_artists,
	albums,
	artists,
	track_artists,
	tracks,
} from "../../db/schema";
import { makeTestDb } from "../../db/test-client";
import type { DbLike } from "../../db/types";
import { ArtistService } from "./service";

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

	await client
		.insert(track_artists)
		.values({ track_id: t1.id, artist_id: artistA.id });
	await client
		.insert(track_artists)
		.values({ track_id: t1.id, artist_id: artistB.id });
	await client
		.insert(track_artists)
		.values({ track_id: t2.id, artist_id: artistA.id });

	return { artistA, artistB };
}

beforeEach(() => {
	db = makeTestDb();
});

describe("ArtistService.findArtist", () => {
	it("returns artist by id", async () => {
		const { artistA } = await seed(db);
		const result = await ArtistService.findArtist(db, artistA.id);
		expect(result?.name).toBe("Artist A");
	});

	it("returns null for unknown id", async () => {
		const result = await ArtistService.findArtist(db, 9999);
		expect(result).toBeNull();
	});
});

describe("ArtistService.getArtistTracks", () => {
	it("returns tracks for an artist", async () => {
		const { artistA } = await seed(db);
		const result = await ArtistService.getArtistTracks(db, artistA.id);
		expect(result.map((t) => t.title).sort()).toEqual(["Alpha", "Beta"]);
	});

	it("returns tracks for artist with one track", async () => {
		const { artistB } = await seed(db);
		const result = await ArtistService.getArtistTracks(db, artistB.id);
		expect(result.map((t) => t.title)).toEqual(["Alpha"]);
	});
});

describe("ArtistService.listArtists", () => {
	it("returns all artists ordered by name", async () => {
		await seed(db);
		const result = await ArtistService.listArtists(db);
		expect(result.map((a) => a.name)).toEqual(["Artist A", "Artist B"]);
	});
});

describe("ArtistService.renameArtist", () => {
	it("renames an artist when no name collision exists", async () => {
		const { artistA } = await seed(db);
		const result = await ArtistService.renameArtist(db, artistA.id, "New Name");
		expect(result).toEqual({ merged: false, id: artistA.id });
		const updated = await ArtistService.findArtist(db, artistA.id);
		expect(updated?.name).toBe("New Name");
	});

	it("merges into an existing artist with the same name", async () => {
		const { artistA, artistB } = await seed(db);
		const result = await ArtistService.renameArtist(db, artistA.id, "Artist B");
		expect(result).toEqual({ merged: true, id: artistB.id });

		const survivorTracks = await ArtistService.getArtistTracks(db, artistB.id);
		expect(survivorTracks.map((t) => t.title).sort()).toEqual([
			"Alpha",
			"Beta",
		]);

		const gone = await ArtistService.findArtist(db, artistA.id);
		expect(gone).toBeNull();
	});

	it("merges album associations without duplicating", async () => {
		const { artistA, artistB } = await seed(db);
		const [album] = await db
			.insert(albums)
			.values({ title: "Shared Album" })
			.returning({ id: albums.id });
		await db
			.insert(album_artists)
			.values({ album_id: album.id, artist_id: artistA.id });
		await db
			.insert(album_artists)
			.values({ album_id: album.id, artist_id: artistB.id });

		await ArtistService.renameArtist(db, artistA.id, "Artist B");

		const links = await db
			.select()
			.from(album_artists)
			.where(eq(album_artists.artist_id, artistB.id));
		expect(links).toHaveLength(1);
	});
});
