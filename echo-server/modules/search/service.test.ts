import { beforeEach, describe, expect, it } from "bun:test";
import { albums, artists, track_artists, tracks } from "../../db/schema";
import { makeTestDb } from "../../db/test-client";
import type { DbLike } from "../../db/types";
import { SearchService } from "./service";

let db: DbLike;

async function seed(client: DbLike) {
	const [artist] = await client
		.insert(artists)
		.values({ name: "Aphex Twin" })
		.returning({ id: artists.id });
	const [album] = await client
		.insert(albums)
		.values({ title: "Selected Ambient Works" })
		.returning({ id: albums.id });
	const [track] = await client
		.insert(tracks)
		.values({
			title: "Xtal",
			album_id: album.id,
			file_path: "/music/xtal.mp3",
		})
		.returning({ id: tracks.id });
	await client
		.insert(track_artists)
		.values({ track_id: track.id, artist_id: artist.id });
	return { artist, album, track };
}

beforeEach(() => {
	db = makeTestDb();
});

describe("SearchService.searchAll", () => {
	it("returns empty results for a blank query", async () => {
		await seed(db);
		const result = await SearchService.searchAll(db, "  ");
		expect(result).toEqual({ artists: [], albums: [], tracks: [] });
	});

	it("matches artists by partial, case-insensitive name", async () => {
		await seed(db);
		const result = await SearchService.searchAll(db, "aphex");
		expect(result.artists.map((a) => a.name)).toEqual(["Aphex Twin"]);
	});

	it("matches albums by partial title", async () => {
		await seed(db);
		const result = await SearchService.searchAll(db, "Ambient");
		expect(result.albums.map((a) => a.title)).toEqual([
			"Selected Ambient Works",
		]);
	});

	it("matches tracks by title and attaches artist and album", async () => {
		await seed(db);
		const result = await SearchService.searchAll(db, "Xtal");
		expect(result.tracks).toHaveLength(1);
		expect(result.tracks[0].title).toBe("Xtal");
		expect(result.tracks[0].artists.map((a) => a.name)).toEqual(["Aphex Twin"]);
		expect(result.tracks[0].album?.title).toBe("Selected Ambient Works");
	});

	it("returns no matches for an unrelated query", async () => {
		await seed(db);
		const result = await SearchService.searchAll(db, "zzz-nonexistent");
		expect(result).toEqual({ artists: [], albums: [], tracks: [] });
	});
});
