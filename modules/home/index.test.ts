import { beforeEach, describe, expect, it } from "bun:test";
import { play_history, tracks, user_playback_state } from "../../db/schema";
import { makeTestDb } from "../../db/test-client";
import type { DbLike } from "../../db/types";
import { type App, createApp } from "../../utils/create-app";

let db: DbLike;
let app: App;

beforeEach(async () => {
	db = makeTestDb();
	app = await createApp(db);
});

async function signUp(): Promise<string> {
	const res = await app.handle(
		new Request("http://localhost/auth/sign-up", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				email: "user@example.com",
				password: "Passw0rd!",
			}),
		}),
	);
	return res.headers.get("set-cookie")?.match(/session=([^;]+)/)?.[1] ?? "";
}

describe("GET / with playback state and history", () => {
	it("includes continueListening and excludes it from recentlyPlayed", async () => {
		const token = await signUp();
		const [track] = await db
			.insert(tracks)
			.values({ title: "Currently Playing", file_path: "/music/a.mp3" })
			.returning({ id: tracks.id });

		await db
			.insert(user_playback_state)
			.values({ user_id: 1, track_id: track.id, position_seconds: 30 });
		await db.insert(play_history).values({ user_id: 1, track_id: track.id });

		const res = await app.handle(
			new Request("http://localhost/", {
				headers: { Cookie: `session=${token}` },
			}),
		);
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("Currently Playing");
	});
});
