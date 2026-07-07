import { and, eq, isNull } from "drizzle-orm";
import { Elysia } from "elysia";
import { user_sessions } from "../../db/schema";
import type { DbLike } from "../../db/types";
import { jwtInstance } from "../../utils/jwt";
import { AuthModel } from "./model";
import { Auth } from "./service";

export default function createAuthMiddleware(dbClient: DbLike) {
	return new Elysia({ name: "auth.middleware" })
		.use(jwtInstance)
		.decorate("db", dbClient)
		.macro({
			currentUser: {
				resolve: async ({
					headers,
					cookie,
					jwt,
					db,
				}): Promise<{
					currentUser: AuthModel.JWTData | null;
					sessionRevoked: boolean;
				}> => {
					const authHeader = headers.authorization?.split(" ")[1];
					const cookieToken = (cookie as Record<string, { value?: string }>)
						.session?.value;
					const token = authHeader ?? cookieToken;
					if (!token) {
						return { currentUser: null, sessionRevoked: false };
					}

					try {
						const decoded = await jwt.verify(token);
						if (!AuthModel.isJwtData(decoded)) {
							return { currentUser: null, sessionRevoked: false };
						}

						const tokenHash = Auth.hashToken(token);
						const sessions = await db
							.select({ id: user_sessions.id })
							.from(user_sessions)
							.where(
								and(
									eq(user_sessions.token_hash, tokenHash),
									isNull(user_sessions.revoked_at),
								),
							)
							.limit(1);

						if (sessions.length === 0) {
							return { currentUser: null, sessionRevoked: true };
						}

						void db
							.update(user_sessions)
							.set({ last_active_at: new Date() })
							.where(eq(user_sessions.id, sessions[0].id))
							.catch((err) =>
								console.error("Failed to update last_active_at", err),
							);

						return { currentUser: decoded, sessionRevoked: false };
					} catch {
						return { currentUser: null, sessionRevoked: false };
					}
				},
			},
		});
}
