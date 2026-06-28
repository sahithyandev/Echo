import jwt from "@elysiajs/jwt";
import { getEnvVar } from "./env";

const JWT_SECRET = getEnvVar("JWT_SECRET", "echo-jwt-test-secret");

export const jwtInstance = jwt({
	name: "jwt",
	secret: JWT_SECRET,
	exp: "30d",
});
