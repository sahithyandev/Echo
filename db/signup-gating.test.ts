import { expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { Auth } from "../modules/auth/service";
import { SettingsService } from "../modules/settings/service";
import { signup_allowed_emails } from "./schema";
import { makeTestDb } from "./test-client";

const pw = "Password1";

test("first signup becomes admin; later signups gated by mode", async () => {
	const db = makeTestDb();

	// Bootstrap: first user always allowed, is admin.
	const first = await Auth.signUp(db, { email: "admin@x.com", password: pw });
	const admin = await Auth.findUserById(db, first.id);
	expect(admin.is_admin).toBe(true);
	expect(await Auth.signupsEnabled(db)).toBe(false); // default closed after bootstrap

	// Closed: second signup rejected.
	await expect(
		Auth.signUp(db, { email: "b@x.com", password: pw }),
	).rejects.toThrow();

	// Open: anyone can sign up, not admin.
	await SettingsService.setSignupConfig(db, "open", "", first.id);
	expect(await Auth.signupsEnabled(db)).toBe(true);
	const open = await Auth.signUp(db, { email: "b@x.com", password: pw });
	expect((await Auth.findUserById(db, open.id)).is_admin).toBe(false);

	// Allowlist: only listed emails.
	await SettingsService.setSignupConfig(
		db,
		"allowlist",
		"Allowed@X.com\n\n",
		first.id,
	);
	await expect(
		Auth.signUp(db, { email: "nope@x.com", password: pw }),
	).rejects.toThrow();
	const ok = await Auth.signUp(db, { email: "allowed@x.com", password: pw });
	expect((await Auth.findUserById(db, ok.id)).is_admin).toBe(false);

	// added_by / added_at recorded on the allowlist row.
	const [row] = await db
		.select()
		.from(signup_allowed_emails)
		.where(eq(signup_allowed_emails.email, "allowed@x.com"));
	expect(row.added_by).toBe(first.id);
	const originalAddedAt = row.added_at;

	// Reconcile: keep the existing email, add a new one; existing added_at preserved.
	await new Promise((r) => setTimeout(r, 5));
	await SettingsService.setSignupConfig(
		db,
		"allowlist",
		"allowed@x.com\nsecond@x.com",
		first.id,
	);
	const all = await db.select().from(signup_allowed_emails);
	expect(all.map((r) => r.email).sort()).toEqual([
		"allowed@x.com",
		"second@x.com",
	]);
	const kept = all.find((r) => r.email === "allowed@x.com");
	expect(kept?.added_at.getTime()).toBe(originalAddedAt.getTime());

	// Switching mode without submitting emails leaves the allowlist intact.
	await SettingsService.setSignupConfig(db, "open", undefined, first.id);
	expect((await db.select().from(signup_allowed_emails)).length).toBe(2);
});
