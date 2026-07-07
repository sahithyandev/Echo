import jwt from "@elysiajs/jwt";
import { getEnvVar } from "./env";

// In production the secret must be explicitly set — no fallback, so a
// misconfigured deployment fails at boot instead of signing sessions with a
// publicly known test secret.
const JWT_SECRET =
	getEnvVar("NODE_ENV") === "production"
		? getEnvVar("ECHO_JWT_SECRET")
		: getEnvVar("ECHO_JWT_SECRET", "echo-jwt-test-secret");

export const jwtInstance = jwt({
	name: "jwt",
	secret: JWT_SECRET,
	exp: "30d",
});
