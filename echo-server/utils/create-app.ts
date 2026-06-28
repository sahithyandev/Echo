import staticPlugin from "@elysiajs/static";
import { Elysia } from "elysia";
import createAuthModule from "../modules/auth";
import type { DbLike } from "../db/types";

export async function createApp(db: DbLike) {
	return new Elysia()
		.use(await staticPlugin({ prefix: "/" }))
		.use(createAuthModule(db))
		.listen(3000);
}