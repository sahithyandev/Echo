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
import { assetRoute, assetSources } from "./asset-manifest";
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
 * Runtime bundling for dev, so edits under client/ and global.css are picked
 * up without a build step. bun-plugin-tailwind is a devDependency, so it's
 * imported lazily here — a top-level import would make production (which
 * never calls this function) require it too, and it isn't installed there.
 */
async function loadDevAssets(base: (p: string) => string) {
	const { default: tailwind } = await import("bun-plugin-tailwind");
	return Promise.all(
		assetSources.map((src) =>
			src.endsWith(".css")
				? buildAsset(assetRoute(src), base(src), {
						plugins: [tailwind],
						external: ["*.woff2"],
					})
				: buildAsset(assetRoute(src), base(src), { target: "browser" }),
		),
	);
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
	const contents = [
		globalCss.default,
		playerJs.default,
		searchJs.default,
		navJs.default,
		uploadJs.default,
		uploadMetadataJs.default,
		flashJs.default,
		infinityScrollJs.default,
	];
	return assetSources.map((src, i) => ({
		route: assetRoute(src),
		content: contents[i],
	}));
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
					// No content hash in these routes (they're stable paths like
					// /player.js), so "immutable" would tell browsers to never
					// revalidate — meaning a deploy that changes this file leaves
					// old tabs running stale JS against new HTML indefinitely.
					// must-revalidate forces an ETag check (cheap 304) every load.
					"cache-control": "public, max-age=0, must-revalidate",
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
