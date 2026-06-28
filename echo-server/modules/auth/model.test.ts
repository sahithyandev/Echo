import { describe, expect, it } from "bun:test";
import { TypeCompiler } from "elysia/type-system";
import { AuthModel } from "./model";

describe("AuthModel.isJwtData", () => {
	it("accepts valid shape", () => {
		expect(AuthModel.isJwtData({ id: 1 })).toBe(true);
	});

	it("rejects missing id", () => {
		expect(AuthModel.isJwtData({})).toBe(false);
	});

	it("rejects non-number id", () => {
		expect(AuthModel.isJwtData({ id: "1" })).toBe(false);
	});

	it("rejects null", () => {
		expect(AuthModel.isJwtData(null)).toBe(false);
	});
});

describe("signUpBody password pattern", () => {
	const check = TypeCompiler.Compile(AuthModel.signUpBody);
	const valid = (password: string) =>
		check.Check({ email: "user@example.com", password });

	it("accepts a strong password", () => {
		expect(valid("Passw0rd!")).toBe(true);
	});

	it("rejects all-lowercase", () => {
		expect(valid("password1!")).toBe(false);
	});

	it("rejects no digit", () => {
		expect(valid("Password!!")).toBe(false);
	});

	it("rejects no special character", () => {
		expect(valid("Passw0rd1")).toBe(false);
	});

	it("rejects too short", () => {
		expect(valid("P0!ab")).toBe(false);
	});
});
