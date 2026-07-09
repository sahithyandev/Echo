import { beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { app_settings, tracks, user_sessions, users } from "../../db/schema";
import { makeTestDb } from "../../db/test-client";
import type { DbLike } from "../../db/types";
import { type App, createApp } from "../../utils/create-app";

const ADMIN = { email: "admin@example.com", password: "Passw0rd!" };
const OTHER = { email: "other@example.com", password: "Passw0rd!" };

let db: DbLike;
let app: App;

beforeEach(async () => {
	db = makeTestDb();
	app = await createApp(db);
});

function extractSessionCookie(res: Response) {
	return res.headers.get("set-cookie")?.match(/session=([^;]+)/)?.[1] ?? "";
}

async function signUp(body: typeof ADMIN): Promise<string> {
	const res = await app.handle(
		new Request("http://localhost/auth/sign-up", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
	);
	return extractSessionCookie(res);
}

async function openSignups() {
	await db
		.insert(app_settings)
		.values({ id: 1, signup_mode: "open" })
		.onConflictDoUpdate({
			target: app_settings.id,
			set: { signup_mode: "open" },
		});
}

function req(
	path: string,
	token: string,
	body?: Record<string, unknown>,
	method = "POST",
) {
	return app.handle(
		new Request(`http://localhost${path}`, {
			method,
			headers: {
				"Content-Type": "application/json",
				Cookie: `session=${token}`,
			},
			body: body ? JSON.stringify(body) : undefined,
		}),
	);
}

describe("GET /settings", () => {
	it("redirects to /login when unauthenticated", async () => {
		const res = await app.handle(new Request("http://localhost/settings"));
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/auth/login");
	});

	it("returns 200 html for an admin (first user)", async () => {
		const token = await signUp(ADMIN);
		const res = await app.handle(
			new Request("http://localhost/settings", {
				headers: { Cookie: `session=${token}` },
			}),
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
	});

	it("returns 200 html for a non-admin user", async () => {
		await signUp(ADMIN);
		await openSignups();
		const token = await signUp(OTHER);
		const res = await app.handle(
			new Request("http://localhost/settings", {
				headers: { Cookie: `session=${token}` },
			}),
		);
		expect(res.status).toBe(200);
	});
});

describe("POST /settings/profile", () => {
	it("updates the user's name", async () => {
		const token = await signUp(ADMIN);
		const res = await req("/settings/profile", token, { name: "New Name" });
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/settings?ok=profile");
	});
});

describe("POST /settings/password", () => {
	it("changes the password with correct current password", async () => {
		const token = await signUp(ADMIN);
		const res = await req("/settings/password", token, {
			current_password: ADMIN.password,
			new_password: "NewPassw0rd!",
		});
		expect(res.headers.get("location")).toBe("/settings?ok=password");
	});

	it("rejects an incorrect current password", async () => {
		const token = await signUp(ADMIN);
		const res = await req("/settings/password", token, {
			current_password: "WrongPass1!",
			new_password: "NewPassw0rd!",
		});
		expect(res.headers.get("location")).toBe("/settings?error=password");
	});
});

describe("POST /settings/subsonic", () => {
	it("sets a subsonic password", async () => {
		const token = await signUp(ADMIN);
		const res = await req("/settings/subsonic", token, {
			subsonic_password: "streamkey",
		});
		expect(res.headers.get("location")).toBe("/settings?ok=subsonic");
	});
});

describe("POST /settings/sessions/:id/revoke", () => {
	it("revokes the given session", async () => {
		const token = await signUp(ADMIN);
		const [session] = await db.select().from(user_sessions);
		const res = await req(`/settings/sessions/${session.id}/revoke`, token, {});
		expect(res.headers.get("location")).toBe("/settings?ok=session-revoked");
	});
});

describe("POST /settings/sessions/revoke-others", () => {
	it("revokes other sessions", async () => {
		const token = await signUp(ADMIN);
		const res = await req("/settings/sessions/revoke-others", token, {});
		expect(res.headers.get("location")).toBe("/settings?ok=sessions-revoked");
	});
});

describe("POST /settings/admin/signups", () => {
	it("allows an admin to change signup mode", async () => {
		const token = await signUp(ADMIN);
		const res = await req("/settings/admin/signups", token, {
			mode: "open",
		});
		expect(res.headers.get("location")).toBe("/settings?ok=signups");
	});

	it("forbids a non-admin", async () => {
		await signUp(ADMIN);
		await openSignups();
		const token = await signUp(OTHER);
		const res = await req("/settings/admin/signups", token, {
			mode: "open",
		});
		expect(res.status).toBe(403);
	});
});

describe("POST /settings/admin/users/:id/admin", () => {
	it("promotes another user to admin", async () => {
		const adminToken = await signUp(ADMIN);
		await openSignups();
		await signUp(OTHER);
		const other = await db
			.select()
			.from(users)
			.then((rows) => rows.find((u) => u.email === OTHER.email));
		const res = await req(
			`/settings/admin/users/${other?.id}/admin`,
			adminToken,
			{ is_admin: "true" },
		);
		expect(res.headers.get("location")).toBe("/settings?ok=user-updated");
	});

	it("refuses to demote yourself", async () => {
		const adminToken = await signUp(ADMIN);
		const [self] = await db.select().from(users);
		const res = await req(
			`/settings/admin/users/${self.id}/admin`,
			adminToken,
			{ is_admin: "false" },
		);
		expect(res.headers.get("location")).toBe("/settings?error=self");
	});
});

describe("POST /settings/admin/users/:id/active", () => {
	it("deactivates another user", async () => {
		const adminToken = await signUp(ADMIN);
		await openSignups();
		await signUp(OTHER);
		const other = await db
			.select()
			.from(users)
			.then((rows) => rows.find((u) => u.email === OTHER.email));
		const res = await req(
			`/settings/admin/users/${other?.id}/active`,
			adminToken,
			{ is_active: "false" },
		);
		expect(res.headers.get("location")).toBe("/settings?ok=user-updated");
	});

	it("refuses to deactivate yourself as the last admin", async () => {
		const adminToken = await signUp(ADMIN);
		const [self] = await db.select().from(users);
		const res = await req(
			`/settings/admin/users/${self.id}/active`,
			adminToken,
			{ is_active: "false" },
		);
		expect(res.headers.get("location")).toBe("/settings?error=self");
	});
});

describe("POST /settings/admin/rescan", () => {
	it("kicks off a rescan and redirects", async () => {
		const token = await signUp(ADMIN);
		const res = await req("/settings/admin/rescan", token, {});
		expect(res.headers.get("location")).toBe("/settings?ok=rescan");
	});
});

describe("POST /settings/admin/dirs", () => {
	it("sets music/data dirs and redirects", async () => {
		const token = await signUp(ADMIN);
		const musicDir = await mkdtemp(`${tmpdir()}/echo-music-`);
		const dataDir = await mkdtemp(`${tmpdir()}/echo-data-`);
		const res = await req("/settings/admin/dirs", token, {
			music_dir: musicDir,
			data_dir: dataDir,
		});
		expect(res.headers.get("location")).toBe("/settings?ok=dirs");
	});
});

describe("GET/PUT /playback/settings", () => {
	it("returns 401 when unauthenticated", async () => {
		const res = await app.handle(
			new Request("http://localhost/playback/settings"),
		);
		expect(res.status).toBe(401);
	});

	it("gets default settings and updates them", async () => {
		const token = await signUp(ADMIN);
		const res = await req("/playback/settings", token, undefined, "GET");
		expect(res.status).toBe(200);

		const putRes = await req(
			"/playback/settings",
			token,
			{
				shuffle: true,
				repeat_mode: "all",
			},
			"PUT",
		);
		expect(putRes.status).toBe(200);
		const body = await putRes.json();
		expect(body.shuffle).toBe(true);
	});
});

describe("POST /history", () => {
	it("returns 401 when unauthenticated", async () => {
		const res = await app.handle(
			new Request("http://localhost/history", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ track_id: 1 }),
			}),
		);
		expect(res.status).toBe(401);
	});

	it("records history for a track", async () => {
		const token = await signUp(ADMIN);
		const [track] = await db
			.insert(tracks)
			.values({ title: "T", file_path: "/music/t.mp3" })
			.returning({ id: tracks.id });
		const res = await req("/history", token, { track_id: track.id });
		expect(res.status).toBe(204);
	});
});

describe("POST /playback/sync", () => {
	it("syncs playback position", async () => {
		const token = await signUp(ADMIN);
		const [track] = await db
			.insert(tracks)
			.values({ title: "T", file_path: "/music/t2.mp3" })
			.returning({ id: tracks.id });
		const res = await req("/playback/sync", token, {
			track_id: track.id,
			seconds: 5,
			position_seconds: 10,
			playing: true,
		});
		expect(res.status).toBe(204);
	});
});
