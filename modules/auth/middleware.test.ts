import { beforeEach, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { user_sessions } from "../../db/schema";
import { makeTestDb } from "../../db/test-client";
import type { DbLike } from "../../db/types";
import { type App, createApp } from "../../utils/create-app";
import { jwtInstance } from "../../utils/jwt";
import createAuthMiddleware from "./middleware";

let db: DbLike;
let app: App;

beforeEach(async () => {
	db = makeTestDb();
	app = await createApp(db);
});

async function signToken(payload: Record<string, string>): Promise<string> {
	const signer = new Elysia()
		.use(jwtInstance)
		.get("/sign", ({ jwt }) => jwt.sign(payload));
	const res = await signer.handle(new Request("http://localhost/sign"));
	return res.text();
}

describe("auth middleware currentUser resolution", () => {
	it("treats a decoded token with the wrong shape as unauthenticated", async () => {
		const token = await signToken({ notAnId: "whatever" });
		const res = await app.handle(
			new Request("http://localhost/auth/validate", {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);
		expect(res.status).toBe(401);
		expect(await res.text()).toBe("NOT_AUTHENTICATED");
	});

	it("still authenticates and touches last_active_at for a stale session", async () => {
		const signUpRes = await app.handle(
			new Request("http://localhost/auth/sign-up", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: "user@example.com",
					password: "Passw0rd!",
				}),
			}),
		);
		const token =
			signUpRes.headers.get("set-cookie")?.match(/session=([^;]+)/)?.[1] ?? "";

		const staleDate = new Date(Date.now() - 10 * 60 * 1000);
		await db.update(user_sessions).set({ last_active_at: staleDate });

		const res = await app.handle(
			new Request("http://localhost/auth/validate", {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);
		expect(res.status).toBe(200);
	});

	it("logs but does not fail the request when the last_active_at update rejects", async () => {
		const signUpRes = await app.handle(
			new Request("http://localhost/auth/sign-up", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: "user2@example.com",
					password: "Passw0rd!",
				}),
			}),
		);
		const token =
			signUpRes.headers.get("set-cookie")?.match(/session=([^;]+)/)?.[1] ?? "";
		await db
			.update(user_sessions)
			.set({ last_active_at: new Date(Date.now() - 10 * 60 * 1000) });

		const failingDb = new Proxy(db, {
			get(target, prop, receiver) {
				if (prop === "update") {
					return () => ({
						set: () => ({
							where: () => Promise.reject(new Error("boom")),
						}),
					});
				}
				return Reflect.get(target, prop, receiver);
			},
		}) as DbLike;

		const failingApp = new Elysia()
			.use(createAuthMiddleware(failingDb))
			.get("/test", ({ currentUser }) => currentUser, { currentUser: true });

		const res = await failingApp.handle(
			new Request("http://localhost/test", {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);
		expect(res.status).toBe(200);
		// Give the fire-and-forget update().catch() a tick to run before the test ends.
		await new Promise((r) => setTimeout(r, 10));
	});
});
