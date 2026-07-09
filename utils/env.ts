import { homedir } from "node:os";

// Dev keeps the repo-root echo.db (relative to this file) for convenience —
// no .env file exists and the dev workflow already depends on that path.
// Everywhere else (compiled binary, Docker, systemd) needs a real path that
// doesn't depend on where the running module lives, so it's derived from
// ECHO_DATA_DIR (with its own default falling back to homedir()) instead of
// a second, independently hardcoded homedir() path — otherwise a deployment
// that only overrides ECHO_DATA_DIR silently gets a DB outside that dir.
// Bracket notation, not `process.env.NODE_ENV` — `bun build --compile`
// inlines the dotted literal form at *compile* time (like webpack's
// DefinePlugin), which would permanently bake in whichever NODE_ENV was set
// in the shell that ran the build, ignoring it at runtime entirely.
const DEFAULT_VALUES = {
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

		if (name === "ECHO_DATABASE_URL") {
			// biome-ignore lint/complexity/useLiteralKeys: wouldn't work on compilation
			return process.env["NODE_ENV"] === "production"
				? `${getEnvVar("ECHO_DATA_DIR")}/echo.db`
				: new URL("../echo.db", import.meta.url).pathname;
		}

		if (name in DEFAULT_VALUES) {
			return DEFAULT_VALUES[name as DEFINED_DEFAULT_VALUE_KEY];
		}

		throw new Error(`Environment variable ${name} is not set`);
	}
	return value;
}
