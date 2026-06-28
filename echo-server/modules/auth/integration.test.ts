import { beforeEach, describe, expect, it } from "bun:test";
import { makeTestDb } from "../../db/test-client";
import { user_sessions } from "../../db/schema";
import { createApp, type App } from "../../utils/create-app";
import type { DbLike } from "../../db/types";

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

async function signUp(body = TEST_USER): Promise<{ token: string; id: number }> {
	const res = await app.handle(signUpRequest(body));
	return res.json();
}

describe("POST /auth/sign-up", () => {
	it("creates user and returns token", async () => {
		const res = await app.handle(signUpRequest());
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toMatchObject({ email: "user@example.com", name: "user" });
		expect(typeof body.token).toBe("string");
		expect(typeof body.id).toBe("number");
	});

	it("rejects duplicate email with friendly message", async () => {
		await app.handle(signUpRequest());
		const res = await app.handle(signUpRequest());
		expect(res.status).toBeGreaterThanOrEqual(400);
		expect(await res.text()).toContain("already registered");
	});

	it("rejects weak password with 422", async () => {
		const res = await app.handle(
			signUpRequest({ email: "user@example.com", password: "weak" }),
		);
		expect(res.status).toBe(422);
	});
});

describe("POST /auth/sign-in", () => {
	it("returns token for valid credentials", async () => {
		await signUp();
		const res = await app.handle(signInRequest());
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(typeof body.token).toBe("string");
	});

	it("rejects wrong password", async () => {
		await signUp();
		const res = await app.handle(
			signInRequest({ ...TEST_USER, password: "WrongPass1!" }),
		);
		expect(res.status).toBeGreaterThanOrEqual(400);
		expect(await res.text()).toContain("Invalid email or password");
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
		expect(body).toMatchObject({ email: "user@example.com" });
	});

	it("returns NOT_AUTHENTICATED without a token", async () => {
		const res = await app.handle(
			new Request("http://localhost/auth/validate"),
		);
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
