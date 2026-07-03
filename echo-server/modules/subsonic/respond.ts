const SUBSONIC_API_VERSION = "1.16.1";
const SERVER_VERSION = "0.1.0";

export const SubsonicErrorCode = {
	generic: 0,
	missingParam: 10,
	clientTooOld: 20,
	serverTooOld: 30,
	wrongCredentials: 40,
	tokenAuthNotSupported: 41,
	notAuthorized: 50,
	notFound: 70,
} as const;

export class SubsonicError extends Error {
	constructor(
		public code: number,
		message: string,
	) {
		super(message);
	}
}

type SubsonicNode =
	| string
	| number
	| boolean
	| null
	| undefined
	| SubsonicNode[]
	| { [key: string]: SubsonicNode };

function baseAttrs(ok: boolean) {
	return {
		status: ok ? "ok" : "failed",
		version: SUBSONIC_API_VERSION,
		type: "echo",
		serverVersion: SERVER_VERSION,
		openSubsonic: true,
	};
}

/** Wraps a payload (e.g. `{ artists: {...} }`) in the standard success envelope. */
export function ok(payload: Record<string, unknown> = {}) {
	return {
		"subsonic-response": { ...baseAttrs(true), ...payload } as Record<
			string,
			SubsonicNode
		>,
	};
}

export function fail(code: number, message: string) {
	return {
		"subsonic-response": { ...baseAttrs(false), error: { code, message } },
	};
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

/** Scalars become XML attributes, objects/arrays become child elements — the Subsonic XML convention. */
function renderElement(tag: string, node: SubsonicNode): string {
	if (node === null || node === undefined) return "";
	if (Array.isArray(node)) {
		return node.map((item) => renderElement(tag, item)).join("");
	}
	if (typeof node !== "object") {
		return `<${tag}>${escapeXml(String(node))}</${tag}>`;
	}

	const attrs: string[] = [];
	const children: string[] = [];
	for (const [key, value] of Object.entries(node)) {
		if (value === null || value === undefined) continue;
		if (typeof value === "object") {
			children.push(renderElement(key, value));
		} else {
			attrs.push(`${key}="${escapeXml(String(value))}"`);
		}
	}
	const attrStr = attrs.length ? ` ${attrs.join(" ")}` : "";
	return children.length
		? `<${tag}${attrStr}>${children.join("")}</${tag}>`
		: `<${tag}${attrStr}/>`;
}

export function toXml(
	payload: ReturnType<typeof ok> | ReturnType<typeof fail>,
): string {
	const root = renderElement(
		"subsonic-response",
		payload["subsonic-response"],
	).replace(
		"<subsonic-response",
		'<subsonic-response xmlns="http://subsonic.org/restapi"',
	);
	return `<?xml version="1.0" encoding="UTF-8"?>\n${root}`;
}

/** Serializes a response envelope per the client-requested `f` (json/jsonp/xml, default xml). */
export function serialize(
	payload: ReturnType<typeof ok> | ReturnType<typeof fail>,
	format: string | undefined,
	callback: string | undefined,
): Response {
	if (format === "json") {
		return new Response(JSON.stringify(payload), {
			headers: { "Content-Type": "application/json" },
		});
	}
	if (format === "jsonp") {
		return new Response(
			`${callback ?? "callback"}(${JSON.stringify(payload)})`,
			{
				headers: { "Content-Type": "application/javascript" },
			},
		);
	}
	return new Response(toXml(payload), {
		headers: { "Content-Type": "application/xml" },
	});
}
