import { beforeEach, describe, expect, it } from "bun:test";
import {
	listening,
	play_history,
	signup_allowed_emails,
	tracks,
	users,
} from "../../db/schema";
import { makeTestDb } from "../../db/test-client";
import type { DbLike } from "../../db/types";
import { SettingsService } from "./service";

let db: DbLike;

async function makeUser(client: DbLike, email = "a@b.com") {
	const [user] = await client
		.insert(users)
		.values({
			email,
			password: "hash",
			name: "A",
			subsonic_password: `key-${email}`,
		})
		.returning({ id: users.id });
	return user;
}

async function makeTrack(client: DbLike, durationSeconds = 200) {
	const [track] = await client
		.insert(tracks)
		.values({
			title: "Track One",
			track_number: 1,
			duration_seconds: durationSeconds,
			file_path: `/music/${crypto.randomUUID()}.mp3`,
		})
		.returning({ id: tracks.id });
	return track;
}

beforeEach(() => {
	db = makeTestDb();
});

describe("SettingsService.getDirs / setDirs", () => {
	it("stores and retrieves music/data dirs", async () => {
		await SettingsService.setDirs(db, "/music", "/data");
		const dirs = await SettingsService.getDirs(db);
		expect(dirs).toEqual({ musicDir: "/music", dataDir: "/data" });
	});
});

describe("SettingsService.setSignupConfig", () => {
	it("sets signup mode and replaces the allowlist", async () => {
		const admin = await makeUser(db, "admin@b.com");
		await SettingsService.setSignupConfig(
			db,
			"allowlist",
			"a@b.com\nb@b.com\n",
			admin.id,
		);
		const rows = await db.select().from(signup_allowed_emails);
		expect(rows.map((r) => r.email).sort()).toEqual(["a@b.com", "b@b.com"]);
	});

	it("leaves the allowlist untouched when emails is undefined", async () => {
		const admin = await makeUser(db, "admin@b.com");
		await SettingsService.setSignupConfig(db, "allowlist", "a@b.com", admin.id);
		await SettingsService.setSignupConfig(db, "allowlist", undefined, admin.id);
		const rows = await db.select().from(signup_allowed_emails);
		expect(rows.map((r) => r.email)).toEqual(["a@b.com"]);
	});

	it("clears the allowlist when emails is empty", async () => {
		const admin = await makeUser(db, "admin@b.com");
		await SettingsService.setSignupConfig(db, "allowlist", "a@b.com", admin.id);
		await SettingsService.setSignupConfig(db, "allowlist", "", admin.id);
		const rows = await db.select().from(signup_allowed_emails);
		expect(rows).toHaveLength(0);
	});
});

describe("SettingsService.getStats", () => {
	it("counts tracks, albums, artists, users", async () => {
		await makeUser(db);
		const stats = await SettingsService.getStats(db);
		expect(stats).toEqual({ tracks: 0, albums: 0, artists: 0, users: 1 });
	});
});

describe("SettingsService.getSettings / updateSettings", () => {
	it("returns defaults with no playback state", async () => {
		const user = await makeUser(db);
		const settings = await SettingsService.getSettings(db, user.id);
		expect(settings.playback_track_id).toBeNull();
		expect(settings.playback_playing).toBe(false);
	});

	it("updates shuffle/repeat settings", async () => {
		const user = await makeUser(db);
		await SettingsService.updateSettings(db, user.id, {
			shuffle: true,
			repeat_mode: "all",
		});
		const settings = await SettingsService.getSettings(db, user.id);
		expect(settings.shuffle).toBe(true);
		expect(settings.repeat_mode).toBe("all");
	});
});

describe("SettingsService.recordHistory", () => {
	it("inserts a play history row", async () => {
		const user = await makeUser(db);
		const track = await makeTrack(db);
		await SettingsService.recordHistory(db, user.id, track.id);
		const rows = await db.select().from(play_history);
		expect(rows).toHaveLength(1);
	});
});

describe("SettingsService subsonic password", () => {
	it("gets and sets a user's subsonic password", async () => {
		const user = await makeUser(db);
		await SettingsService.setSubsonicPassword(db, user.id, "newkey");
		expect(await SettingsService.getSubsonicPassword(db, user.id)).toBe(
			"newkey",
		);
	});

	it("returns null for unknown user", async () => {
		expect(await SettingsService.getSubsonicPassword(db, 9999)).toBeNull();
	});
});

describe("SettingsService.syncPlayback", () => {
	it("upserts playback state position/playing", async () => {
		const user = await makeUser(db);
		const track = await makeTrack(db);
		await SettingsService.syncPlayback(db, user.id, {
			track_id: track.id,
			position_seconds: 42,
			playing: true,
			seconds: 0,
		});
		const settings = await SettingsService.getSettings(db, user.id);
		expect(settings.playback_position_seconds).toBe(42);
		expect(settings.playback_playing).toBe(true);
	});

	it("accumulates listening seconds for the same day/track", async () => {
		const user = await makeUser(db);
		const track = await makeTrack(db);
		await SettingsService.syncPlayback(db, user.id, {
			track_id: track.id,
			seconds: 30,
		});
		await SettingsService.syncPlayback(db, user.id, {
			track_id: track.id,
			seconds: 20,
		});
		const rows = await db.select().from(listening);
		expect(rows).toHaveLength(1);
		expect(rows[0].seconds).toBe(50);
	});

	it("does nothing when seconds is 0 and no position/playing given", async () => {
		const user = await makeUser(db);
		const track = await makeTrack(db);
		await SettingsService.syncPlayback(db, user.id, {
			track_id: track.id,
			seconds: 0,
		});
		expect(await db.select().from(listening)).toHaveLength(0);
	});
});

describe("SettingsService.scrobbleSubmission", () => {
	it("records history and full-duration listening time", async () => {
		const user = await makeUser(db);
		const track = await makeTrack(db, 180);
		await SettingsService.scrobbleSubmission(db, user.id, track.id);
		expect(await db.select().from(play_history)).toHaveLength(1);
		const rows = await db.select().from(listening);
		expect(rows).toHaveLength(1);
		expect(rows[0].seconds).toBe(180);
	});
});
