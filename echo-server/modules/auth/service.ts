import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { user_sessions, users } from "../../db/schema";
import type { AuthModel } from "./model";
import type { DbLike } from "../../db/types";

export abstract class Auth {
	static hashToken(token: string): string {
		return createHash("sha256").update(token).digest("hex");
	}

	static async createSession(
		db: DbLike,
		options: {
			userId: number;
			token: string;
			ipAddress?: string | null;
			userAgent?: string | null;
		},
	) {
		const tokenHash = Auth.hashToken(options.token);
		await db.insert(user_sessions).values({
			user_id: options.userId,
			token_hash: tokenHash,
			ip_address: options.ipAddress ?? null,
			user_agent: options.userAgent ?? null,
		});
		return tokenHash;
	}

	static async findUserById(db: DbLike, id: number) {
		const rows = await db
			.select({
				id: users.id,
				email: users.email,
				name: users.name,
				is_verified: sql<number>`(${users.verified_at} IS NOT NULL)`,
				is_admin: users.is_admin,
			})
			.from(users)
			.where(eq(users.id, id))
			.limit(1);
		if (rows.length === 0) throw new Error("User not found");
		const row = rows[0];
		return { ...row, is_verified: row.is_verified === 1 };
	}

	static async signUp(db: DbLike, body: AuthModel.signUpBody) {
		const hashedPassword = await Bun.password.hash(body.password);
		try {
			const inserted = await db
				.insert(users)
				.values({
					email: body.email.toLowerCase().trim(),
					password: hashedPassword,
					name: body.email.split("@")[0],
				})
				.returning({ id: users.id });
			if (inserted.length === 0) throw new Error("Failed to create user");
			return { id: inserted[0].id };
		} catch (error) {
			const cause = error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined;
			const causeMsg = cause instanceof Error ? cause.message : String(cause ?? "");
			if (causeMsg.includes("UNIQUE constraint failed: users.email")) {
				throw new Error(
					"This email is already registered. Please sign in instead.",
				);
			}
			throw error;
		}
	}

	static async signIn(
		db: DbLike,
		{ email, password }: AuthModel.signInBody,
	): Promise<AuthModel.signInReturn> {
		const rows = await db
			.select({
				id: users.id,
				email: users.email,
				name: users.name,
				is_verified: sql<number>`(${users.verified_at} IS NOT NULL)`,
				password: users.password,
			})
			.from(users)
			.where(eq(users.email, email.toLowerCase().trim()))
			.limit(1);

		if (rows.length === 0) throw new Error("Invalid email or password");
		const user = rows[0];

		const valid = await Bun.password.verify(password, user.password);
		if (!valid) throw new Error("Invalid email or password");

		return {
			id: user.id,
			email: user.email,
			name: user.name,
			is_verified: user.is_verified === 1,
		};
	}
}
