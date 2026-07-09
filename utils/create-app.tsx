import { Html, html } from "@elysiajs/html";
import staticPlugin from "@elysiajs/static";
import { Elysia } from "elysia";
import logixlysia from "logixlysia";
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
import createSubsonicModule from "../modules/subsonic";
import { getEnvVar } from "./env";
import { unused } from "./misc";
import { VERSION } from "./version";

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

/**
 * Runtime bundling for dev, so edits under client/ and styles.css are picked
 * up without a build step. bun-plugin-tailwind is a devDependency, so it's
 * imported lazily here — a top-level import would make production (which
 * never calls this function) require it too, and it isn't installed there.
 */
async function loadDevAssets(base: (p: string) => string) {
	const { default: tailwind } = await import("bun-plugin-tailwind");
	return Promise.all([
		buildAsset("/global.css", base("../styles.css"), {
			plugins: [tailwind],
			external: ["*.woff2"],
		}),
		buildAsset("/player.js", base("../client/player.ts"), {
			target: "browser",
		}),
		buildAsset("/search.js", base("../client/search.ts"), {
			target: "browser",
		}),
		buildAsset("/nav.js", base("../client/nav.ts"), {
			target: "browser",
		}),
		buildAsset("/upload.js", base("../client/upload.ts"), {
			target: "browser",
		}),
		buildAsset("/upload-metadata.js", base("../client/upload-metadata.ts"), {
			target: "browser",
		}),
		buildAsset("/flash.js", base("../client/flash.ts"), {
			target: "browser",
		}),
		buildAsset("/infinite-scroll.js", base("../client/infinite-scroll.ts"), {
			target: "browser",
		}),
	]);
}

/**
 * Reads assets prebuilt by scripts/build-client.ts (dist/) as embedded text
 * imports, so `bun build --compile` bakes them into the standalone binary.
 */
async function loadProdAssets() {
	const [
		globalCss,
		playerJs,
		searchJs,
		navJs,
		uploadJs,
		uploadMetadataJs,
		flashJs,
		infinityScrollJs,
	] = await Promise.all([
		import("../dist/global.css", { with: { type: "text" } }),
		import("../dist/player.js", { with: { type: "text" } }),
		import("../dist/search.js", { with: { type: "text" } }),
		import("../dist/nav.js", { with: { type: "text" } }),
		import("../dist/upload.js", { with: { type: "text" } }),
		import("../dist/upload-metadata.js", { with: { type: "text" } }),
		import("../dist/flash.js", { with: { type: "text" } }),
		import("../dist/infinite-scroll.js", { with: { type: "text" } }),
	]);
	return [
		{ route: "/global.css", content: globalCss.default },
		{ route: "/player.js", content: playerJs.default },
		{ route: "/search.js", content: searchJs.default },
		{ route: "/nav.js", content: navJs.default },
		{ route: "/upload.js", content: uploadJs.default },
		{ route: "/upload-metadata.js", content: uploadMetadataJs.default },
		{ route: "/flash.js", content: flashJs.default },
		{ route: "/infinite-scroll.js", content: infinityScrollJs.default },
	];
}

export async function createApp(db: DbLike) {
	const base = (p: string) => new URL(p, import.meta.url).pathname;

	const assets =
		getEnvVar("NODE_ENV") === "production"
			? await loadProdAssets()
			: await loadDevAssets(base);

	const assetPlugin = new Elysia();
	for (const { route, content } of assets) {
		const ext = route.split(".").pop();
		if (!ext) {
			throw new Error("extension is expected to be not null");
		}
		const etag = `"${Bun.hash(content).toString(36)}"`;
		assetPlugin.get(route, ({ headers, set }) => {
			if (headers["if-none-match"] === etag) {
				set.status = 304;
				return null;
			}
			return new Response(content, {
				headers: {
					"content-type": `${contentTypes[ext]}; charset=utf-8`,
					"cache-control": "public, max-age=31536000, immutable",
					etag,
				},
			});
		});
	}

	const authMiddleware = createAuthMiddleware(db);
	return new Elysia()
		.use(
			logixlysia({
				config: {
					ip: true,
					startupMessageFormat: "simple",
					customLogFormat:
						"{level} {duration} {method} {pathname} {status} {message}",
				},
			}),
		)
		.use(html())
		.use(assetPlugin)
		.use(await staticPlugin({ prefix: "/" }))
		.get("/health", () => ({ status: "ok", version: VERSION }))
		.use(authMiddleware)
		.use(createHomeModule(db))
		.use(createLibraryModule(db))
		.use(createAuthModule(db))
		.use(createAlbumModule(db))
		.use(createArtistModule(db))
		.use(createSearchModule(db))
		.use(createSettingsModule(db))
		.use(createAnalyticsModule(db))
		.use(createSubsonicModule(db));
}

export type App = Awaited<ReturnType<typeof createApp>>;
