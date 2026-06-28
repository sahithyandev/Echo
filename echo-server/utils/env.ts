const DEFAULT_VALUES = {
	DATABASE_URL: new URL("../echo.db", import.meta.url).pathname,
	NODE_ENV: "development",
} as const;

type DEFINED_DEFAULT_VALUE_KEY = keyof typeof DEFAULT_VALUES;

console.log("DATABASE:", DEFAULT_VALUES.DATABASE_URL);

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
