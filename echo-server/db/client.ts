import { drizzle } from "drizzle-orm/libsql";
import { getEnvVar } from "../utils/env";

const dbUrl = getEnvVar("DATABASE_URL");
export const client = drizzle(
	dbUrl.startsWith("file:") ? dbUrl : `file:${dbUrl}`,
);
