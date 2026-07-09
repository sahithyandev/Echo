export const assetSources = [
	"../global.css",
	"../client/player.ts",
	"../client/search.ts",
	"../client/nav.ts",
	"../client/upload.ts",
	"../client/upload-metadata.ts",
	"../client/flash.ts",
	"../client/infinite-scroll.ts",
] as const;

export function assetRoute(src: string): string {
	return `/${src.split("/").pop()?.replace(/\.ts$/, ".js")}`;
}
