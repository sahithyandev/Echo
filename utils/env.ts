import { homedir } from "node:os";

// Dev keeps the repo-root echo.db (relative to this file) for convenience —
// no .env file exists and the dev workflow already depends on that path.
// Everywhere else (compiled binary, Docker, systemd) needs a real path that
// doesn't depend on where the running module lives, so it's derived from
// the same homedir()-based dir as ECHO_DATA_DIR instead.
// Bracket notation, not `process.env.NODE_ENV` — `bun build --compile`
// inlines the dotted literal form at *compile* time (like webpack's
// DefinePlugin), which would permanently bake in whichever NODE_ENV was set
// in the shell that ran the build, ignoring it at runtime entirely.
const DEFAULT_VALUES = {
	ECHO_DATABASE_URL:
		// biome-ignore lint/complexity/useLiteralKeys: wouldn't work on compilation
		process.env["NODE_ENV"] === "production"
			? `${homedir()}/.echo/echo.db`
			: new URL("../echo.db", import.meta.url).pathname,
	NODE_ENV: "development",
	ECHO_DATA_DIR: `${homedir()}/.echo`,
	ECHO_MUSIC_DIR: `${homedir()}/Music`,
	ECHO_PORT: "3000",
	// Literal IP, not "localhost" — some hosts resolve that to ::1 only,
	// which leaves 127.0.0.1 (and reverse proxies pointed at it) refused.
	ECHO_HOST: "127.0.0.1",
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
