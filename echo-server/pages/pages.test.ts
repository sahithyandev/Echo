import { beforeEach, describe, expect, it } from "bun:test";
import { makeTestDb } from "../db/test-client";
import { createApp, type App } from "../utils/create-app";

let app: App;

beforeEach(async () => {
	app = await createApp(makeTestDb());
});

describe("GET /", () => {
	it("returns 200 with html content-type", async () => {
		const res = await app.handle(new Request("http://localhost/"));
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
	});
});

describe("GET /login", () => {
	it("returns 200 with html content-type", async () => {
		const res = await app.handle(new Request("http://localhost/login"));
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
	});
});
