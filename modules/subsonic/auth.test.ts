import { beforeEach, describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { users } from "../../db/schema";
import { makeTestDb } from "../../db/test-client";
import type { DbLike } from "../../db/types";
import { MissingCredentialsError, resolveSubsonicUser } from "./auth";
import { SubsonicError, SubsonicErrorCode } from "./respond";

let db: DbLike;

async function seedUser(overrides: Partial<typeof users.$inferInsert> = {}) {
	const [user] = await db
		.insert(users)
		.values({
			name: "alice",
			email: "alice@example.com",
			password: "irrelevant",
			subsonic_password: "sesame",
			...overrides,
		})
		.returning({ id: users.id });
	return user;
}

function md5(input: string): string {
	return createHash("md5").update(input).digest("hex");
}

beforeEach(() => {
	db = makeTestDb();
});

describe("resolveSubsonicUser", () => {
	it("throws MissingCredentialsError when there is no u and no Basic auth header", async () => {
		await expect(resolveSubsonicUser(db, {})).rejects.toBeInstanceOf(
			MissingCredentialsError,
		);
	});

	it("authenticates with the legacy plaintext p param", async () => {
		await seedUser();
		const user = await resolveSubsonicUser(db, {
			u: "alice",
			p: "sesame",
		});
		expect(user).toEqual({ id: 1, name: "alice", email: "alice@example.com" });
	});

	it("authenticates with the legacy enc: hex-encoded p param", async () => {
		await seedUser();
		const encoded = `enc:${Buffer.from("sesame", "utf8").toString("hex")}`;
		const user = await resolveSubsonicUser(db, { u: "alice", p: encoded });
		expect(user.name).toBe("alice");
	});

	it("authenticates with the t/s token scheme", async () => {
		await seedUser();
		const salt = "abc123";
		const token = md5(`sesame${salt}`);
		const user = await resolveSubsonicUser(db, {
			u: "alice",
			t: token,
			s: salt,
		});
		expect(user.name).toBe("alice");
	});

	it("matches token case-insensitively", async () => {
		await seedUser();
		const salt = "abc123";
		const token = md5(`sesame${salt}`).toUpperCase();
		const user = await resolveSubsonicUser(db, {
			u: "alice",
			t: token,
			s: salt,
		});
		expect(user.name).toBe("alice");
	});

	it("resolves the user by email as well as name", async () => {
		await seedUser();
		const user = await resolveSubsonicUser(db, {
			u: "ALICE@example.com",
			p: "sesame",
		});
		expect(user.name).toBe("alice");
	});

	it("falls back to a Basic auth header when query params are absent", async () => {
		await seedUser();
		const header = `Basic ${Buffer.from("alice:sesame").toString("base64")}`;
		const user = await resolveSubsonicUser(db, {}, header);
		expect(user.name).toBe("alice");
	});

	it("throws wrongCredentials for a bad password", async () => {
		await seedUser();
		await expect(
			resolveSubsonicUser(db, { u: "alice", p: "wrong" }),
		).rejects.toMatchObject({ code: SubsonicErrorCode.wrongCredentials });
	});

	it("throws wrongCredentials for an unknown user", async () => {
		await expect(
			resolveSubsonicUser(db, { u: "nobody", p: "sesame" }),
		).rejects.toBeInstanceOf(SubsonicError);
	});

	it("throws wrongCredentials for an inactive user", async () => {
		await seedUser({ is_active: false });
		await expect(
			resolveSubsonicUser(db, { u: "alice", p: "sesame" }),
		).rejects.toMatchObject({ code: SubsonicErrorCode.wrongCredentials });
	});

	it("throws wrongCredentials when the user has no subsonic_password set", async () => {
		await seedUser({ subsonic_password: null });
		await expect(
			resolveSubsonicUser(db, { u: "alice", p: "sesame" }),
		).rejects.toMatchObject({ code: SubsonicErrorCode.wrongCredentials });
	});

	it("throws wrongCredentials when neither p nor t/s are provided", async () => {
		await seedUser();
		await expect(resolveSubsonicUser(db, { u: "alice" })).rejects.toMatchObject(
			{ code: SubsonicErrorCode.wrongCredentials },
		);
	});
});
