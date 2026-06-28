import { Elysia } from "elysia";
import type { client } from "../../db/client";
import { jwtInstance } from "../../utils/jwt";
import { getRequestInfo } from "../../utils/request-info";
import createAuthMiddleware from "./middleware";
import { AuthModel } from "./model";
import { Auth } from "./service";
import type { DbLike } from "../../db/types";

export default function createAuthModule(dbClient: DbLike) {
	const authMiddleware = createAuthMiddleware(dbClient);
	return new Elysia({ prefix: "/auth" })
		.decorate("db", dbClient)
		.use(jwtInstance)
		.use(authMiddleware)
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
			async ({ body, jwt, currentUser, status, db, request }) => {
				if (currentUser) throw new Error("You are already signed in");

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

				return status(200, {
					id: signInResult.id,
					email: signInResult.email,
					name: signInResult.name,
					token,
				});
			},
			{
				currentUser: true,
				body: AuthModel.signUpBody,
				parse: "application/json",
				response: { 200: AuthModel.signUpResponse },
			},
		)
		.post(
			"/sign-in",
			async ({ body, jwt, currentUser, status, db, request }) => {
				if (currentUser) throw new Error("You are already signed in");

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

				return status(200, {
					id: result.id,
					email: result.email,
					name: result.name,
					token,
				});
			},
			{
				currentUser: true,
				body: AuthModel.signInBody,
				parse: "application/json",
				response: { 200: AuthModel.signInResponse },
			},
		);
}
