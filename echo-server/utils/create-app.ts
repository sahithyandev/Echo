import staticPlugin from "@elysiajs/static";
import { Elysia } from "elysia";
import { client } from "../db/client";
import createAuthModule from "../modules/auth";

export async function createApp() {
	return new Elysia()
		.use(await staticPlugin({ prefix: "/" }))
		.use(createAuthModule(client))
		.listen(3000);
}