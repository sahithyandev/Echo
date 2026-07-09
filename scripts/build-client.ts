import { mkdir } from "node:fs/promises";
import tailwind from "bun-plugin-tailwind";
import { assetRoute, assetSources } from "../utils/asset-manifest";

const base = (p: string) => new URL(p, import.meta.url).pathname;
const distDir = base("../dist/");

await mkdir(distDir, { recursive: true });

for (const src of assetSources) {
	const options: Omit<Parameters<typeof Bun.build>[0], "entrypoints"> =
		src.endsWith(".css")
			? { plugins: [tailwind], external: ["*.woff2"] }
			: { target: "browser" };
	const build = await Bun.build({
		entrypoints: [base(src)],
		minify: true,
		...options,
	});
	if (!build.success)
		throw new Error(`Build failed for ${src}: ${build.logs.join("\n")}`);
	await Bun.write(
		`${distDir}${assetRoute(src).slice(1)}`,
		await build.outputs[0].text(),
	);
}

console.log(`Built ${assetSources.length} client assets to ${distDir}`);
