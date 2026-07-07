import { createHash } from "node:crypto";
import { and, count, eq, isNull, ne, sql } from "drizzle-orm";
import { user_sessions, users } from "../../db/schema";
import type { DbLike } from "../../db/types";
import type { AuthModel } from "./model";

function generateStreamingKey(): string {
	return crypto.randomUUID().replace(/-/g, "");
}

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

	static async verifyPassword(
		db: DbLike,
		id: number,
		password: string,
	): Promise<boolean> {
		const rows = await db
			.select({ password: users.password })
			.from(users)
			.where(eq(users.id, id))
			.limit(1);
		if (rows.length === 0) return false;
		return Bun.password.verify(password, rows[0].password);
	}

	static async updateName(db: DbLike, id: number, name: string) {
		await db.update(users).set({ name }).where(eq(users.id, id));
	}

	static async updatePassword(db: DbLike, id: number, passwordHash: string) {
		await db
			.update(users)
			.set({ password: passwordHash })
			.where(eq(users.id, id));
	}

	static async createUser(
		db: DbLike,
		options: {
			email: string;
			name: string;
			password: string;
			isAdmin: boolean;
		},
	) {
		const hashedPassword = await Bun.password.hash(options.password);
		const inserted = await db
			.insert(users)
			.values({
				email: options.email.toLowerCase().trim(),
				password: hashedPassword,
				name: options.name,
				is_admin: options.isAdmin,
				subsonic_password: generateStreamingKey(),
			})
			.returning({ id: users.id });
		if (inserted.length === 0) throw new Error("Failed to create user");
		return { id: inserted[0].id };
	}

	static async setAdmin(db: DbLike, id: number, isAdmin: boolean) {
		await db.update(users).set({ is_admin: isAdmin }).where(eq(users.id, id));
	}

	static async setActive(db: DbLike, id: number, isActive: boolean) {
		await db.update(users).set({ is_active: isActive }).where(eq(users.id, id));
		if (!isActive) {
			await db
				.update(user_sessions)
				.set({ revoked_at: new Date() })
				.where(
					and(eq(user_sessions.user_id, id), isNull(user_sessions.revoked_at)),
				);
		}
	}

	static async activeAdminCount(db: DbLike): Promise<number> {
		const rows = await db
			.select({ count: count() })
			.from(users)
			.where(and(eq(users.is_admin, true), eq(users.is_active, true)));
		return rows[0].count;
	}

	static async listUsers(db: DbLike) {
		return db
			.select({
				id: users.id,
				name: users.name,
				email: users.email,
				is_admin: users.is_admin,
				is_active: users.is_active,
			})
			.from(users)
			.orderBy(users.id);
	}

	static async listUserSessions(db: DbLike, userId: number) {
		return db
			.select({
				id: user_sessions.id,
				token_hash: user_sessions.token_hash,
				ip_address: user_sessions.ip_address,
				user_agent: user_sessions.user_agent,
				created_at: user_sessions.created_at,
				last_active_at: user_sessions.last_active_at,
			})
			.from(user_sessions)
			.where(
				and(
					eq(user_sessions.user_id, userId),
					isNull(user_sessions.revoked_at),
				),
			)
			.orderBy(user_sessions.last_active_at);
	}

	static async revokeSessionById(
		db: DbLike,
		userId: number,
		sessionId: number,
	) {
		await db
			.update(user_sessions)
			.set({ revoked_at: new Date() })
			.where(
				and(eq(user_sessions.id, sessionId), eq(user_sessions.user_id, userId)),
			);
	}

	static async revokeOtherSessions(
		db: DbLike,
		userId: number,
		keepTokenHash: string,
	) {
		await db
			.update(user_sessions)
			.set({ revoked_at: new Date() })
			.where(
				and(
					eq(user_sessions.user_id, userId),
					ne(user_sessions.token_hash, keepTokenHash),
					isNull(user_sessions.revoked_at),
				),
			);
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
				subsonic_password: generateStreamingKey(),
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
				is_active: users.is_active,
			})
			.from(users)
			.where(eq(users.email, email.toLowerCase().trim()))
			.limit(1);

		if (rows.length === 0) throw new Error("Invalid email or password");
		const user = rows[0];

		const valid = await Bun.password.verify(password, user.password);
		if (!valid) throw new Error("Invalid email or password");
		if (!user.is_active) throw new Error("Invalid email or password");

		return {
			id: user.id,
			email: user.email,
			name: user.name,
			is_verified: user.is_verified === 1,
		};
	}
}
