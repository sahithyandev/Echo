import { copyFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/libsql";
import type { DbLike } from "./types";

export function makeTestDb(): DbLike {
	const src = process.env.__ECHO_TEMPLATE_DB__;
	if (!src)
		throw new Error(
			"Test preload not run — add db/test-setup.ts to bunfig.toml [test] preload",
		);
	const dest = `/tmp/echo-test-${crypto.randomUUID()}.db`;
	copyFileSync(src, dest);
	return drizzle(`file:${dest}`);
}
