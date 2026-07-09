import { describe, expect, it } from "bun:test";
import { fail, ok, serialize, toXml } from "./respond";

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

describe("serialize", () => {
	it("defaults to XML when no format is given", async () => {
		const res = serialize(ok({}), undefined, undefined);
		expect(res.headers.get("Content-Type")).toBe("application/xml");
		expect(await res.text()).toContain("<subsonic-response");
	});

	it("serializes as JSON when f=json", async () => {
		const res = serialize(ok({ ping: true }), "json", undefined);
		expect(res.headers.get("Content-Type")).toBe("application/json");
		const body = await res.json();
		expect(body["subsonic-response"].ping).toBe(true);
	});

	it("serializes as JSONP wrapped in the callback name", async () => {
		const res = serialize(ok({}), "jsonp", "myCallback");
		expect(res.headers.get("Content-Type")).toBe("application/javascript");
		const text = await res.text();
		expect(text.startsWith("myCallback(")).toBe(true);
	});

	it("defaults the JSONP callback name when none is given", async () => {
		const res = serialize(ok({}), "jsonp", undefined);
		const text = await res.text();
		expect(text.startsWith("callback(")).toBe(true);
	});
});
