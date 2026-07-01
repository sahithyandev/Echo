import { Html } from "@elysiajs/html";
import { type CookieOptions, Elysia } from "elysia";
import type { DbLike } from "../../db/types";
import { LoginPage } from "../../pages/login";
import { jwtInstance } from "../../utils/jwt";
import { unused } from "../../utils/misc";
import { getRequestInfo } from "../../utils/request-info";
import createAuthMiddleware from "./middleware";
import { AuthModel } from "./model";
import { Auth } from "./service";

unused(Html);

const SESSION_COOKIE: CookieOptions = {
	httpOnly: true,
	sameSite: "lax" as const,
	path: "/",
	maxAge: 60 * 60 * 24 * 30,
};

export default function createAuthModule(dbClient: DbLike) {
	const authMiddleware = createAuthMiddleware(dbClient);
	return new Elysia({ prefix: "/auth" })
		.decorate("db", dbClient)
		.use(jwtInstance)
		.use(authMiddleware)
		.get(
			"/login",
			async ({ currentUser, redirect, query, db }) => {
				if (currentUser) return redirect("/library");
				const usersCount = await Auth.userCount(db);

				const register = usersCount === 0;
				return <LoginPage register={register} error={!!query.error} />;
			},
			{ currentUser: true },
		)
		.get(
			"/validate",
			async ({ currentUser, sessionRevoked, db, status }) => {
				if (!currentUser) {
					if (sessionRevoked) return status(401, "SESSION_REVOKED");
					return status(401, "NOT_AUTHENTICATED");
				}
				return await Auth.findUserById(db, currentUser.id);
			},
			{
				currentUser: true,
				response: {
					200: AuthModel.validateResponse,
					401: AuthModel.ValidateErrorResponse,
				},
			},
		)
		.post(
			"/sign-up",
			async ({ body, jwt, currentUser, db, request, cookie, redirect }) => {
				if (currentUser) return redirect("/library");

				try {
					await Auth.signUp(db, body);
					const { ipAddress, userAgent } = getRequestInfo(request);
					const signInResult = await Auth.signIn(db, {
						email: body.email,
						password: body.password,
					});
					const token = await jwt.sign({
						id: signInResult.id,
						jti: crypto.randomUUID(),
					} satisfies AuthModel.JWTData & { jti: string });
					await Auth.createSession(db, {
						userId: signInResult.id,
						token,
						ipAddress,
						userAgent,
					});
					cookie.session.set({ value: token, ...SESSION_COOKIE });
					return redirect("/library");
				} catch {
					return redirect("/auth/login?error=1");
				}
			},
			{ currentUser: true, body: AuthModel.signUpBody },
		)
		.post(
			"/sign-in",
			async ({ body, jwt, currentUser, db, request, cookie, redirect }) => {
				if (currentUser) return redirect("/library");

				try {
					const { ipAddress, userAgent } = getRequestInfo(request);
					const result = await Auth.signIn(db, body);
					const token = await jwt.sign({
						id: result.id,
						jti: crypto.randomUUID(),
					} satisfies AuthModel.JWTData & { jti: string });
					await Auth.createSession(db, {
						userId: result.id,
						token,
						ipAddress,
						userAgent,
					});
					cookie.session.set({ value: token, ...SESSION_COOKIE });
					return redirect("/library");
				} catch {
					return redirect("/auth/login?error=1");
				}
			},
			{ currentUser: true, body: AuthModel.signInBody },
		)
		.post(
			"/sign-out",
			async ({ cookie, redirect }) => {
				const token = (cookie as Record<string, { value?: string }>).session
					?.value;
				if (token) await Auth.revokeSession(dbClient, token);
				cookie.session.remove();
				return redirect("/auth/login");
			},
			{ currentUser: true },
		);
}
