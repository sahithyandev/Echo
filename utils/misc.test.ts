import { describe, expect, it } from "bun:test";
import { formatDuration } from "./misc";

describe("formatDuration", () => {
	it("returns empty string for null", () => {
		expect(formatDuration(null)).toBe("");
	});

	it("returns empty string for 0", () => {
		expect(formatDuration(0)).toBe("");
	});

	it("formats seconds under a minute", () => {
		expect(formatDuration(45)).toBe("0:45");
	});

	it("pads seconds below 10", () => {
		expect(formatDuration(65)).toBe("1:05");
	});

	it("formats whole minutes", () => {
		expect(formatDuration(180)).toBe("3:00");
	});

	it("formats hours-worth of seconds", () => {
		expect(formatDuration(3661)).toBe("61:01");
	});
});
