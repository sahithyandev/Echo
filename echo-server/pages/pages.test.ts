import { beforeEach, describe, expect, it } from "bun:test";
import {
	album_artists,
	albums,
	artists,
	track_artists,
	tracks,
} from "../db/schema";
import { makeTestDb } from "../db/test-client";
import type { DbLike } from "../db/types";
import { type App, createApp } from "../utils/create-app";

const TEST_USER = { email: "user@example.com", password: "Passw0rd!" };

let db: DbLike;
let app: App;

beforeEach(async () => {
	db = makeTestDb();
	app = await createApp(db);
});

function extractSessionCookie(res: Response) {
	return res.headers.get("set-cookie")?.match(/session=([^;]+)/)?.[1] ?? "";
}

async function signUp(): Promise<string> {
	const res = await app.handle(
		new Request("http://localhost/auth/sign-up", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(TEST_USER),
		}),
	);
	return extractSessionCookie(res);
}

function authed(url: string, token: string) {
	return app.handle(
		new Request(url, { headers: { Cookie: `session=${token}` } }),
	);
}

async function seedArtist(client: DbLike) {
	const [artist] = await client
		.insert(artists)
		.values({ name: "Test Artist" })
		.returning({ id: artists.id });
	return artist.id;
}

async function seedAlbum(client: DbLike) {
	const [artist] = await client
		.insert(artists)
		.values({ name: "Test Artist" })
		.returning({ id: artists.id });
	const [album] = await client
		.insert(albums)
		.values({ title: "Test Album" })
		.returning({ id: albums.id });
	await client
		.insert(album_artists)
		.values({ album_id: album.id, artist_id: artist.id });
	const [track] = await client
		.insert(tracks)
		.values({
			title: "Track 1",
			album_id: album.id,
			file_path: "/music/t1.mp3",
		})
		.returning({ id: tracks.id });
	await client
		.insert(track_artists)
		.values({ track_id: track.id, artist_id: artist.id });
	return album.id;
}

describe("GET /", () => {
	it("returns 200 with html content-type", async () => {
		const res = await app.handle(new Request("http://localhost/"));
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
	});
});

describe("GET /auth/login", () => {
	it("returns 200 with html content-type", async () => {
		const res = await app.handle(new Request("http://localhost/auth/login"));
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
	});
});

describe("GET /library", () => {
	it("redirects to /login when unauthenticated", async () => {
		const res = await app.handle(new Request("http://localhost/library"));
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/auth/login");
	});

	it("returns 200 html when authenticated", async () => {
		const token = await signUp();
		const res = await authed("http://localhost/library", token);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
	});
});

describe("GET /artist/:id", () => {
	it("redirects to /login when unauthenticated", async () => {
		const res = await app.handle(new Request("http://localhost/artist/1"));
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/auth/login");
	});

	it("returns 200 html for a valid artist", async () => {
		const token = await signUp();
		const artistId = await seedArtist(db);
		const res = await authed(`http://localhost/artist/${artistId}`, token);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
	});

	it("redirects to /library for an unknown artist", async () => {
		const token = await signUp();
		const res = await authed("http://localhost/artist/9999", token);
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/library");
	});
});

describe("GET /album/:id", () => {
	it("redirects to /login when unauthenticated", async () => {
		const res = await app.handle(new Request("http://localhost/album/1"));
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/auth/login");
	});

	it("returns 200 html for a valid album", async () => {
		const token = await signUp();
		const albumId = await seedAlbum(db);
		const res = await authed(`http://localhost/album/${albumId}`, token);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
	});

	it("redirects to /library for an unknown album", async () => {
		const token = await signUp();
		const res = await authed("http://localhost/album/9999", token);
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/library");
	});
});
