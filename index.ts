import { client } from "./db/client";
import { runMigrations } from "./db/migrate";
import { LibraryService } from "./modules/library/service";
import { SettingsService } from "./modules/settings/service";
import { createApp } from "./utils/create-app";
import { getEnvVar } from "./utils/env";

const NODE_ENV = getEnvVar("NODE_ENV");

(async () => {
	console.log("Database:", getEnvVar("ECHO_DATABASE_URL"));
	console.log("Data directory:", getEnvVar("ECHO_DATA_DIR"));
	console.log("Music directory:", getEnvVar("ECHO_MUSIC_DIR"));

	if (NODE_ENV === "production") {
		console.log("Running migrations...");
		await runMigrations(client);
	} else if (NODE_ENV === "development") {
		console.log("Syncing schema (drizzle-kit push)...");
		const result = await Bun.$`bunx drizzle-kit push`.text();
		console.log(result);
	} else {
		console.warn(`Unrecognized NODE_ENV "${NODE_ENV}" — skipping migrations.`);
	}

	const { musicDir, dataDir } = await SettingsService.getDirs(client);
	const artDir = `${dataDir}/art`;
	console.log(`Scanning music from ${musicDir}...`);
	LibraryService.scanMusicFolder(client, musicDir, artDir)
		.then((n) => console.log(`Scanned ${n} tracks from ${musicDir}`))
		.catch((err) => console.error("Library scan failed:", err));

	const app = (await createApp(client)).listen({
		port: Number(getEnvVar("ECHO_PORT")),
		hostname: getEnvVar("ECHO_HOST"),
	});

	console.log(
		`Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
	);
})();
