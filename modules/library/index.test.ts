import { beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { albums, tracks } from "../../db/schema";
import { makeTestDb } from "../../db/test-client";
import type { DbLike } from "../../db/types";
import { type App, createApp } from "../../utils/create-app";
import { SettingsService } from "../settings/service";

const ADMIN = { email: "admin@example.com", password: "Passw0rd!" };

let db: DbLike;
let app: App;
let musicDir: string;
let dataDir: string;

beforeEach(async () => {
	db = makeTestDb();
	app = await createApp(db);
	musicDir = await mkdtemp(`${tmpdir()}/echo-library-music-`);
	dataDir = await mkdtemp(`${tmpdir()}/echo-library-data-`);
	await SettingsService.setDirs(db, musicDir, dataDir);
});

function extractSessionCookie(res: Response) {
	return res.headers.get("set-cookie")?.match(/session=([^;]+)/)?.[1] ?? "";
}

async function signUp(): Promise<string> {
	const res = await app.handle(
		new Request("http://localhost/auth/sign-up", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(ADMIN),
		}),
	);
	return extractSessionCookie(res);
}

function authed(url: string, token: string, init: RequestInit = {}) {
	return app.handle(
		new Request(url, {
			...init,
			headers: { ...init.headers, Cookie: `session=${token}` },
		}),
	);
}

async function seedTrack(overrides: Partial<typeof tracks.$inferInsert> = {}) {
	const [track] = await db
		.insert(tracks)
		.values({
			title: "Track One",
			file_path: `${musicDir}/track-one.mp3`,
			...overrides,
		})
		.returning({ id: tracks.id });
	return track;
}

describe("GET /library", () => {
	it("redirects to /login when unauthenticated", async () => {
		const res = await app.handle(new Request("http://localhost/library"));
		expect(res.status).toBe(302);
	});

	it("returns 200 html when authenticated", async () => {
		const token = await signUp();
		const res = await authed("http://localhost/library", token);
		expect(res.status).toBe(200);
	});
});

describe("GET /library/tracks", () => {
	it("returns 401 when unauthenticated", async () => {
		const res = await app.handle(
			new Request("http://localhost/library/tracks"),
		);
		expect(res.status).toBe(401);
	});

	it("returns track groups html with no sentinel when few tracks", async () => {
		const token = await signUp();
		await seedTrack();
		const res = await authed("http://localhost/library/tracks", token);
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("Track One");
		expect(html).not.toContain("library-sentinel");
	});
});

describe("POST /track/:id/rename", () => {
	it("redirects to /login when unauthenticated", async () => {
		const res = await app.handle(
			new Request("http://localhost/track/1/rename", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "New" }),
			}),
		);
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/auth/login");
	});

	it("renames a track for an admin", async () => {
		const token = await signUp();
		const track = await seedTrack();
		const res = await authed(
			`http://localhost/track/${track.id}/rename`,
			token,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "Renamed" }),
			},
		);
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/library?ok=rename");
	});

	it("uses a custom return path", async () => {
		const token = await signUp();
		const track = await seedTrack();
		const res = await authed(
			`http://localhost/track/${track.id}/rename`,
			token,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "Renamed", return: "/album/1" }),
			},
		);
		expect(res.headers.get("location")).toBe("/album/1?ok=rename");
	});
});

describe("POST /track/:id/delete", () => {
	it("deletes a track for an admin", async () => {
		const token = await signUp();
		const track = await seedTrack();
		const res = await authed(
			`http://localhost/track/${track.id}/delete`,
			token,
			{
				method: "POST",
			},
		);
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/library");
	});
});

describe("GET /track/:id", () => {
	it("returns 404 for unknown track", async () => {
		const token = await signUp();
		const res = await authed("http://localhost/track/9999", token);
		expect(res.status).toBe(404);
	});

	it("returns the track entry json", async () => {
		const token = await signUp();
		const track = await seedTrack();
		const res = await authed(`http://localhost/track/${track.id}`, token);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.title).toBe("Track One");
	});
});

describe("GET /track/:id/stream", () => {
	it("returns 404 when the file is missing on disk", async () => {
		const token = await signUp();
		const track = await seedTrack({ file_path: "/nonexistent/missing.mp3" });
		const res = await authed(
			`http://localhost/track/${track.id}/stream`,
			token,
		);
		expect(res.status).toBe(404);
	});

	it("streams the file when it exists", async () => {
		const token = await signUp();
		const filePath = `${musicDir}/existing.mp3`;
		await writeFile(filePath, "fake audio bytes");
		const track = await seedTrack({ file_path: filePath });
		const res = await authed(
			`http://localhost/track/${track.id}/stream`,
			token,
		);
		expect(res.status).toBe(200);
	});
});

async function writeFakeJpeg(path: string) {
	await Bun.$`ffmpeg -y -f lavfi -i color=c=red:s=32x32 -update 1 -frames:v 1 ${path}`.quiet();
}

describe("GET /art/:albumId", () => {
	it("returns 404 when no art exists", async () => {
		const res = await app.handle(new Request("http://localhost/art/1"));
		expect(res.status).toBe(404);
	});

	it("serves the art file when it exists", async () => {
		const [album] = await db
			.insert(albums)
			.values({ title: "Album" })
			.returning({ id: albums.id });
		await mkdir(`${dataDir}/art`, { recursive: true });
		await writeFakeJpeg(`${dataDir}/art/${album.id}.jpg`);
		const res = await app.handle(
			new Request(`http://localhost/art/${album.id}`),
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("image/jpeg");
	});

	it("returns 304 when the etag matches", async () => {
		const [album] = await db
			.insert(albums)
			.values({ title: "Album" })
			.returning({ id: albums.id });
		await mkdir(`${dataDir}/art`, { recursive: true });
		await writeFakeJpeg(`${dataDir}/art/${album.id}.jpg`);
		const first = await app.handle(
			new Request(`http://localhost/art/${album.id}`),
		);
		const etag = first.headers.get("etag") ?? "";
		const second = await app.handle(
			new Request(`http://localhost/art/${album.id}`, {
				headers: { "if-none-match": etag },
			}),
		);
		expect(second.status).toBe(304);
	});
});

describe("POST /library/upload", () => {
	it("redirects to /login when unauthenticated", async () => {
		const form = new FormData();
		form.append("files", new File(["data"], "song.mp3"));
		const res = await app.handle(
			new Request("http://localhost/library/upload", {
				method: "POST",
				body: form,
			}),
		);
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/auth/login");
	});

	it("uploads a valid audio file", async () => {
		const token = await signUp();
		const form = new FormData();
		form.append("files", new File(["fake audio bytes"], "song.mp3"));
		const res = await authed("http://localhost/library/upload", token, {
			method: "POST",
			body: form,
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.uploaded).toBe(1);
	});

	it("skips files with an unsupported extension", async () => {
		const token = await signUp();
		const form = new FormData();
		form.append("files", new File(["not audio"], "notes.txt"));
		const res = await authed("http://localhost/library/upload", token, {
			method: "POST",
			body: form,
		});
		const body = await res.json();
		expect(body.uploaded).toBe(0);
	});
});
