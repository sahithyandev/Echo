import staticPlugin from "@elysiajs/static";
import { Elysia } from "elysia";

export async function createApp() {
	return new Elysia()
		.use(await staticPlugin({
			prefix: "/"
		}))
		.listen(3000);
}