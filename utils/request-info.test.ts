import { describe, expect, it } from "bun:test";
import { getRequestInfo } from "./request-info";

describe("getRequestInfo", () => {
	it("extracts first IP from x-forwarded-for", () => {
		const req = new Request("http://localhost/", {
			headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
		});
		expect(getRequestInfo(req).ipAddress).toBe("1.2.3.4");
	});

	it("returns null ipAddress when header is missing", () => {
		const req = new Request("http://localhost/");
		expect(getRequestInfo(req).ipAddress).toBeNull();
	});

	it("extracts user-agent", () => {
		const req = new Request("http://localhost/", {
			headers: { "user-agent": "TestAgent/1.0" },
		});
		expect(getRequestInfo(req).userAgent).toBe("TestAgent/1.0");
	});

	it("returns null userAgent when header is missing", () => {
		const req = new Request("http://localhost/");
		expect(getRequestInfo(req).userAgent).toBeNull();
	});
});
