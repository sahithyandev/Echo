import { beforeEach, describe, expect, it } from "bun:test";
import { albums, artists, track_artists, tracks } from "../../db/schema";
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
