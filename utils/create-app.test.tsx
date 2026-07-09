import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { makeTestDb } from "../db/test-client";
import type { DbLike } from "../db/types";
import { createApp } from "./create-app";

let db: DbLike;
let originalNodeEnv: string | undefined;

beforeEach(() => {
	db = makeTestDb();
	originalNodeEnv = process.env.NODE_ENV;
});

afterEach(() => {
	process.env.NODE_ENV = originalNodeEnv;
});

describe("createApp", () => {
	it("serves prebuilt assets in production mode", async () => {
		process.env.NODE_ENV = "production";
		const app = await createApp(db);
		const res = await app.handle(new Request("http://localhost/global.css"));
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/css");
	});

	it("returns 304 when the etag matches If-None-Match", async () => {
		process.env.NODE_ENV = "production";
		const app = await createApp(db);
		const first = await app.handle(new Request("http://localhost/global.css"));
		const etag = first.headers.get("etag") ?? "";
		const second = await app.handle(
			new Request("http://localhost/global.css", {
				headers: { "if-none-match": etag },
			}),
		);
		expect(second.status).toBe(304);
	});

	it("responds to /health", async () => {
		const app = await createApp(db);
		const res = await app.handle(new Request("http://localhost/health"));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.status).toBe("ok");
	});
});
