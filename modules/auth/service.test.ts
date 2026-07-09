import { beforeEach, describe, expect, it } from "bun:test";
import { app_settings, signup_allowed_emails } from "../../db/schema";
import { makeTestDb } from "../../db/test-client";
import type { DbLike } from "../../db/types";
import { Auth } from "./service";

describe("Auth.hashToken", () => {
	it("returns a deterministic sha256 hex string", () => {
		const result = Auth.hashToken("my-token");
		expect(result).toBe(Auth.hashToken("my-token"));
		expect(result).toMatch(/^[0-9a-f]{64}$/);
	});

	it("produces different hashes for different inputs", () => {
		expect(Auth.hashToken("a")).not.toBe(Auth.hashToken("b"));
	});

	it("produces known hash for known input", () => {
		// sha256("hello") is fixed
		expect(Auth.hashToken("hello")).toBe(
			"2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
		);
	});
});

let db: DbLike;

beforeEach(() => {
	db = makeTestDb();
});

describe("Auth.signUp / signIn", () => {
	it("creates the first user as admin", async () => {
		const { id } = await Auth.signUp(db, {
			email: "First@Example.com",
			password: "Passw0rd!",
		});
		const user = await Auth.findUserById(db, id);
		expect(user.email).toBe("first@example.com");
		expect(user.is_admin).toBe(true);
		expect(user.name).toBe("First");
	});

	it("signs in with correct credentials", async () => {
		await Auth.signUp(db, { email: "a@b.com", password: "Passw0rd!" });
		const result = await Auth.signIn(db, {
			email: "a@b.com",
			password: "Passw0rd!",
		});
		expect(result.email).toBe("a@b.com");
	});

	it("rejects sign-in with wrong password", async () => {
		await Auth.signUp(db, { email: "a@b.com", password: "Passw0rd!" });
		expect(
			Auth.signIn(db, { email: "a@b.com", password: "WrongPass1!" }),
		).rejects.toThrow("Invalid email or password");
	});

	it("rejects sign-in for unknown email", async () => {
		expect(
			Auth.signIn(db, { email: "nobody@b.com", password: "Passw0rd!" }),
		).rejects.toThrow("Invalid email or password");
	});

	it("rejects sign-in for inactive user", async () => {
		const { id } = await Auth.signUp(db, {
			email: "a@b.com",
			password: "Passw0rd!",
		});
		await Auth.setActive(db, id, false);
		expect(
			Auth.signIn(db, { email: "a@b.com", password: "Passw0rd!" }),
		).rejects.toThrow("Invalid email or password");
	});

	it("blocks signup when registration is closed", async () => {
		await Auth.signUp(db, { email: "first@b.com", password: "Passw0rd!" });
		await db
			.insert(app_settings)
			.values({ id: 1, signup_mode: "closed" })
			.onConflictDoUpdate({
				target: app_settings.id,
				set: { signup_mode: "closed" },
			});
		expect(
			Auth.signUp(db, { email: "second@b.com", password: "Passw0rd!" }),
		).rejects.toThrow("Registration is closed");
	});

	it("allows signup for allowlisted email when mode is allowlist", async () => {
		await Auth.signUp(db, { email: "first@b.com", password: "Passw0rd!" });
		await db
			.insert(app_settings)
			.values({ id: 1, signup_mode: "allowlist" })
			.onConflictDoUpdate({
				target: app_settings.id,
				set: { signup_mode: "allowlist" },
			});
		await db.insert(signup_allowed_emails).values({ email: "second@b.com" });
		const { id } = await Auth.signUp(db, {
			email: "second@b.com",
			password: "Passw0rd!",
		});
		expect(id).toBeGreaterThan(0);
	});

	it("blocks signup for non-allowlisted email when mode is allowlist", async () => {
		await Auth.signUp(db, { email: "first@b.com", password: "Passw0rd!" });
		await db
			.insert(app_settings)
			.values({ id: 1, signup_mode: "allowlist" })
			.onConflictDoUpdate({
				target: app_settings.id,
				set: { signup_mode: "allowlist" },
			});
		expect(
			Auth.signUp(db, { email: "other@b.com", password: "Passw0rd!" }),
		).rejects.toThrow("Registration is closed");
	});
});

describe("Auth.signupsEnabled", () => {
	it("is true when there are no users yet", async () => {
		expect(await Auth.signupsEnabled(db)).toBe(true);
	});

	it("is false when closed after the first user", async () => {
		await Auth.signUp(db, { email: "first@b.com", password: "Passw0rd!" });
		await db
			.insert(app_settings)
			.values({ id: 1, signup_mode: "closed" })
			.onConflictDoUpdate({
				target: app_settings.id,
				set: { signup_mode: "closed" },
			});
		expect(await Auth.signupsEnabled(db)).toBe(false);
	});
});

describe("Auth sessions", () => {
	it("creates, lists, and revokes a session", async () => {
		const { id: userId } = await Auth.signUp(db, {
			email: "a@b.com",
			password: "Passw0rd!",
		});
		const tokenHash = await Auth.createSession(db, {
			userId,
			token: "tok1",
			ipAddress: "127.0.0.1",
			userAgent: "test-agent",
		});
		expect(tokenHash).toBe(Auth.hashToken("tok1"));

		const sessions = await Auth.listUserSessions(db, userId);
		expect(sessions).toHaveLength(1);

		await Auth.revokeSessionById(db, userId, sessions[0].id);
		expect(await Auth.listUserSessions(db, userId)).toHaveLength(0);
	});

	it("revokes a session by token", async () => {
		const { id: userId } = await Auth.signUp(db, {
			email: "a@b.com",
			password: "Passw0rd!",
		});
		await Auth.createSession(db, { userId, token: "tok1" });
		await Auth.revokeSession(db, "tok1");
		expect(await Auth.listUserSessions(db, userId)).toHaveLength(0);
	});

	it("revokes all other sessions but keeps the current one", async () => {
		const { id: userId } = await Auth.signUp(db, {
			email: "a@b.com",
			password: "Passw0rd!",
		});
		const keep = await Auth.createSession(db, { userId, token: "keep" });
		await Auth.createSession(db, { userId, token: "other" });
		await Auth.revokeOtherSessions(db, userId, keep);
		const sessions = await Auth.listUserSessions(db, userId);
		expect(sessions).toHaveLength(1);
	});

	it("revoking a user (setActive false) revokes their sessions", async () => {
		const { id: userId } = await Auth.signUp(db, {
			email: "a@b.com",
			password: "Passw0rd!",
		});
		await Auth.createSession(db, { userId, token: "tok1" });
		await Auth.setActive(db, userId, false);
		expect(await Auth.listUserSessions(db, userId)).toHaveLength(0);
	});
});

describe("Auth user management", () => {
	it("updates name and password, verifies password", async () => {
		const { id } = await Auth.signUp(db, {
			email: "a@b.com",
			password: "Passw0rd!",
		});
		await Auth.updateName(db, id, "New Name");
		const user = await Auth.findUserById(db, id);
		expect(user.name).toBe("New Name");

		expect(await Auth.verifyPassword(db, id, "Passw0rd!")).toBe(true);
		expect(await Auth.verifyPassword(db, id, "Wrong!")).toBe(false);

		const newHash = await Bun.password.hash("NewPassw0rd!");
		await Auth.updatePassword(db, id, newHash);
		expect(await Auth.verifyPassword(db, id, "NewPassw0rd!")).toBe(true);
	});

	it("returns false verifying password for unknown user", async () => {
		expect(await Auth.verifyPassword(db, 9999, "whatever")).toBe(false);
	});

	it("sets admin and lists users", async () => {
		await Auth.signUp(db, {
			email: "admin@b.com",
			password: "Passw0rd!",
		});
		await db
			.insert(app_settings)
			.values({ id: 1, signup_mode: "open" })
			.onConflictDoUpdate({
				target: app_settings.id,
				set: { signup_mode: "open" },
			});
		const { id: userId } = await Auth.signUp(db, {
			email: "user@b.com",
			password: "Passw0rd!",
		});
		expect(await Auth.activeAdminCount(db)).toBe(1);

		await Auth.setAdmin(db, userId, true);
		expect(await Auth.activeAdminCount(db)).toBe(2);

		const users = await Auth.listUsers(db);
		expect(users.map((u) => u.email).sort()).toEqual([
			"admin@b.com",
			"user@b.com",
		]);
	});

	it("throws for unknown user id", async () => {
		expect(Auth.findUserById(db, 9999)).rejects.toThrow("User not found");
	});
});

describe("Auth.userCount", () => {
	it("counts users", async () => {
		expect(await Auth.userCount(db)).toBe(0);
		await Auth.signUp(db, { email: "a@b.com", password: "Passw0rd!" });
		expect(await Auth.userCount(db)).toBe(1);
	});
});
