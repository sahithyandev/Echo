import { homedir } from "node:os";

const DEFAULT_VALUES = {
	ECHO_DATABASE_URL: new URL("../echo.db", import.meta.url).pathname,
	NODE_ENV: "development",
	ECHO_DATA_DIR: `${homedir()}/.echo`,
	ECHO_MUSIC_DIR: `${homedir()}/Music`,
	ECHO_PORT: "3000",
	ECHO_HOST: "localhost",
} as const;

type DEFINED_DEFAULT_VALUE_KEY = keyof typeof DEFAULT_VALUES;

export function getEnvVar(name: string, defaultValue?: string): string {
	const value = process.env[name];
	if (value === undefined) {
		if (defaultValue) {
			return defaultValue;
		}

		if (name in DEFAULT_VALUES) {
			return DEFAULT_VALUES[name as DEFINED_DEFAULT_VALUE_KEY];
		}

		throw new Error(`Environment variable ${name} is not set`);
	}
	return value;
}
