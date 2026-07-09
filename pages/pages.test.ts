import { beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import {
	album_artists,
	albums,
	artists,
	listening,
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
	it("redirects to /login when unauthenticated", async () => {
		const res = await app.handle(new Request("http://localhost/"));
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/auth/login");
	});

	it("returns 200 html when authenticated", async () => {
		const token = await signUp();
		const res = await authed("http://localhost/", token);
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

describe("GET /artists", () => {
	it("redirects to /login when unauthenticated", async () => {
		const res = await app.handle(new Request("http://localhost/artists"));
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/auth/login");
	});

	it("returns 200 html when authenticated", async () => {
		const token = await signUp();
		const res = await authed("http://localhost/artists", token);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
	});
});

describe("GET /albums", () => {
	it("returns 200 html when authenticated", async () => {
		const token = await signUp();
		const res = await authed("http://localhost/albums", token);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
	});
});

describe("POST /artist/:id/rename", () => {
	it("redirects to /login when unauthenticated", async () => {
		const res = await app.handle(
			new Request("http://localhost/artist/1/rename", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "New" }),
			}),
		);
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/auth/login");
	});

	it("renames the artist for an admin", async () => {
		const token = await signUp();
		const artistId = await seedArtist(db);
		const res = await app.handle(
			new Request(`http://localhost/artist/${artistId}/rename`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: `session=${token}`,
				},
				body: JSON.stringify({ name: "Renamed Artist" }),
			}),
		);
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe(`/artist/${artistId}?ok=rename`);
	});
});

describe("POST /album/:id/rename", () => {
	it("renames the album for an admin", async () => {
		const token = await signUp();
		const albumId = await seedAlbum(db);
		const res = await app.handle(
			new Request(`http://localhost/album/${albumId}/rename`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: `session=${token}`,
				},
				body: JSON.stringify({ title: "Renamed Album" }),
			}),
		);
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe(`/album/${albumId}?ok=rename`);
	});
});

describe("GET /search", () => {
	it("redirects to /login when unauthenticated", async () => {
		const res = await app.handle(new Request("http://localhost/search?q=x"));
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/auth/login");
	});

	it("returns 200 html with results for a matching query", async () => {
		const token = await signUp();
		await seedAlbum(db);
		const res = await authed("http://localhost/search?q=Test", token);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
	});

	it("returns 200 html for an empty query", async () => {
		const token = await signUp();
		const res = await authed("http://localhost/search", token);
		expect(res.status).toBe(200);
	});
});

describe("GET /analytics", () => {
	it("redirects to /login when unauthenticated", async () => {
		const res = await app.handle(new Request("http://localhost/analytics"));
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/auth/login");
	});

	it("returns 200 html when authenticated with no listening history", async () => {
		const token = await signUp();
		const res = await authed("http://localhost/analytics", token);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
	});

	it("returns 200 html when the user has listening history", async () => {
		const token = await signUp();
		const albumId = await seedAlbum(db);
		const [track] = await db
			.select()
			.from(tracks)
			.where(eq(tracks.album_id, albumId));
		await db.insert(listening).values({
			user_id: 1,
			track_id: track.id,
			seconds: 120,
			day: "2024-01-01",
		});
		const res = await authed("http://localhost/analytics", token);
		expect(res.status).toBe(200);
	});
});
