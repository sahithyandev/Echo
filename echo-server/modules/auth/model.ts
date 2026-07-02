import { t } from "elysia";
import { TypeCompiler } from "elysia/type-system";

export namespace AuthModel {
	const Email = t.String({ format: "email" });

	export const jwtData = t.Object({ id: t.Number() });
	export type JWTData = typeof jwtData.static;
	const JWT_DATA_CHECKER = TypeCompiler.Compile(jwtData);
	export function isJwtData(obj: unknown): obj is JWTData {
		return JWT_DATA_CHECKER.Check(obj);
	}

	// min 8, requires upper + lower + digit + special
	export const PasswordPattern =
		/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,}$/;

	export const signInBody = t.Object({ email: Email, password: t.String() });
	export type signInBody = typeof signInBody.static;

	export const signUpBody = t.Object({
		email: Email,
		password: t.String({ pattern: PasswordPattern.source }),
	});
	export type signUpBody = typeof signUpBody.static;

	export const signInReturn = t.Object({
		id: t.Number(),
		email: Email,
		name: t.String(),
		is_verified: t.Boolean(),
	});
	export type signInReturn = typeof signInReturn.static;

	export const signInResponse = t.Object({
		id: t.Number(),
		email: Email,
		name: t.String(),
		token: t.String(),
	});
	export type signInResponse = typeof signInResponse.static;

	export const signUpResponse = signInResponse;
	export type signUpResponse = signInResponse;

	export const validateResponse = t.Object({
		id: t.Number(),
		name: t.String(),
		email: Email,
		is_verified: t.Boolean(),
		is_admin: t.Boolean(),
	});

	export const ValidateErrorResponse = t.Union([
		t.Literal("SESSION_REVOKED"),
		t.Literal("NOT_AUTHENTICATED"),
	]);
}
