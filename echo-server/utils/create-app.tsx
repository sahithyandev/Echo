import { Html, html } from "@elysiajs/html";
import staticPlugin from "@elysiajs/static";
import tailwind from "bun-plugin-tailwind";
import { Elysia } from "elysia";
import type { DbLike } from "../db/types";
import createAlbumModule from "../modules/album";
import createAnalyticsModule from "../modules/analytics";
import createArtistModule from "../modules/artist";
import createAuthModule from "../modules/auth";
import createAuthMiddleware from "../modules/auth/middleware";
import createHomeModule from "../modules/home";
import createLibraryModule from "../modules/library";
import createSearchModule from "../modules/search";
import createSettingsModule from "../modules/settings";
import { unused } from "./misc";

unused(Html);

const contentTypes: Record<string, string> = {
	css: "text/css",
	js: "application/javascript",
} as const;

async function buildAsset(
	route: string,
	srcPath: string,
	options: Omit<Parameters<typeof Bun.build>[0], "entrypoints">,
) {
	const build = await Bun.build({ entrypoints: [srcPath], ...options });
	if (!build.success)
		throw new Error(`Build failed for ${route}: ${build.logs.join("\n")}`);
	return { route, content: await build.outputs[0].text() };
}

export async function createApp(db: DbLike) {
	const base = (p: string) => new URL(p, import.meta.url).pathname;

	const assets = await Promise.all([
		buildAsset("/global.css", base("../styles.css"), { plugins: [tailwind] }),
		buildAsset("/player.js", base("../client/player.ts"), {
			target: "browser",
		}),
		buildAsset("/search.js", base("../client/search.ts"), {
			target: "browser",
		}),
		buildAsset("/nav.js", base("../client/nav.ts"), {
			target: "browser",
		}),
	]);

	const assetPlugin = new Elysia();
	for (const { route, content } of assets) {
		const ext = route.split(".").pop();
		if (!ext) {
			throw new Error("extension is expected to be not null");
		}
		assetPlugin.get(
			route,
			() =>
				new Response(content, {
					headers: { "content-type": `${contentTypes[ext]}; charset=utf-8` },
				}),
		);
	}

	const authMiddleware = createAuthMiddleware(db);
	return new Elysia()
		.use(html())
		.use(assetPlugin)
		.use(await staticPlugin({ prefix: "/" }))
		.use(authMiddleware)
		.use(createHomeModule(db))
		.use(createLibraryModule(db))
		.use(createAuthModule(db))
		.use(createAlbumModule(db))
		.use(createArtistModule(db))
		.use(createSearchModule(db))
		.use(createSettingsModule(db))
		.use(createAnalyticsModule(db));
}

export type App = Awaited<ReturnType<typeof createApp>>;
