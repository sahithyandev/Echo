import { beforeEach, describe, expect, it } from "bun:test";
import {
	albums,
	artists,
	listening,
	track_artists,
	tracks,
	users,
} from "../../db/schema";
import { makeTestDb } from "../../db/test-client";
import type { DbLike } from "../../db/types";
import { AnalyticsService } from "./service";

let db: DbLike;

async function seed(client: DbLike) {
	const [user] = await client
		.insert(users)
		.values({
			email: "a@b.com",
			password: "hash",
			name: "A",
			subsonic_password: "key",
		})
		.returning({ id: users.id });
	const [artist] = await client
		.insert(artists)
		.values({ name: "Artist A" })
		.returning({ id: artists.id });
	const [album] = await client
		.insert(albums)
		.values({ title: "Album One" })
		.returning({ id: albums.id });
	const [track] = await client
		.insert(tracks)
		.values({
			title: "Track One",
			album_id: album.id,
			year: 2021,
			track_number: 1,
			duration_seconds: 200,
			file_path: "/music/one.mp3",
		})
		.returning({ id: tracks.id });
	await client
		.insert(track_artists)
		.values({ track_id: track.id, artist_id: artist.id });

	await client.insert(listening).values({
		user_id: user.id,
		track_id: track.id,
		seconds: 100,
		day: "2024-01-01",
	});
	await client.insert(listening).values({
		user_id: user.id,
		track_id: track.id,
		seconds: 50,
		day: "2024-01-02",
	});

	return { user, artist, album, track };
}

beforeEach(() => {
	db = makeTestDb();
});

describe("AnalyticsService.totalPlaybackSeconds", () => {
	it("sums seconds for a user", async () => {
		const { user } = await seed(db);
		expect(await AnalyticsService.totalPlaybackSeconds(db, user.id)).toBe(150);
	});

	it("returns 0 for a user with no listening history", async () => {
		const [user] = await db
			.insert(users)
			.values({
				email: "nobody@b.com",
				password: "hash",
				name: "Nobody",
				subsonic_password: "key2",
			})
			.returning({ id: users.id });
		expect(await AnalyticsService.totalPlaybackSeconds(db, user.id)).toBe(0);
	});
});

describe("AnalyticsService.playbackByArtist", () => {
	it("aggregates seconds by artist", async () => {
		const { user, artist } = await seed(db);
		const result = await AnalyticsService.playbackByArtist(db, user.id);
		expect(result).toEqual([
			{ artist_id: artist.id, artist_name: "Artist A", seconds: 150 },
		]);
	});
});

describe("AnalyticsService.playbackByAlbum", () => {
	it("aggregates seconds by album", async () => {
		const { user, album } = await seed(db);
		const result = await AnalyticsService.playbackByAlbum(db, user.id);
		expect(result).toEqual([
			{
				album_id: album.id,
				album_title: "Album One",
				cover_path: null,
				seconds: 150,
			},
		]);
	});
});

describe("AnalyticsService.playbackByDay", () => {
	it("aggregates seconds by day, ordered ascending", async () => {
		const { user } = await seed(db);
		const result = await AnalyticsService.playbackByDay(db, user.id);
		expect(result).toEqual([
			{ day: "2024-01-01", seconds: 100 },
			{ day: "2024-01-02", seconds: 50 },
		]);
	});
});

describe("AnalyticsService.playbackByYear", () => {
	it("aggregates seconds by track year", async () => {
		const { user } = await seed(db);
		const result = await AnalyticsService.playbackByYear(db, user.id);
		expect(result).toEqual([{ year: 2021, seconds: 150 }]);
	});
});
