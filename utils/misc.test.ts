import { describe, expect, it } from "bun:test";
import { formatDuration, trackGroup } from "./misc";

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

describe("trackGroup", () => {
	it("groups a leading digit as 0-9", () => {
		expect(trackGroup("9 Crimes")).toBe("0-9");
	});

	it("groups a leading letter, uppercased, regardless of case", () => {
		expect(trackGroup("apple")).toBe("A");
		expect(trackGroup("Apple")).toBe("A");
	});

	it("groups anything else as Others", () => {
		expect(trackGroup("!!!")).toBe("Others");
		expect(trackGroup("")).toBe("Others");
	});

	it("ranks 0-9 before A-Z before Others", () => {
		const rank = (g: string) => (g === "0-9" ? 0 : g === "Others" ? 2 : 1);
		expect(rank(trackGroup("9 Lives"))).toBeLessThan(rank(trackGroup("Zebra")));
		expect(rank(trackGroup("Zebra"))).toBeLessThan(rank(trackGroup("!!!")));
	});
});
