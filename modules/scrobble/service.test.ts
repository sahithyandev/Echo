import { beforeEach, describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import {
	artists,
	play_history,
	track_artists,
	tracks,
	users,
} from "../../db/schema";
import { makeTestDb } from "../../db/test-client";
import type { DbLike } from "../../db/types";
import { ScrobbleService } from "./service";

function md5(input: string): string {
	return createHash("md5").update(input).digest("hex");
}

let db: DbLike;

async function seed(client: DbLike) {
	const [user] = await client
		.insert(users)
		.values({
			email: "a@b.com",
			password: "hash",
			name: "alice",
			subsonic_password: "secret",
		})
		.returning({ id: users.id });
	const [artist] = await client
		.insert(artists)
		.values({ name: "Artist A" })
		.returning({ id: artists.id });
	const [track] = await client
		.insert(tracks)
		.values({ title: "Track One", file_path: "/music/one.mp3" })
		.returning({ id: tracks.id });
	await client
		.insert(track_artists)
		.values({ track_id: track.id, artist_id: artist.id });
	return { user, artist, track };
}

beforeEach(() => {
	db = makeTestDb();
});

describe("ScrobbleService.authenticate", () => {
	it("accepts a correctly computed token", async () => {
		const { user } = await seed(db);
		const timestamp = "1000000";
		const token = md5(md5("secret") + timestamp);
		expect(
			await ScrobbleService.authenticate(db, "alice", timestamp, token),
		).toBe(user.id);
	});

	it("rejects a wrong token", async () => {
		await seed(db);
		expect(
			await ScrobbleService.authenticate(db, "alice", "1000000", "wrong"),
		).toBeNull();
	});

	it("rejects an unknown username", async () => {
		await seed(db);
		expect(
			await ScrobbleService.authenticate(db, "nobody", "1000000", "whatever"),
		).toBeNull();
	});
});

describe("ScrobbleService.submit", () => {
	it("records a play for a matching artist+title", async () => {
		const { user, track } = await seed(db);
		await ScrobbleService.submit(
			db,
			user.id,
			"Artist A",
			"Track One",
			1700000000,
		);
		const rows = await db.select().from(play_history);
		expect(rows).toHaveLength(1);
		expect(rows[0].track_id).toBe(track.id);
		expect(rows[0].played_at.getTime()).toBe(1700000000 * 1000);
	});

	it("matches case-insensitively", async () => {
		const { user } = await seed(db);
		await ScrobbleService.submit(
			db,
			user.id,
			"artist a",
			"track one",
			1700000000,
		);
		const rows = await db.select().from(play_history);
		expect(rows).toHaveLength(1);
	});

	it("is a no-op when nothing in the library matches", async () => {
		const { user } = await seed(db);
		await ScrobbleService.submit(db, user.id, "Unknown", "Nowhere", 1700000000);
		const rows = await db.select().from(play_history);
		expect(rows).toHaveLength(0);
	});
});
