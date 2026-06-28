import { Html, html } from "@elysiajs/html";
import staticPlugin from "@elysiajs/static";
import { Elysia } from "elysia";
import type { DbLike } from "../db/types";
import createAuthModule from "../modules/auth";
import { IndexPage } from "../pages/index";
import { LoginPage } from "../pages/login";
import { unused } from "./misc";

unused(Html);

export async function createApp(db: DbLike) {
	return new Elysia()
		.use(html())
		.use(await staticPlugin({ prefix: "/" }))
		.get("/", () => <IndexPage />)
		.get("/login", () => <LoginPage />)
		.use(createAuthModule(db));
}

export type App = Awaited<ReturnType<typeof createApp>>;
