import { describe, expect, it } from "bun:test";
import { Html } from "@elysiajs/html";
import { UploadButton, UploadDialog, UploadEmptyState } from "./upload-dialog";

describe("UploadButton", () => {
	it("renders an upload trigger button", () => {
		const html = Html.createElement(UploadButton, {}) as string;
		expect(html).toContain("upload-open");
		expect(html).toContain("Add tracks");
	});
});

describe("UploadEmptyState", () => {
	it("renders the empty library prompt", () => {
		const html = Html.createElement(UploadEmptyState, {}) as string;
		expect(html).toContain("Your library is empty");
		expect(html).toContain("upload-open");
	});
});

describe("UploadDialog", () => {
	it("renders the upload form", () => {
		const html = Html.createElement(UploadDialog, {}) as string;
		expect(html).toContain("upload-dialog");
		expect(html).toContain("upload-form");
		expect(html).toContain("Upload");
	});
});
