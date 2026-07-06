import { afterEach, describe, expect, it } from "bun:test";
import { getEnvVar } from "./env";

const KEY = "__ECHO_TEST_ENV_VAR__";

describe("getEnvVar", () => {
	afterEach(() => {
		delete process.env[KEY];
	});

	it("returns the env var when set", () => {
		process.env[KEY] = "hello";
		expect(getEnvVar(KEY)).toBe("hello");
	});

	it("returns the provided default when env var is unset", () => {
		expect(getEnvVar(KEY, "fallback")).toBe("fallback");
	});

	it("throws when env var is unset and no default provided", () => {
		expect(() => getEnvVar(KEY)).toThrow(`${KEY} is not set`);
	});

	it("returns built-in default for ECHO_DATABASE_URL", () => {
		const original = process.env.ECHO_DATABASE_URL;
		delete process.env.ECHO_DATABASE_URL;
		try {
			expect(getEnvVar("ECHO_DATABASE_URL")).toMatch(/echo\.db$/);
		} finally {
			if (original !== undefined) process.env.ECHO_DATABASE_URL = original;
		}
	});
});
