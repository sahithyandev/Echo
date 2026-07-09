import { describe, expect, it } from "bun:test";
import { makeId, parseId } from "./ids";

describe("subsonic ids", () => {
	it("makes a prefixed id", () => {
		expect(makeId("ar", 5)).toBe("ar-5");
		expect(makeId("al", 12)).toBe("al-12");
		expect(makeId("tr", 0)).toBe("tr-0");
	});

	it("parses a valid id back into type and number", () => {
		expect(parseId("ar-5")).toEqual({ type: "ar", id: 5 });
		expect(parseId("tr-123")).toEqual({ type: "tr", id: 123 });
	});

	it("returns null for undefined input", () => {
		expect(parseId(undefined)).toBeNull();
	});

	it("returns null for malformed input", () => {
		expect(parseId("")).toBeNull();
		expect(parseId("xx-5")).toBeNull();
		expect(parseId("ar-abc")).toBeNull();
		expect(parseId("ar5")).toBeNull();
	});
});
