import { mkdir } from "node:fs/promises";
import tailwind from "bun-plugin-tailwind";

const base = (p: string) => new URL(p, import.meta.url).pathname;
const distDir = base("../dist/");

const assets: Array<{
	out: string;
	src: string;
	options: Omit<Parameters<typeof Bun.build>[0], "entrypoints">;
}> = [
	{
		out: "global.css",
		src: base("../styles.css"),
		options: { plugins: [tailwind] },
	},
	{
		out: "player.js",
		src: base("../client/player.ts"),
		options: { target: "browser" },
	},
	{
		out: "search.js",
		src: base("../client/search.ts"),
		options: { target: "browser" },
	},
	{
		out: "nav.js",
		src: base("../client/nav.ts"),
		options: { target: "browser" },
	},
	{
		out: "upload.js",
		src: base("../client/upload.ts"),
		options: { target: "browser" },
	},
	{
		out: "upload-metadata.js",
		src: base("../client/upload-metadata.ts"),
		options: { target: "browser" },
	},
	{
		out: "flash.js",
		src: base("../client/flash.ts"),
		options: { target: "browser" },
	},
];

await mkdir(distDir, { recursive: true });

for (const { out, src, options } of assets) {
	const build = await Bun.build({
		entrypoints: [src],
		minify: true,
		...options,
	});
	if (!build.success)
		throw new Error(`Build failed for ${out}: ${build.logs.join("\n")}`);
	await Bun.write(`${distDir}${out}`, await build.outputs[0].text());
}

console.log(`Built ${assets.length} client assets to ${distDir}`);
