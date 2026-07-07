import { describe, expect, it } from "bun:test";
import { fail, ok, toXml } from "./respond";

describe("subsonic respond", () => {
	it("wraps a success payload in the standard envelope", () => {
		const payload = ok({
			artists: { artist: [{ id: "ar-1", name: "Boards" }] },
		});
		expect(payload["subsonic-response"].status).toBe("ok");
		expect(payload["subsonic-response"].openSubsonic).toBe(true);
	});

	it("wraps an error with code and message", () => {
		const payload = fail(40, "Wrong username or password");
		expect(payload["subsonic-response"].status).toBe("failed");
		expect(payload["subsonic-response"].error).toEqual({
			code: 40,
			message: "Wrong username or password",
		});
	});

	it("renders repeated array entries as repeated XML elements", () => {
		const payload = ok({
			artists: {
				index: [
					{
						name: "B",
						artist: [
							{ id: "ar-1", name: "Boards of Canada" },
							{ id: "ar-2", name: "Bonobo" },
						],
					},
				],
			},
		});
		const xml = toXml(payload);
		expect(xml).toContain(
			'<subsonic-response xmlns="http://subsonic.org/restapi"',
		);
		expect(xml).toContain('status="ok"');
		expect(xml.match(/<artist /g)?.length).toBe(2);
		expect(xml).toContain('id="ar-1"');
		expect(xml).toContain('id="ar-2"');
	});

	it("escapes special characters in XML attribute values", () => {
		const payload = ok({ song: { title: 'A & B "quoted" <tag>' } });
		const xml = toXml(payload);
		expect(xml).toContain("A &amp; B &quot;quoted&quot; &lt;tag&gt;");
	});
});
