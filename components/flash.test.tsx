import { describe, expect, it } from "bun:test";
import { Html } from "@elysiajs/html";
import { Flash } from "./flash";

describe("Flash", () => {
	it("renders nothing when no message", () => {
		const html = Html.createElement(Flash, { variant: "ok" });
		expect(html).toBeFalsy();
	});

	it("renders the message with ok styling", () => {
		const html = Html.createElement(Flash, {
			variant: "ok",
			message: "Saved",
		}) as string;
		expect(html).toContain("Saved");
		expect(html).toContain("text-accent");
	});

	it("renders the message with error styling", () => {
		const html = Html.createElement(Flash, {
			variant: "error",
			message: "Failed",
		}) as string;
		expect(html).toContain("Failed");
		expect(html).toContain("text-red-400");
	});
});
