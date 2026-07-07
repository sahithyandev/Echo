import { describe, expect, it } from "bun:test";
import { Html } from "@elysiajs/html";
import { AlbumArt } from "./album-art";

describe("AlbumArt", () => {
	it("renders an svg", () => {
		const html = Html.createElement(AlbumArt, {}) as string;
		expect(html).toContain("<svg");
	});

	it("uses default size 36", () => {
		const html = Html.createElement(AlbumArt, {}) as string;
		expect(html).toContain('width="36"');
		expect(html).toContain('height="36"');
	});

	it("applies custom size", () => {
		const html = Html.createElement(AlbumArt, { size: 64 }) as string;
		expect(html).toContain('width="64"');
		expect(html).toContain('height="64"');
	});
});
