import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const templateDb = `/tmp/echo-test-template-${Date.now()}.db`;

const result = Bun.spawnSync(
	[path.join(serverRoot, "node_modules/.bin/drizzle-kit"), "push"],
	{
		cwd: serverRoot,
		env: { ...process.env, DATABASE_URL: templateDb },
		stdout: "ignore",
		stderr: "pipe",
	},
);

if (!result.success) {
	throw new Error(
		`drizzle-kit push failed:\n${new TextDecoder().decode(result.stderr)}`,
	);
}

process.env.__ECHO_TEMPLATE_DB__ = templateDb;
