import { cp, mkdir } from "node:fs/promises";

// bun --target -> matching @libsql native addon package (from
// node_modules/libsql/package.json optionalDependencies).
const TARGETS = {
	"linux-x64": { bun: "bun-linux-x64", libsql: "linux-x64-gnu", exe: "echo" },
	"linux-arm64": {
		bun: "bun-linux-arm64",
		libsql: "linux-arm64-gnu",
		exe: "echo",
	},
	"darwin-x64": { bun: "bun-darwin-x64", libsql: "darwin-x64", exe: "echo" },
	"darwin-arm64": {
		bun: "bun-darwin-arm64",
		libsql: "darwin-arm64",
		exe: "echo",
	},
	"windows-x64": {
		bun: "bun-windows-x64",
		libsql: "win32-x64-msvc",
		exe: "echo.exe",
	},
} as const;

type Target = keyof typeof TARGETS;

const target = process.argv[2] as Target | undefined;
if (!target || !(target in TARGETS)) {
	console.error(
		`Usage: bun run scripts/build-binary.ts <${Object.keys(TARGETS).join(" | ")}>`,
	);
	process.exit(1);
}

const { bun, libsql, exe } = TARGETS[target];
const base = (p: string) => new URL(p, import.meta.url).pathname;
const outDir = base(`../dist-binaries/${target}/`);

await mkdir(outDir, { recursive: true });

const compile = Bun.spawn(
	[
		"bun",
		"build",
		base("../index.ts"),
		"--compile",
		`--target=${bun}`,
		"--outfile",
		`${outDir}${exe}`,
	],
	{ stdout: "inherit", stderr: "inherit" },
);
const code = await compile.exited;
if (code !== 0) process.exit(code);

// bun --compile can't embed the @libsql/client native addon or the
// static-served public/ dir — both must sit next to the binary (same
// constraint discovered in step 13, now per cross-compile target).
await mkdir(`${outDir}node_modules/@libsql`, { recursive: true });
await cp(
	base(`../node_modules/@libsql/${libsql}`),
	`${outDir}node_modules/@libsql/${libsql}`,
	{ recursive: true },
);
await cp(base("../public"), `${outDir}public`, { recursive: true });

console.log(`Built ${target} -> dist-binaries/${target}/`);
