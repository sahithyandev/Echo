import { defineConfig } from "drizzle-kit";
import { getEnvVar } from "./utils/env";

export default defineConfig({
	dialect: "sqlite",
	schema: "./db/schema.ts",
	dbCredentials: {
		url: getEnvVar("DATABASE_URL")
	},
});