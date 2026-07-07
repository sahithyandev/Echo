import { describe, expect, it } from "bun:test";
import { Auth } from "./service";

describe("Auth.hashToken", () => {
	it("returns a deterministic sha256 hex string", () => {
		const result = Auth.hashToken("my-token");
		expect(result).toBe(Auth.hashToken("my-token"));
		expect(result).toMatch(/^[0-9a-f]{64}$/);
	});

	it("produces different hashes for different inputs", () => {
		expect(Auth.hashToken("a")).not.toBe(Auth.hashToken("b"));
	});

	it("produces known hash for known input", () => {
		// sha256("hello") is fixed
		expect(Auth.hashToken("hello")).toBe(
			"2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
		);
	});
});
