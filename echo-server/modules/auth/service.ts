import { createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { user_sessions, users } from "../../db/schema";
import type { DbLike } from "../../db/types";
import type { AuthModel } from "./model";

export abstract class Auth {
	static hashToken(token: string): string {
		return createHash("sha256").update(token).digest("hex");
	}

	static async userCount(db: DbLike): Promise<number> {
		const rows = await db.select({ count: sql<number>`count(*)` }).from(users);
		return rows[0].count;
	}

	static async revokeSession(db: DbLike, token: string) {
		const tokenHash = Auth.hashToken(token);
		await db
			.update(user_sessions)
			.set({ revoked_at: new Date() })
			.where(
				and(
					eq(user_sessions.token_hash, tokenHash),
					isNull(user_sessions.revoked_at),
				),
			);
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
		const count = await Auth.userCount(db);
		if (count > 0) throw new Error("Registration is closed");

		const hashedPassword = await Bun.password.hash(body.password);
		const inserted = await db
			.insert(users)
			.values({
				email: body.email.toLowerCase().trim(),
				password: hashedPassword,
				name: body.email.split("@")[0],
				is_admin: true,
			})
			.returning({ id: users.id });
		if (inserted.length === 0) throw new Error("Failed to create user");
		return { id: inserted[0].id };
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
