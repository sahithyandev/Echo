import { beforeEach, describe, expect, it } from "bun:test";
import { user_sessions } from "../../db/schema";
import { makeTestDb } from "../../db/test-client";
import type { DbLike } from "../../db/types";
import { type App, createApp } from "../../utils/create-app";

const TEST_USER = { email: "user@example.com", password: "Passw0rd!" };

let db: DbLike;
let app: App;

beforeEach(async () => {
	db = makeTestDb();
	app = await createApp(db);
});

function signUpRequest(body = TEST_USER) {
	return new Request("http://localhost/auth/sign-up", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

function signInRequest(body = TEST_USER) {
	return new Request("http://localhost/auth/sign-in", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

function extractSessionToken(res: Response): string {
	const cookie = res.headers.get("set-cookie") ?? "";
	return cookie.match(/session=([^;]+)/)?.[1] ?? "";
}

async function signUp(body = TEST_USER): Promise<{ token: string }> {
	const res = await app.handle(signUpRequest(body));
	return { token: extractSessionToken(res) };
}

describe("POST /auth/sign-up", () => {
	it("creates user, sets session cookie, and redirects to /library", async () => {
		const res = await app.handle(signUpRequest());
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/library");
		expect(res.headers.get("set-cookie")).toContain("session=");
	});

	it("locks registration after first user", async () => {
		await app.handle(signUpRequest());
		const res = await app.handle(signUpRequest());
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toContain("/auth/login?error=1");
	});

	it("rejects weak password by redirecting to login with a weak_password error", async () => {
		const res = await app.handle(
			signUpRequest({ email: "user@example.com", password: "weak" }),
		);
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/auth/login?error=weak_password");
	});
});

describe("POST /auth/sign-in", () => {
	it("sets session cookie and redirects to /library for valid credentials", async () => {
		await signUp();
		const res = await app.handle(signInRequest());
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/library");
		expect(res.headers.get("set-cookie")).toContain("session=");
	});

	it("redirects to /login?error=1 for wrong password", async () => {
		await signUp();
		const res = await app.handle(
			signInRequest({ ...TEST_USER, password: "WrongPass1!" }),
		);
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toContain("/auth/login?error=1");
	});
});

describe("GET /auth/validate", () => {
	it("returns user for valid token", async () => {
		const { token } = await signUp();
		const res = await app.handle(
			new Request("http://localhost/auth/validate", {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toMatchObject({ email: "user@example.com", is_admin: true });
	});

	it("returns NOT_AUTHENTICATED without a token", async () => {
		const res = await app.handle(new Request("http://localhost/auth/validate"));
		expect(res.status).toBe(401);
		expect(await res.text()).toBe("NOT_AUTHENTICATED");
	});

	it("returns SESSION_REVOKED for a revoked session", async () => {
		const { token } = await signUp();
		await db.update(user_sessions).set({ revoked_at: new Date() });
		const res = await app.handle(
			new Request("http://localhost/auth/validate", {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);
		expect(res.status).toBe(401);
		expect(await res.text()).toBe("SESSION_REVOKED");
	});
});
