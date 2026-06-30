import { homedir } from "node:os";
import { migrate } from "drizzle-orm/libsql/migrator";
import { client } from "./db/client";
import { LibraryService } from "./modules/library/service";
import { createApp } from "./utils/create-app";
import { getEnvVar } from "./utils/env";

const NODE_ENV = getEnvVar("NODE_ENV");

(async () => {
	if (NODE_ENV === "production") {
		await migrate(client, { migrationsFolder: "./db/migrations" });
	} else if (NODE_ENV === "development") {
		const result = await Bun.$`bunx drizzle-kit push`.text();
		console.log(result);
	}

	const musicDir = `${homedir()}/Music`;
	LibraryService.scanMusicFolder(client, musicDir).then((n) =>
		console.log(`Scanned ${n} tracks from ${musicDir}`),
	);

	const app = (await createApp(client)).listen(3000);

	console.log(
		`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
	);
})();
