import { Elysia } from "elysia";
import type { DbLike } from "../../db/types";
import { buildRangeResponse, LibraryService } from "../library/service";
import { SettingsService } from "../settings/service";
import { MissingCredentialsError, resolveSubsonicUser } from "./auth";
import { subsonicHandlers } from "./handlers";
import { parseId } from "./ids";
import { fail, SubsonicError, SubsonicErrorCode, serialize } from "./respond";

type Query = Record<string, string | undefined>;

/** Strips a trailing ".view" — Subsonic clients call both `/rest/ping` and `/rest/ping.view`. */
function stripView(method: string): string {
	return method.endsWith(".view") ? method.slice(0, -".view".length) : method;
}

/**
 * Some clients (e.g. Submariner) rely on the OS's native HTTP Basic auth challenge
 * flow: they send the first request with no credentials, expect a 401 +
 * WWW-Authenticate to trigger the OS auth prompt/keychain retry, and only then
 * attach credentials. Returning our normal embedded-error response never triggers
 * that retry, so this case needs a real 401 challenge instead.
 */
function authChallenge(): Response {
	return new Response("Unauthorized", {
		status: 401,
		headers: { "WWW-Authenticate": 'Basic realm="Echo"' },
	});
}

/** Some clients (e.g. Amperfy, Castafiore) POST params as a form body instead of a query string. */
function mergedQuery(ctx: { query: Query; body: unknown }): Query {
	if (!ctx.body || typeof ctx.body !== "object") return ctx.query;
	return { ...(ctx.body as Query), ...ctx.query };
}

async function dispatch(
	db: DbLike,
	ctx: {
		params: { method: string };
		query: Query;
		body: unknown;
		request: Request;
	},
) {
	const method = stripView(ctx.params.method);
	const q = mergedQuery(ctx);
	try {
		const user = await resolveSubsonicUser(
			db,
			q,
			ctx.request.headers.get("Authorization"),
		);
		const handler = subsonicHandlers[method];
		if (!handler) {
			return serialize(
				fail(SubsonicErrorCode.generic, `Unknown method: ${method}`),
				q.f,
				q.callback,
			);
		}
		const payload = await handler(db, user, q);
		return serialize(payload, q.f, q.callback);
	} catch (err) {
		if (err instanceof MissingCredentialsError) return authChallenge();
		if (err instanceof SubsonicError) {
			console.warn(
				`[subsonic] ${method} failed: ${err.message} (params: ${Object.keys(q).join(",")}, auth header: ${ctx.request.headers.has("Authorization")})`,
			);
			return serialize(fail(err.code, err.message), q.f, q.callback);
		}
		console.warn(`[subsonic] ${method} failed:`, err);
		return serialize(
			fail(SubsonicErrorCode.generic, "Internal error"),
			q.f,
			q.callback,
		);
	}
}

export default function createSubsonicModule(db: DbLike) {
	return (
		new Elysia()
			.get("/rest/stream", (ctx) => streamHandler(db, ctx))
			.get("/rest/stream.view", (ctx) => streamHandler(db, ctx))
			.get("/rest/download", (ctx) => streamHandler(db, ctx))
			.get("/rest/download.view", (ctx) => streamHandler(db, ctx))
			.get("/rest/getCoverArt", (ctx) => coverArtHandler(db, ctx))
			.get("/rest/getCoverArt.view", (ctx) => coverArtHandler(db, ctx))
			// Registered as GET/POST (not `.all`) so these compete on route specificity with
			// the static plugin's catch-all `GET /*`, which otherwise wins over an ALL-bucket route.
			.get("/rest/:method", (ctx) => dispatch(db, ctx))
			.post("/rest/:method", (ctx) => dispatch(db, ctx))
	);
}

async function streamHandler(
	db: DbLike,
	ctx: { query: Query; request: Request },
): Promise<Response> {
	try {
		await resolveSubsonicUser(
			db,
			ctx.query,
			ctx.request.headers.get("Authorization"),
		);
	} catch (err) {
		if (err instanceof MissingCredentialsError) return authChallenge();
		console.warn(
			`[subsonic] stream auth failed: ${err instanceof Error ? err.message : err} (params: ${Object.keys(ctx.query).join(",")})`,
		);
		return new Response("Forbidden", { status: 403 });
	}
	const parsed = parseId(ctx.query.id);
	if (parsed?.type !== "tr") return new Response("Not found", { status: 404 });

	const track = await LibraryService.findTrackById(db, parsed.id);
	if (!track) return new Response("Not found", { status: 404 });
	const file = Bun.file(track.file_path);
	if (!(await file.exists())) return new Response("Not found", { status: 404 });

	return buildRangeResponse(file, ctx.request.headers.get("Range"));
}

async function coverArtHandler(
	db: DbLike,
	ctx: { query: Query; request: Request },
): Promise<Response> {
	try {
		await resolveSubsonicUser(
			db,
			ctx.query,
			ctx.request.headers.get("Authorization"),
		);
	} catch (err) {
		if (err instanceof MissingCredentialsError) return authChallenge();
		console.warn(
			`[subsonic] getCoverArt auth failed: ${err instanceof Error ? err.message : err} (params: ${Object.keys(ctx.query).join(",")})`,
		);
		return new Response("Forbidden", { status: 403 });
	}
	const parsed = parseId(ctx.query.id);
	if (parsed?.type !== "al") return new Response("Not found", { status: 404 });

	const { dataDir } = await SettingsService.getDirs(db);
	const file = Bun.file(`${dataDir}/art/${parsed.id}.jpg`);
	if (await file.exists()) {
		return new Response(file, { headers: { "Content-Type": "image/jpeg" } });
	}

	// Some Subsonic clients (e.g. Submariner) don't handle a non-image response to
	// getCoverArt gracefully, so fall back to a placeholder image instead of a 404.
	const placeholder = Bun.file(
		`${import.meta.dir}/../../public/no-album-art.png`,
	);
	return new Response(placeholder, {
		headers: { "Content-Type": "image/png" },
	});
}
