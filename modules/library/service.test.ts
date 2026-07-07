import { beforeEach, describe, expect, it } from "bun:test";
import { albums, artists, track_artists, tracks } from "../../db/schema";
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
