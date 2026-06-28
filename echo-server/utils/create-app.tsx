import { html, Html } from "@elysiajs/html";
import staticPlugin from "@elysiajs/static";
import { Elysia } from "elysia";
import { IndexPage } from "../pages/index";
import { LoginPage } from "../pages/login";
import createAuthModule from "../modules/auth";
import type { DbLike } from "../db/types";

export async function createApp(db: DbLike) {
	return new Elysia()
		.use(html())
		.use(await staticPlugin({ prefix: "/" }))
		.get("/", () => <IndexPage />)
		.get("/login", () => <LoginPage />)
		.use(createAuthModule(db));
}

export type App = Awaited<ReturnType<typeof createApp>>;
