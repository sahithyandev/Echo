import { beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { albums, tracks, users } from "../../db/schema";
import { makeTestDb } from "../../db/test-client";
import type { DbLike } from "../../db/types";
import { type App, createApp } from "../../utils/create-app";
import { SettingsService } from "../settings/service";
import { subsonicHandlers } from "./handlers";

let db: DbLike;
let app: App;

beforeEach(async () => {
	db = makeTestDb();
	app = await createApp(db);
	const dataDir = await mkdtemp(`${tmpdir()}/echo-subsonic-data-`);
	await SettingsService.setDirs(db, tmpdir(), dataDir);
});

async function seedUser() {
	const [user] = await db
		.insert(users)
		.values({
			name: "alice",
			email: "alice@example.com",
			password: "irrelevant",
			subsonic_password: "sesame",
		})
		.returning({ id: users.id });
	return user;
}

function authQuery() {
	return "u=alice&p=sesame";
}

describe("GET /rest/:method", () => {
	it("returns a subsonic-response for ping", async () => {
		await seedUser();
		const res = await app.handle(
			new Request(`http://localhost/rest/ping?${authQuery()}&f=json`),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body["subsonic-response"].status).toBe("ok");
	});

	it("strips a trailing .view", async () => {
		await seedUser();
		const res = await app.handle(
			new Request(`http://localhost/rest/ping.view?${authQuery()}&f=json`),
		);
		const body = await res.json();
		expect(body["subsonic-response"].status).toBe("ok");
	});

	it("returns an auth challenge with no credentials", async () => {
		const res = await app.handle(new Request("http://localhost/rest/ping"));
		expect(res.status).toBe(401);
		expect(res.headers.get("WWW-Authenticate")).toContain("Basic");
	});

	it("returns a subsonic error for wrong credentials", async () => {
		await seedUser();
		const res = await app.handle(
			new Request("http://localhost/rest/ping?u=alice&p=wrong&f=json"),
		);
		const body = await res.json();
		expect(body["subsonic-response"].status).toBe("failed");
	});

	it("returns an unknown-method error", async () => {
		await seedUser();
		const res = await app.handle(
			new Request(`http://localhost/rest/notARealMethod?${authQuery()}&f=json`),
		);
		const body = await res.json();
		expect(body["subsonic-response"].status).toBe("failed");
		expect(body["subsonic-response"].error.message).toContain("Unknown method");
	});

	it("falls back to the default when a numeric param isn't a number", async () => {
		await seedUser();
		const res = await app.handle(
			new Request(
				`http://localhost/rest/getRandomSongs?${authQuery()}&size=notanumber&f=json`,
			),
		);
		const body = await res.json();
		expect(body["subsonic-response"].status).toBe("ok");
	});

	it("kicks off a scan via startScan and reports scanStatus", async () => {
		await seedUser();
		const res = await app.handle(
			new Request(`http://localhost/rest/startScan?${authQuery()}&f=json`),
		);
		const body = await res.json();
		expect(body["subsonic-response"].scanStatus).toBeDefined();

		const statusRes = await app.handle(
			new Request(`http://localhost/rest/getScanStatus?${authQuery()}&f=json`),
		);
		const statusBody = await statusRes.json();
		expect(statusBody["subsonic-response"].scanStatus).toBeDefined();
	});

	it("returns a generic internal error when a handler throws an unexpected error", async () => {
		await seedUser();
		const original = subsonicHandlers.ping;
		subsonicHandlers.ping = async () => {
			throw new Error("boom");
		};
		try {
			const res = await app.handle(
				new Request(`http://localhost/rest/ping?${authQuery()}&f=json`),
			);
			const body = await res.json();
			expect(body["subsonic-response"].status).toBe("failed");
			expect(body["subsonic-response"].error.message).toBe("Internal error");
		} finally {
			subsonicHandlers.ping = original;
		}
	});

	it("merges POSTed form params with the query string", async () => {
		await seedUser();
		const res = await app.handle(
			new Request("http://localhost/rest/ping?f=json", {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: authQuery(),
			}),
		);
		const body = await res.json();
		expect(body["subsonic-response"].status).toBe("ok");
	});
});

describe("GET /rest/stream", () => {
	it("returns 401 challenge with no credentials", async () => {
		const res = await app.handle(new Request("http://localhost/rest/stream"));
		expect(res.status).toBe(401);
	});

	it("returns 403 for wrong credentials", async () => {
		await seedUser();
		const res = await app.handle(
			new Request("http://localhost/rest/stream?u=alice&p=wrong&id=tr-1"),
		);
		expect(res.status).toBe(403);
	});

	it("returns 404 for an unknown track id", async () => {
		await seedUser();
		const res = await app.handle(
			new Request(`http://localhost/rest/stream?${authQuery()}&id=tr-9999`),
		);
		expect(res.status).toBe(404);
	});

	it("returns 404 when id isn't a track id", async () => {
		await seedUser();
		const res = await app.handle(
			new Request(`http://localhost/rest/stream?${authQuery()}&id=al-1`),
		);
		expect(res.status).toBe(404);
	});

	it("streams the file for a valid track id", async () => {
		await seedUser();
		const [track] = await db
			.insert(tracks)
			.values({ title: "T", file_path: `${import.meta.dir}/index.test.ts` })
			.returning({ id: tracks.id });
		const res = await app.handle(
			new Request(
				`http://localhost/rest/stream?${authQuery()}&id=tr-${track.id}`,
			),
		);
		expect(res.status).toBe(200);
	});

	it("also serves via /rest/stream.view", async () => {
		await seedUser();
		const [track] = await db
			.insert(tracks)
			.values({ title: "T", file_path: `${import.meta.dir}/index.test.ts` })
			.returning({ id: tracks.id });
		const res = await app.handle(
			new Request(
				`http://localhost/rest/stream.view?${authQuery()}&id=tr-${track.id}`,
			),
		);
		expect(res.status).toBe(200);
	});

	it("also serves via /rest/download and /rest/download.view", async () => {
		await seedUser();
		const [track] = await db
			.insert(tracks)
			.values({ title: "T", file_path: `${import.meta.dir}/index.test.ts` })
			.returning({ id: tracks.id });
		const res = await app.handle(
			new Request(
				`http://localhost/rest/download?${authQuery()}&id=tr-${track.id}`,
			),
		);
		expect(res.status).toBe(200);
		const res2 = await app.handle(
			new Request(
				`http://localhost/rest/download.view?${authQuery()}&id=tr-${track.id}`,
			),
		);
		expect(res2.status).toBe(200);
	});

	it("returns 404 when the track's file is missing on disk", async () => {
		await seedUser();
		const [track] = await db
			.insert(tracks)
			.values({ title: "T", file_path: "/nonexistent/missing.mp3" })
			.returning({ id: tracks.id });
		const res = await app.handle(
			new Request(
				`http://localhost/rest/stream?${authQuery()}&id=tr-${track.id}`,
			),
		);
		expect(res.status).toBe(404);
	});
});

describe("GET /rest/getCoverArt", () => {
	it("returns 401 challenge with no credentials", async () => {
		const res = await app.handle(
			new Request("http://localhost/rest/getCoverArt"),
		);
		expect(res.status).toBe(401);
	});

	it("returns 403 for wrong credentials", async () => {
		await seedUser();
		const res = await app.handle(
			new Request("http://localhost/rest/getCoverArt?u=alice&p=wrong&id=al-1"),
		);
		expect(res.status).toBe(403);
	});

	it("returns 404 when id isn't an album id", async () => {
		await seedUser();
		const res = await app.handle(
			new Request(`http://localhost/rest/getCoverArt?${authQuery()}&id=tr-1`),
		);
		expect(res.status).toBe(404);
	});

	it("falls back to a placeholder image when no art file exists", async () => {
		await seedUser();
		const [album] = await db
			.insert(albums)
			.values({ title: "Album" })
			.returning({ id: albums.id });
		const res = await app.handle(
			new Request(
				`http://localhost/rest/getCoverArt?${authQuery()}&id=al-${album.id}`,
			),
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("image/png");
	});

	it("also serves via /rest/getCoverArt.view", async () => {
		await seedUser();
		const [album] = await db
			.insert(albums)
			.values({ title: "Album" })
			.returning({ id: albums.id });
		const res = await app.handle(
			new Request(
				`http://localhost/rest/getCoverArt.view?${authQuery()}&id=al-${album.id}`,
			),
		);
		expect(res.status).toBe(200);
	});
});
