import { defineConfig } from "drizzle-kit";
import { getEnvVar } from "./utils/env";

export default defineConfig({
	dialect: "sqlite",
	schema: "./db/schema.ts",
	out: "./db/migrations",
	dbCredentials: {
		url: getEnvVar("ECHO_DATABASE_URL"),
	},
});
