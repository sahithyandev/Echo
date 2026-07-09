import { beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { eq } from "drizzle-orm";
import {
	albums,
	artists,
	play_history,
	track_artists,
	tracks,
	user_playback_state,
	users,
} from "../../db/schema";
import { makeTestDb } from "../../db/test-client";
import type { DbLike } from "../../db/types";
import { buildRangeResponse, LibraryService } from "./service";

let db: DbLike;

async function makeFixtureMp3(
	dir: string,
	name: string,
	tags: Record<string, string> = {
		title: "Fixture Song",
		artist: "Fixture Artist",
		album: "Fixture Album",
		date: "2020",
		track: "3",
		genre: "Test",
	},
): Promise<string> {
	const path = `${dir}/${name}`;
	const metadataArgs = Object.entries(tags).flatMap(([k, v]) => [
		"-metadata",
		`${k}=${v}`,
	]);
	await Bun.$`ffmpeg -y -f lavfi -i sine=frequency=440:duration=5 ${metadataArgs} ${path}`.quiet();
	return path;
}

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

async function seed(client: DbLike) {
	const [artistA] = await client
		.insert(artists)
		.values({ name: "Artist A" })
		.returning({ id: artists.id });
	const [artistB] = await client
		.insert(artists)
		.values({ name: "Artist B" })
		.returning({ id: artists.id });
	const [album] = await client
		.insert(albums)
		.values({ title: "Album One", year: 2021, genre: "Jazz" })
		.returning({ id: albums.id });

	const [t1] = await client
		.insert(tracks)
		.values({
			title: "Alpha",
			album_id: album.id,
			track_number: 1,
			duration_seconds: 200,
			file_path: "/music/alpha.mp3",
		})
		.returning({ id: tracks.id });
	const [t2] = await client
		.insert(tracks)
		.values({
			title: "Beta",
			album_id: album.id,
			track_number: 2,
			duration_seconds: 180,
			file_path: "/music/beta.mp3",
		})
		.returning({ id: tracks.id });
	const [t3] = await client
		.insert(tracks)
		.values({
			title: "Gamma",
			album_id: null,
			duration_seconds: null,
			file_path: "/music/gamma.mp3",
		})
		.returning({ id: tracks.id });

	await client
		.insert(track_artists)
		.values({ track_id: t1.id, artist_id: artistA.id });
	await client
		.insert(track_artists)
		.values({ track_id: t1.id, artist_id: artistB.id });
	await client
		.insert(track_artists)
		.values({ track_id: t2.id, artist_id: artistA.id });

	return { artistA, artistB, album, t1, t2, t3 };
}

beforeEach(() => {
	db = makeTestDb();
});

describe("LibraryService.listTracks", () => {
	it("returns all tracks", async () => {
		await seed(db);
		const result = await LibraryService.listTracks(db);
		expect(result).toHaveLength(3);
	});

	it("collects multiple artists onto one track", async () => {
		await seed(db);
		const result = await LibraryService.listTracks(db);
		const alpha = result.find((t) => t.title === "Alpha");
		expect(alpha?.artists).toHaveLength(2);
	});

	it("attaches album info", async () => {
		await seed(db);
		const result = await LibraryService.listTracks(db);
		const alpha = result.find((t) => t.title === "Alpha");
		expect(alpha?.album?.title).toBe("Album One");
	});

	it("sets album null for tracks without one", async () => {
		await seed(db);
		const result = await LibraryService.listTracks(db);
		const gamma = result.find((t) => t.title === "Gamma");
		expect(gamma?.album).toBeNull();
		expect(gamma?.artists).toHaveLength(0);
	});

	it("returns empty array when no tracks", async () => {
		const result = await LibraryService.listTracks(db);
		expect(result).toHaveLength(0);
	});
});

describe("LibraryService.listTracksPage", () => {
	it("orders 0-9 before A-Z before Others, then case-insensitively by title", async () => {
		await insertTitles(db, ["Zebra", "9 Lives", "!!!", "apple"]);
		const result = await LibraryService.listTracksPage(db, 0, 10);
		expect(result.map((t) => t.title)).toEqual([
			"9 Lives",
			"apple",
			"Zebra",
			"!!!",
		]);
	});

	it("paginates with offset and limit", async () => {
		await insertTitles(db, ["Alpha", "Beta", "Gamma", "Delta"]);
		const page1 = await LibraryService.listTracksPage(db, 0, 2);
		const page2 = await LibraryService.listTracksPage(db, 2, 2);
		expect(page1.map((t) => t.title)).toEqual(["Alpha", "Beta"]);
		expect(page2.map((t) => t.title)).toEqual(["Delta", "Gamma"]);
	});

	it("returns empty array past the end", async () => {
		await insertTitles(db, ["Alpha"]);
		const result = await LibraryService.listTracksPage(db, 5, 10);
		expect(result).toHaveLength(0);
	});
});

async function insertTitles(client: DbLike, titles: string[]) {
	for (const [i, title] of titles.entries()) {
		await client.insert(tracks).values({
			title,
			file_path: `/music/${i}.mp3`,
		});
	}
}

describe("LibraryService.listRecentlyAdded", () => {
	it("returns tracks newest-first, limited", async () => {
		const [t1] = await db
			.insert(tracks)
			.values({
				title: "First",
				file_path: "/music/first.mp3",
				added_at: new Date(2020, 0, 1),
			})
			.returning({ id: tracks.id });
		const [t2] = await db
			.insert(tracks)
			.values({
				title: "Second",
				file_path: "/music/second.mp3",
				added_at: new Date(2020, 0, 2),
			})
			.returning({ id: tracks.id });
		const [t3] = await db
			.insert(tracks)
			.values({
				title: "Third",
				file_path: "/music/third.mp3",
				added_at: new Date(2020, 0, 3),
			})
			.returning({ id: tracks.id });

		const result = await LibraryService.listRecentlyAdded(db, 2);
		expect(result.map((t) => t.id)).toEqual([t3.id, t2.id]);
		void t1;
	});

	it("returns empty array when no tracks", async () => {
		const result = await LibraryService.listRecentlyAdded(db, 5);
		expect(result).toHaveLength(0);
	});
});

describe("LibraryService.listRecentlyPlayed", () => {
	it("dedupes by track and orders by most recently played", async () => {
		const { t1, t2 } = await seed(db);
		const user = await makeUser(db);
		await db.insert(play_history).values({
			user_id: user.id,
			track_id: t1.id,
			played_at: new Date(2020, 0, 1),
		});
		await db.insert(play_history).values({
			user_id: user.id,
			track_id: t2.id,
			played_at: new Date(2020, 0, 2),
		});
		await db.insert(play_history).values({
			user_id: user.id,
			track_id: t1.id,
			played_at: new Date(2020, 0, 3),
		});

		const result = await LibraryService.listRecentlyPlayed(db, user.id, 10);
		expect(result.map((t) => t.id)).toEqual([t1.id, t2.id]);
	});

	it("returns empty array when the user has no history", async () => {
		await seed(db);
		const result = await LibraryService.listRecentlyPlayed(db, 999, 10);
		expect(result).toHaveLength(0);
	});
});

describe("LibraryService.listAlbumTracks", () => {
	it("returns full song rows ordered by track number", async () => {
		const { album } = await seed(db);
		const result = await LibraryService.listAlbumTracks(db, album.id);
		expect(result.map((t) => t.title)).toEqual(["Alpha", "Beta"]);
		expect(result[0].file_path).toBe("/music/alpha.mp3");
	});
});

describe("LibraryService.findTrackById / findTrackEntryById", () => {
	it("finds a track's file path by id", async () => {
		const { t1 } = await seed(db);
		const result = await LibraryService.findTrackById(db, t1.id);
		expect(result?.file_path).toBe("/music/alpha.mp3");
	});

	it("returns null for an unknown track id", async () => {
		expect(await LibraryService.findTrackById(db, 9999)).toBeNull();
	});

	it("finds a full track entry with album and artists", async () => {
		const { t1 } = await seed(db);
		const result = await LibraryService.findTrackEntryById(db, t1.id);
		expect(result?.title).toBe("Alpha");
		expect(result?.album?.title).toBe("Album One");
		expect(result?.artists).toHaveLength(2);
	});

	it("returns null for an unknown track entry id", async () => {
		expect(await LibraryService.findTrackEntryById(db, 9999)).toBeNull();
	});
});

describe("LibraryService.renameTrack / syncTrackTags", () => {
	it("renames a track and writes the new title back to the file", async () => {
		const dir = await mkdtemp(`${tmpdir()}/echo-lib-rename-`);
		const filePath = await makeFixtureMp3(dir, "song.mp3");
		const [track] = await db
			.insert(tracks)
			.values({ title: "Old Title", file_path: filePath })
			.returning({ id: tracks.id });

		await LibraryService.renameTrack(db, track.id, "New Title");
		// renameTrack fires syncTrackTags in the background (not awaited); give
		// the ffmpeg remux a moment to finish before checking the file's tags.
		await new Promise((r) => setTimeout(r, 500));

		const probe =
			await Bun.$`ffprobe -v quiet -print_format json -show_format ${filePath}`.json();
		expect(probe.format.tags.title).toBe("New Title");
	});

	it("does nothing when the track doesn't exist", async () => {
		await LibraryService.syncTrackTags(db, 9999);
	});

	it("logs a warning instead of throwing when writing tags fails", async () => {
		const [track] = await db
			.insert(tracks)
			.values({ title: "T", file_path: "/nonexistent/missing.mp3" })
			.returning({ id: tracks.id });
		await LibraryService.syncTrackTags(db, track.id);
	});

	it("syncs tags for multiple tracks", async () => {
		const dir = await mkdtemp(`${tmpdir()}/echo-lib-sync-`);
		const pathA = await makeFixtureMp3(dir, "a.mp3");
		const pathB = await makeFixtureMp3(dir, "b.mp3");
		const [a] = await db
			.insert(tracks)
			.values({ title: "A Title", file_path: pathA })
			.returning({ id: tracks.id });
		const [b] = await db
			.insert(tracks)
			.values({ title: "B Title", file_path: pathB })
			.returning({ id: tracks.id });

		await LibraryService.syncTracksTags(db, [a.id, b.id]);

		const probeA =
			await Bun.$`ffprobe -v quiet -print_format json -show_format ${pathA}`.json();
		expect(probeA.format.tags.title).toBe("A Title");
	});
});

describe("LibraryService.deleteTrack", () => {
	it("removes the track's rows and file", async () => {
		const dir = await mkdtemp(`${tmpdir()}/echo-lib-delete-`);
		const filePath = await makeFixtureMp3(dir, "song.mp3");
		const [track] = await db
			.insert(tracks)
			.values({ title: "T", file_path: filePath })
			.returning({ id: tracks.id });
		const user = await makeUser(db);
		await db
			.insert(user_playback_state)
			.values({ user_id: user.id, track_id: track.id });

		const deleted = await LibraryService.deleteTrack(db, track.id);
		expect(deleted).toBe(true);
		expect(await LibraryService.findTrackById(db, track.id)).toBeNull();
		expect(await Bun.file(filePath).exists()).toBe(false);
	});

	it("returns false for an unknown track id", async () => {
		expect(await LibraryService.deleteTrack(db, 9999)).toBe(false);
	});
});

describe("LibraryService.listDuplicateTracks", () => {
	it("groups tracks that share a fingerprint", async () => {
		await db.insert(tracks).values({
			title: "Dup A",
			file_path: "/music/dupA.mp3",
			fingerprint: "same-fp",
		});
		await db.insert(tracks).values({
			title: "Dup B",
			file_path: "/music/dupB.mp3",
			fingerprint: "same-fp",
		});
		await db.insert(tracks).values({
			title: "Unique",
			file_path: "/music/unique.mp3",
			fingerprint: "other-fp",
		});

		const result = await LibraryService.listDuplicateTracks(db);
		expect(result).toHaveLength(1);
		expect(result[0].tracks.map((t) => t.title).sort()).toEqual([
			"Dup A",
			"Dup B",
		]);
	});

	it("returns empty array when there are no duplicate fingerprints", async () => {
		await seed(db);
		expect(await LibraryService.listDuplicateTracks(db)).toHaveLength(0);
	});
});

describe("LibraryService.isDuplicateContent", () => {
	it("detects a fingerprint match already in the db", async () => {
		const dir = await mkdtemp(`${tmpdir()}/echo-lib-dup-`);
		const filePath = await makeFixtureMp3(dir, "song.mp3");
		const { fingerprintFile } = await import("../../bindings/chromaprint");
		const fp = await fingerprintFile(filePath);
		await db.insert(tracks).values({
			title: "T",
			file_path: "/music/existing.mp3",
			fingerprint: fp,
		});

		const isDup = await LibraryService.isDuplicateContent(
			db,
			filePath,
			new Set(),
		);
		expect(isDup).toBe(true);
	});

	it("detects a duplicate already seen earlier in the same batch", async () => {
		const dir = await mkdtemp(`${tmpdir()}/echo-lib-dup2-`);
		const filePath = await makeFixtureMp3(dir, "song.mp3");
		const { fingerprintFile } = await import("../../bindings/chromaprint");
		const fp = await fingerprintFile(filePath);

		const seen = new Set<string>([`fp:${fp}`]);
		const isDup = await LibraryService.isDuplicateContent(db, filePath, seen);
		expect(isDup).toBe(true);
	});

	it("returns false and records the fingerprint for a new file", async () => {
		const dir = await mkdtemp(`${tmpdir()}/echo-lib-dup3-`);
		const filePath = await makeFixtureMp3(dir, "song.mp3");
		const seen = new Set<string>();
		const isDup = await LibraryService.isDuplicateContent(db, filePath, seen);
		expect(isDup).toBe(false);
		expect(seen.size).toBe(1);
	});

	it("falls back to sha1 comparison when fingerprinting fails", async () => {
		// A 1-second clip is too short for fpcalc to produce a fingerprint,
		// which forces isDuplicateContent down its sha1 fallback path.
		const dir = await mkdtemp(`${tmpdir()}/echo-lib-dup4-`);
		const path = `${dir}/short.mp3`;
		await Bun.$`ffmpeg -y -f lavfi -i sine=frequency=440:duration=1 ${path}`.quiet();

		const seen = new Set<string>();
		const isDup = await LibraryService.isDuplicateContent(db, path, seen);
		expect(isDup).toBe(false);
		expect([...seen][0]).toMatch(/^sha1:/);

		const isDupAgain = await LibraryService.isDuplicateContent(db, path, seen);
		expect(isDupAgain).toBe(true);
	});
});

describe("LibraryService.scanFiles / scanMusicFolder", () => {
	it("scans and inserts new tracks from given file paths", async () => {
		const dir = await mkdtemp(`${tmpdir()}/echo-lib-scan-`);
		const artDir = await mkdtemp(`${tmpdir()}/echo-lib-art-`);
		const filePath = await makeFixtureMp3(dir, "song.mp3");

		const processed = await LibraryService.scanFiles(db, [filePath], artDir);
		expect(processed).toBe(1);

		const result = await LibraryService.listTracks(db);
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe("Fixture Song");
		expect(result[0].album?.title).toBe("Fixture Album");
		expect(result[0].artists.map((a) => a.name)).toEqual(["Fixture Artist"]);
	});

	it("skips reprocessing an unchanged file on a second scan", async () => {
		const dir = await mkdtemp(`${tmpdir()}/echo-lib-scan2-`);
		const artDir = await mkdtemp(`${tmpdir()}/echo-lib-art2-`);
		const filePath = await makeFixtureMp3(dir, "song.mp3");

		await LibraryService.scanFiles(db, [filePath], artDir);
		const secondPassCount = await LibraryService.scanFiles(
			db,
			[filePath],
			artDir,
		);
		expect(secondPassCount).toBe(0);
		expect(await LibraryService.listTracks(db)).toHaveLength(1);
	});

	it("backfills sha1 for an already-scanned file that's missing one", async () => {
		const dir = await mkdtemp(`${tmpdir()}/echo-lib-scan3-`);
		const artDir = await mkdtemp(`${tmpdir()}/echo-lib-art3-`);
		const filePath = await makeFixtureMp3(dir, "song.mp3");
		const stat = await Bun.file(filePath).stat();

		await db.insert(tracks).values({
			title: "Pre-existing",
			file_path: filePath,
			file_mtime: Math.floor(stat.mtimeMs),
			sha1: null,
		});

		await LibraryService.scanFiles(db, [filePath], artDir);

		const [row] = await db
			.select()
			.from(tracks)
			.where(eq(tracks.file_path, filePath));
		expect(row.sha1).not.toBeNull();
		expect(row.title).toBe("Pre-existing");
	});

	it("extracts album art on first scan and skips extraction when it already exists", async () => {
		const dir = await mkdtemp(`${tmpdir()}/echo-lib-scan4-`);
		const artDir = await mkdtemp(`${tmpdir()}/echo-lib-art4-`);
		const filePath = await makeFixtureMp3(dir, "song.mp3");

		await LibraryService.scanFiles(db, [filePath], artDir);
		await new Promise((r) => setTimeout(r, 300));

		const [album] = await db.select().from(albums);
		// The fixture is audio-only, so ffmpeg can't extract a video frame —
		// cover_path stays unset, but the attempt still exercises the ffmpeg
		// failure branch of extractAlbumArt.
		expect(album.cover_path).toBeNull();

		await Bun.write(`${artDir}/${album.id}.jpg`, "pretend jpeg bytes");
		const dir2 = await mkdtemp(`${tmpdir()}/echo-lib-scan4b-`);
		const filePath2 = await makeFixtureMp3(dir2, "song2.mp3");
		await LibraryService.scanFiles(db, [filePath2], artDir);
		await new Promise((r) => setTimeout(r, 300));

		const [albumAfter] = await db.select().from(albums);
		expect(albumAfter.cover_path).toBe(`/art/${album.id}`);
	});

	it("scans a whole directory via scanMusicFolder", async () => {
		const dir = await mkdtemp(`${tmpdir()}/echo-lib-folder-`);
		const artDir = await mkdtemp(`${tmpdir()}/echo-lib-folderart-`);
		await makeFixtureMp3(dir, "song.mp3");

		const count = await LibraryService.scanMusicFolder(db, dir, artDir);
		expect(count).toBe(1);
		expect(await LibraryService.listTracks(db)).toHaveLength(1);
	});
});

describe("buildRangeResponse", () => {
	async function fakeFile(dir: string) {
		const path = `${dir}/data.bin`;
		await Bun.write(path, "0123456789");
		return Bun.file(path);
	}

	it("returns a full response with no range header", async () => {
		const dir = await mkdtemp(`${tmpdir()}/echo-lib-range-`);
		const file = await fakeFile(dir);
		const res = buildRangeResponse(file, null);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-length")).toBe("10");
	});

	it("returns a 206 partial response for a start-end range", async () => {
		const dir = await mkdtemp(`${tmpdir()}/echo-lib-range2-`);
		const file = await fakeFile(dir);
		const res = buildRangeResponse(file, "bytes=2-5");
		expect(res.status).toBe(206);
		expect(res.headers.get("content-range")).toBe("bytes 2-5/10");
		expect(res.headers.get("content-length")).toBe("4");
	});

	it("returns the last N bytes for a suffix range", async () => {
		const dir = await mkdtemp(`${tmpdir()}/echo-lib-range3-`);
		const file = await fakeFile(dir);
		const res = buildRangeResponse(file, "bytes=-3");
		expect(res.status).toBe(206);
		expect(res.headers.get("content-range")).toBe("bytes 7-9/10");
	});

	it("returns from start to end of file when only a start is given", async () => {
		const dir = await mkdtemp(`${tmpdir()}/echo-lib-range4-`);
		const file = await fakeFile(dir);
		const res = buildRangeResponse(file, "bytes=5-");
		expect(res.status).toBe(206);
		expect(res.headers.get("content-range")).toBe("bytes 5-9/10");
	});

	it("falls back to a full response for a malformed range header", async () => {
		const dir = await mkdtemp(`${tmpdir()}/echo-lib-range5-`);
		const file = await fakeFile(dir);
		const res = buildRangeResponse(file, "not-a-range");
		expect(res.status).toBe(200);
	});
});
