import { Html, html } from "@elysiajs/html";
import staticPlugin from "@elysiajs/static";
import tailwind from "bun-plugin-tailwind";
import { Elysia } from "elysia";
import type { DbLike } from "../db/types";
import createAlbumModule from "../modules/album";
import createArtistModule from "../modules/artist";
import createAuthModule from "../modules/auth";
import createAuthMiddleware from "../modules/auth/middleware";
import createLibraryModule from "../modules/library";
import { IndexPage } from "../pages/index";
import { unused } from "./misc";

unused(Html);

export async function createApp(db: DbLike) {
	const cssPath = new URL("../styles.css", import.meta.url).pathname;
	const cssBuild = await Bun.build({
		entrypoints: [cssPath],
		plugins: [tailwind],
	});
	if (!cssBuild.success)
		throw new Error(`CSS build failed: ${cssBuild.logs.join("\n")}`);
	const css = await cssBuild.outputs[0].text();

	const playerPath = new URL("../player.ts", import.meta.url).pathname;
	const playerBuild = await Bun.build({
		entrypoints: [playerPath],
		target: "browser",
	});
	if (!playerBuild.success)
		throw new Error(`Player build failed: ${playerBuild.logs.join("\n")}`);
	const playerJs = await playerBuild.outputs[0].text();

	const authMiddleware = createAuthMiddleware(db);
	return new Elysia()
		.use(html())
		.get(
			"/global.css",
			() =>
				new Response(css, {
					headers: { "content-type": "text/css; charset=utf-8" },
				}),
		)
		.get(
			"/player.js",
			() =>
				new Response(playerJs, {
					headers: { "content-type": "application/javascript; charset=utf-8" },
				}),
		)
		.use(await staticPlugin({ prefix: "/" }))
		.use(authMiddleware)
		.get("/", () => <IndexPage />)
		.use(createLibraryModule(db))
		.use(createAuthModule(db))
		.use(createAlbumModule(db))
		.use(createArtistModule(db));
}

export type App = Awaited<ReturnType<typeof createApp>>;
