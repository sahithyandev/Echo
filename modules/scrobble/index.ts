import { Elysia } from "elysia";
import type { DbLike } from "../../db/types";
import { jwtInstance } from "../../utils/jwt";
import { ScrobbleModel } from "./model";
import { ScrobbleService } from "./service";

type JwtVerify = {
	verify: (token: string) => Promise<Record<string, unknown> | false>;
};

async function verifySession(
	jwt: JwtVerify,
	session: unknown,
): Promise<number | null> {
	if (typeof session !== "string" || !session) return null;
	const decoded = await jwt.verify(session);
	if (!decoded || typeof decoded.userId !== "number") return null;
	return decoded.userId;
}

/**
 * A Last.fm-compatible ingest endpoint (AudioScrobbler 1.2 submissions
 * protocol) so external scrobbler apps can submit plays directly into Echo's
 * own play_history — no outbound calls to any third-party service.
 */
export default function createScrobbleModule(db: DbLike) {
	return new Elysia()
		.use(jwtInstance)
		.get(
			"/scrobble/handshake",
			async ({ query, jwt, request }) => {
				const userId = await ScrobbleService.authenticate(
					db,
					query.u,
					query.t,
					query.a,
				);
				if (!userId) return "BADAUTH\n";
				const session = await jwt.sign({ userId });
				const origin = new URL(request.url).origin;
				return `OK\n${session}\n${origin}/scrobble/np\n${origin}/scrobble/submit\n`;
			},
			{ query: ScrobbleModel.HandshakeQuery },
		)
		.post(
			"/scrobble/np",
			async ({ body, jwt }) => {
				const userId = await verifySession(jwt, body.s);
				if (!userId) return "BADSESSION\n";
				// No now-playing state is kept for external scrobblers today — just
				// acknowledge so clients don't treat this as an error.
				return "OK\n";
			},
			{ body: ScrobbleModel.SubmissionBody },
		)
		.post(
			"/scrobble/submit",
			async ({ body, jwt }) => {
				const userId = await verifySession(jwt, body.s);
				if (!userId) return "BADSESSION\n";
				const artist = body["a[0]"];
				const title = body["t[0]"];
				const timestamp = Number(body["i[0]"]);
				if (artist && title && Number.isFinite(timestamp)) {
					await ScrobbleService.submit(db, userId, artist, title, timestamp);
				}
				return "OK\n";
			},
			{ body: ScrobbleModel.SubmissionBody },
		);
}
