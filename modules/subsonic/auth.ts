import { createHash } from "node:crypto";
import { eq, or } from "drizzle-orm";
import { users } from "../../db/schema";
import type { DbLike } from "../../db/types";
import { allowAnonymous } from "../../utils/anonymous";
import { SettingsService } from "../settings/service";
import { SubsonicError, SubsonicErrorCode } from "./respond";

/** Fixed username anonymous listeners use with the shared key from Settings > Admin. */
export const ANONYMOUS_SUBSONIC_USERNAME = "anonymous";

function md5(input: string): string {
	return createHash("md5").update(input).digest("hex");
}

function decodeLegacyPassword(p: string): string {
	return p.startsWith("enc:")
		? Buffer.from(p.slice(4), "hex").toString("utf8")
		: p;
}

function wrongCredentials(): SubsonicError {
	return new SubsonicError(
		SubsonicErrorCode.wrongCredentials,
		"Wrong username or password",
	);
}

/** Guest identity for anonymous streaming — id 0 doesn't exist in `users`, so callers must skip any write keyed on it (see scrobble). */
async function resolveAnonymousUser(
	db: DbLike,
	t: string | undefined,
	s: string | undefined,
	p: string | undefined,
) {
	if (!allowAnonymous) throw wrongCredentials();
	const password = await SettingsService.getAnonymousSubsonicPassword(db);
	if (!password) throw wrongCredentials();

	const valid =
		t && s
			? md5(password + s) === t.toLowerCase()
			: p
				? decodeLegacyPassword(p) === password
				: false;
	if (!valid) throw wrongCredentials();

	return { id: 0, name: "Guest", email: ANONYMOUS_SUBSONIC_USERNAME };
}

export class MissingCredentialsError extends SubsonicError {
	constructor() {
		super(SubsonicErrorCode.missingParam, "Required parameter is missing: u");
	}
}

function parseBasicAuth(
	header: string | null | undefined,
): { u: string; p: string } | null {
	if (!header?.startsWith("Basic ")) return null;
	const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString(
		"utf8",
	);
	const i = decoded.indexOf(":");
	if (i === -1) return null;
	return { u: decoded.slice(0, i), p: decoded.slice(i + 1) };
}

/**
 * Resolves the `u`/`t`+`s` (or legacy `p`) Subsonic auth params against the
 * dedicated `users.subsonic_password` credential. Falls back to an HTTP Basic
 * `Authorization` header — some clients (e.g. Submariner) use it for image/stream
 * requests instead of query params. Throws SubsonicError(40) on any mismatch —
 * never distinguishes "unknown user" from "wrong password".
 */
export async function resolveSubsonicUser(
	db: DbLike,
	query: Record<string, string | undefined>,
	authHeader?: string | null,
) {
	const basic = parseBasicAuth(authHeader);
	const u = query.u ?? basic?.u;
	const t = query.t;
	const s = query.s;
	const p = query.p ?? basic?.p;
	if (!u) {
		// No credentials at all (neither query params nor a Basic auth header) — some
		// clients (e.g. Submariner) rely on the OS's native HTTP auth challenge flow and
		// only attach credentials after seeing a 401 + WWW-Authenticate, so callers should
		// respond with that instead of an embedded Subsonic error for this specific case.
		throw new MissingCredentialsError();
	}

	if (u.toLowerCase().trim() === ANONYMOUS_SUBSONIC_USERNAME) {
		return resolveAnonymousUser(db, t, s, p);
	}

	const [user] = await db
		.select({
			id: users.id,
			name: users.name,
			email: users.email,
			is_active: users.is_active,
			subsonic_password: users.subsonic_password,
		})
		.from(users)
		.where(or(eq(users.email, u.toLowerCase().trim()), eq(users.name, u)))
		.limit(1);

	if (!user?.is_active || !user.subsonic_password) {
		throw wrongCredentials();
	}

	const valid =
		t && s
			? md5(user.subsonic_password + s) === t.toLowerCase()
			: p
				? decodeLegacyPassword(p) === user.subsonic_password
				: false;

	if (!valid) {
		throw wrongCredentials();
	}

	return { id: user.id, name: user.name, email: user.email };
}
