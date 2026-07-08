import { mkdir, rename, unlink } from "node:fs/promises";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { FPCALC_AVAILABLE, fingerprintFile } from "../../bindings/chromaprint";
import {
	album_artists,
	albums,
	artists,
	listening,
	play_history,
	track_artists,
	tracks,
	user_playback_state,
} from "../../db/schema";
import type { DbLike } from "../../db/types";

export const AUDIO_EXTENSIONS = ["mp3", "flac", "m4a", "aac", "ogg", "wav"];

async function getTrackMeta(filePath: string) {
	const raw =
		await Bun.$`ffprobe -v quiet -print_format json -show_format ${filePath}`.json();
	const tags: Record<string, string> = raw?.format?.tags ?? {};
	const duration = Number.parseFloat(raw?.format?.duration ?? "0");
	return {
		title:
			tags.title ??
			(filePath.split("/").pop() ?? filePath).replace(/\.\w+$/i, ""),
		artists: (tags.artist ?? tags.ARTIST ?? "")
			.split(/[,&]/)
			.map((s) => s.trim())
			.filter(Boolean),
		album: tags.album ?? tags.ALBUM ?? null,
		track_number: tags.track ? Number.parseInt(tags.track, 10) : null,
		year: tags.date ? Number.parseInt(tags.date, 10) : null,
		genre: tags.genre ?? tags.GENRE ?? null,
		duration_seconds: duration > 0 ? Math.round(duration) : null,
	};
}

/** Rewrites an audio file's tags in place (remux with `-codec copy`, no re-encode). */
async function writeTags(
	filePath: string,
	tags: Record<string, string>,
): Promise<void> {
	const ext = filePath.slice(filePath.lastIndexOf("."));
	const tmpPath = `${filePath}.tagtmp${ext}`;
	const metadataArgs = Object.entries(tags).flatMap(([key, value]) => [
		"-metadata",
		`${key}=${value}`,
	]);
	const result =
		await Bun.$`ffmpeg -y -i ${filePath} -map 0 -codec copy ${metadataArgs} ${tmpPath}`.quiet();
	if (result.exitCode !== 0) {
		await unlink(tmpPath).catch(() => null);
		throw new Error(`ffmpeg exited ${result.exitCode}: ${result.stderr}`);
	}
	await rename(tmpPath, filePath);
}

async function upsertArtist(client: DbLike, name: string): Promise<number> {
	const existing = await client
		.select({ id: artists.id })
		.from(artists)
		.where(eq(artists.name, name));
	if (existing.length > 0) return existing[0].id;
	const [row] = await client
		.insert(artists)
		.values({ name })
		.returning({ id: artists.id });
	return row.id;
}

async function extractAlbumArt(
	client: DbLike,
	albumId: number,
	trackPath: string,
	artDir: string,
): Promise<void> {
	const outPath = `${artDir}/${albumId}.jpg`;
	if (await Bun.file(outPath).exists()) {
		console.log(`[art] album ${albumId}: already exists`);
	} else {
		await mkdir(artDir, { recursive: true });
		const result =
			await Bun.$`ffmpeg -y -i ${trackPath} -an -vcodec copy -frames:v 1 ${outPath}`.quiet();

		if (result.exitCode !== 0) {
			console.warn(
				`[art] ffmpeg failed for album ${albumId} (exit ${result.exitCode}):\n${result.stderr.toString()}`,
			);
			return;
		}
	}

	await client
		.update(albums)
		.set({ cover_path: `/art/${albumId}` })
		.where(eq(albums.id, albumId));
}

async function upsertAlbum(
	client: DbLike,
	title: string,
	year: number | null,
	genre: string | null,
): Promise<number> {
	const existing = await client
		.select({ id: albums.id })
		.from(albums)
		.where(
			and(
				eq(albums.title, title),
				year === null ? isNull(albums.year) : eq(albums.year, year),
			),
		);
	if (existing.length > 0) return existing[0].id;
	const [row] = await client
		.insert(albums)
		.values({ title, year, genre })
		.returning({ id: albums.id });
	return row.id;
}

export type TrackEntry = {
	id: number;
	title: string;
	duration_seconds: number | null;
	artists: { id: number; name: string }[];
	album: { id: number; title: string; cover_path: string | null } | null;
};

export type DuplicateGroup = {
	fingerprint: string;
	tracks: {
		id: number;
		title: string;
		duration_seconds: number | null;
		file_path: string;
		album: string | null;
		artists: string[];
		fingerprint: string;
	}[];
};

type TrackRow = {
	id: number;
	title: string;
	duration_seconds: number | null;
	artist_id: number | null;
	artist_name: string | null;
	album_id: number | null;
	album_title: string | null;
	album_cover_path: string | null;
};

function hydrateTracks(rows: TrackRow[]): TrackEntry[] {
	const trackMap = new Map<number, TrackEntry>();
	for (const row of rows) {
		if (!trackMap.has(row.id)) {
			trackMap.set(row.id, {
				id: row.id,
				title: row.title,
				duration_seconds: row.duration_seconds,
				artists: [],
				album:
					row.album_id && row.album_title
						? {
								id: row.album_id,
								title: row.album_title,
								cover_path: row.album_cover_path ?? null,
							}
						: null,
			});
		}
		if (row.artist_id && row.artist_name)
			trackMap
				.get(row.id)
				?.artists.push({ id: row.artist_id, name: row.artist_name });
	}
	return [...trackMap.values()];
}

/** Serves a file with HTTP range support, used by both the web player and Subsonic `stream`/`download`. */
export function buildRangeResponse(
	file: ReturnType<typeof Bun.file>,
	rangeHeader: string | null,
): Response {
	const size = file.size;

	if (rangeHeader) {
		const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
		if (match) {
			// A suffix range ("bytes=-500") has no start; it means the last N bytes.
			const start = match[1]
				? Number.parseInt(match[1], 10)
				: size - Number.parseInt(match[2], 10);
			const end =
				match[1] && match[2] ? Number.parseInt(match[2], 10) : size - 1;
			return new Response(file.slice(start, end + 1), {
				status: 206,
				headers: {
					"Content-Range": `bytes ${start}-${end}/${size}`,
					"Accept-Ranges": "bytes",
					"Content-Length": String(end - start + 1),
					"Content-Type": file.type || "audio/mpeg",
				},
			});
		}
	}

	return new Response(file, {
		headers: {
			"Accept-Ranges": "bytes",
			"Content-Length": String(size),
			"Content-Type": file.type || "audio/mpeg",
		},
	});
}

export const scanState = { scanning: false, count: 0 };

export abstract class LibraryService {
	static async listTracks(client: DbLike): Promise<TrackEntry[]> {
		const rows = await client
			.select({
				id: tracks.id,
				title: tracks.title,
				duration_seconds: tracks.duration_seconds,
				artist_id: artists.id,
				artist_name: artists.name,
				album_id: albums.id,
				album_title: albums.title,
				album_cover_path: albums.cover_path,
			})
			.from(tracks)
			.leftJoin(track_artists, eq(track_artists.track_id, tracks.id))
			.leftJoin(artists, eq(artists.id, track_artists.artist_id))
			.leftJoin(albums, eq(albums.id, tracks.album_id))
			.orderBy(tracks.title);

		return hydrateTracks(rows);
	}

	/** Newest tracks by when they were added to the library. */
	static async listRecentlyAdded(
		client: DbLike,
		limit: number,
	): Promise<TrackEntry[]> {
		const recentIds = await client
			.select({ id: tracks.id })
			.from(tracks)
			.orderBy(desc(tracks.added_at))
			.limit(limit);
		if (recentIds.length === 0) return [];

		const rows = await client
			.select({
				id: tracks.id,
				title: tracks.title,
				duration_seconds: tracks.duration_seconds,
				artist_id: artists.id,
				artist_name: artists.name,
				album_id: albums.id,
				album_title: albums.title,
				album_cover_path: albums.cover_path,
			})
			.from(tracks)
			.leftJoin(track_artists, eq(track_artists.track_id, tracks.id))
			.leftJoin(artists, eq(artists.id, track_artists.artist_id))
			.leftJoin(albums, eq(albums.id, tracks.album_id))
			.where(
				inArray(
					tracks.id,
					recentIds.map((r) => r.id),
				),
			);

		const byId = new Map(hydrateTracks(rows).map((t) => [t.id, t]));
		return recentIds.map((r) => byId.get(r.id)).filter((t) => t !== undefined);
	}

	/** Most recently played tracks for a user, newest first, deduped by track. */
	static async listRecentlyPlayed(
		client: DbLike,
		userId: number,
		limit: number,
	): Promise<TrackEntry[]> {
		const recent = await client
			.select({
				track_id: play_history.track_id,
				last_played_at: sql<number>`max(${play_history.played_at})`,
			})
			.from(play_history)
			.where(eq(play_history.user_id, userId))
			.groupBy(play_history.track_id)
			.orderBy(desc(sql`max(${play_history.played_at})`))
			.limit(limit);
		if (recent.length === 0) return [];

		const rows = await client
			.select({
				id: tracks.id,
				title: tracks.title,
				duration_seconds: tracks.duration_seconds,
				artist_id: artists.id,
				artist_name: artists.name,
				album_id: albums.id,
				album_title: albums.title,
				album_cover_path: albums.cover_path,
			})
			.from(tracks)
			.leftJoin(track_artists, eq(track_artists.track_id, tracks.id))
			.leftJoin(artists, eq(artists.id, track_artists.artist_id))
			.leftJoin(albums, eq(albums.id, tracks.album_id))
			.where(
				inArray(
					tracks.id,
					recent.map((r) => r.track_id),
				),
			);

		const byId = new Map(hydrateTracks(rows).map((t) => [t.id, t]));
		return recent
			.map((r) => byId.get(r.track_id))
			.filter((t) => t !== undefined);
	}

	/** Full song rows (file-level fields included) for one album, ordered by track number. Used by the Subsonic module. */
	static async listAlbumTracks(client: DbLike, albumId: number) {
		return client
			.select({
				id: tracks.id,
				title: tracks.title,
				track_number: tracks.track_number,
				year: tracks.year,
				duration_seconds: tracks.duration_seconds,
				file_path: tracks.file_path,
				album_id: tracks.album_id,
			})
			.from(tracks)
			.where(eq(tracks.album_id, albumId))
			.orderBy(tracks.track_number, tracks.title);
	}

	static async findTrackById(client: DbLike, id: number) {
		const rows = await client
			.select({ file_path: tracks.file_path })
			.from(tracks)
			.where(eq(tracks.id, id));
		return rows[0] ?? null;
	}

	static async renameTrack(client: DbLike, id: number, title: string) {
		await client.update(tracks).set({ title }).where(eq(tracks.id, id));
		void LibraryService.syncTrackTags(client, id);
	}

	/** Writes a track's current title/album/artists (from the DB) back into its file's tags. */
	static async syncTrackTags(client: DbLike, id: number): Promise<void> {
		const [track, entry] = await Promise.all([
			LibraryService.findTrackById(client, id),
			LibraryService.findTrackEntryById(client, id),
		]);
		if (!track || !entry) return;

		const fileTags: Record<string, string> = { title: entry.title };
		if (entry.album) fileTags.album = entry.album.title;
		if (entry.artists.length)
			fileTags.artist = entry.artists.map((a) => a.name).join(", ");

		try {
			await writeTags(track.file_path, fileTags);
		} catch (err) {
			console.warn(`Failed to write tags for track ${id}:`, err);
		}
	}

	/** Background tag sync for multiple tracks (e.g. after an album/artist rename or merge). */
	static async syncTracksTags(client: DbLike, ids: number[]): Promise<void> {
		for (const id of ids) {
			await LibraryService.syncTrackTags(client, id);
		}
	}

	/** Deletes a track's DB rows (and any references to it) and its file on disk. */
	static async deleteTrack(client: DbLike, id: number): Promise<boolean> {
		const track = await LibraryService.findTrackById(client, id);
		if (!track) return false;

		await client.delete(track_artists).where(eq(track_artists.track_id, id));
		await client.delete(play_history).where(eq(play_history.track_id, id));
		await client.delete(listening).where(eq(listening.track_id, id));
		await client
			.update(user_playback_state)
			.set({ track_id: null })
			.where(eq(user_playback_state.track_id, id));
		await client.delete(tracks).where(eq(tracks.id, id));

		await unlink(track.file_path).catch(() => null);
		return true;
	}

	/** Full track entry (with artists/album) for a single id, e.g. "continue listening". */
	static async findTrackEntryById(
		client: DbLike,
		id: number,
	): Promise<TrackEntry | null> {
		const rows = await client
			.select({
				id: tracks.id,
				title: tracks.title,
				duration_seconds: tracks.duration_seconds,
				artist_id: artists.id,
				artist_name: artists.name,
				album_id: albums.id,
				album_title: albums.title,
				album_cover_path: albums.cover_path,
			})
			.from(tracks)
			.leftJoin(track_artists, eq(track_artists.track_id, tracks.id))
			.leftJoin(artists, eq(artists.id, track_artists.artist_id))
			.leftJoin(albums, eq(albums.id, tracks.album_id))
			.where(eq(tracks.id, id));
		return hydrateTracks(rows)[0] ?? null;
	}

	/** Tracks sharing an exact fingerprint, grouped for side-by-side comparison. */
	static async listDuplicateTracks(client: DbLike): Promise<DuplicateGroup[]> {
		const dupeFingerprints = await client
			.select({ fingerprint: tracks.fingerprint })
			.from(tracks)
			.where(isNotNull(tracks.fingerprint))
			.groupBy(tracks.fingerprint)
			.having(sql`count(*) > 1`);
		if (dupeFingerprints.length === 0) return [];

		const fingerprints = dupeFingerprints.map((d) => d.fingerprint as string);
		const rows = await client
			.select({
				id: tracks.id,
				title: tracks.title,
				duration_seconds: tracks.duration_seconds,
				file_path: tracks.file_path,
				fingerprint: tracks.fingerprint,
				artist_name: artists.name,
				album_title: albums.title,
			})
			.from(tracks)
			.leftJoin(track_artists, eq(track_artists.track_id, tracks.id))
			.leftJoin(artists, eq(artists.id, track_artists.artist_id))
			.leftJoin(albums, eq(albums.id, tracks.album_id))
			.where(inArray(tracks.fingerprint, fingerprints));

		const trackMap = new Map<number, DuplicateGroup["tracks"][number]>();
		for (const row of rows) {
			let track = trackMap.get(row.id);
			if (!track) {
				track = {
					id: row.id,
					title: row.title,
					duration_seconds: row.duration_seconds,
					file_path: row.file_path,
					album: row.album_title,
					artists: [],
					fingerprint: row.fingerprint as string,
				};
				trackMap.set(row.id, track);
			}
			if (row.artist_name) track.artists.push(row.artist_name);
		}

		const groups = new Map<string, DuplicateGroup["tracks"]>();
		for (const track of trackMap.values()) {
			const list = groups.get(track.fingerprint) ?? [];
			list.push(track);
			groups.set(track.fingerprint, list);
		}
		return fingerprints
			.map((fingerprint) => ({
				fingerprint,
				tracks: groups.get(fingerprint) ?? [],
			}))
			.filter((g) => g.tracks.length > 1);
	}

	static async scanMusicFolder(
		client: DbLike,
		dir: string,
		artDir: string,
	): Promise<number> {
		scanState.scanning = true;
		scanState.count = 0;
		try {
			return await LibraryService.runScan(client, dir, artDir);
		} finally {
			scanState.scanning = false;
		}
	}

	/** Scans only the given files (e.g. freshly uploaded tracks) instead of walking the whole library. */
	static async scanFiles(
		client: DbLike,
		filePaths: string[],
		artDir: string,
	): Promise<number> {
		scanState.scanning = true;
		scanState.count = 0;
		try {
			let processed = 0;
			for (const file of filePaths) {
				scanState.count++;
				if (
					(await LibraryService.processFile(client, file, artDir)) ===
					"processed"
				)
					processed++;
			}
			console.log(
				`Targeted scan complete: ${processed}/${filePaths.length} processed`,
			);
			return processed;
		} finally {
			scanState.scanning = false;
		}
	}

	private static async processFile(
		client: DbLike,
		file: string,
		artDir: string,
	): Promise<"processed" | "unchanged" | "error"> {
		try {
			const stat = await Bun.file(file).stat();
			const mtime = Math.floor(stat.mtimeMs);

			const existing = await client
				.select({ file_mtime: tracks.file_mtime })
				.from(tracks)
				.where(eq(tracks.file_path, file));

			if (existing.length > 0 && existing[0].file_mtime === mtime) {
				return "unchanged";
			}

			const [meta, fingerprint] = await Promise.all([
				getTrackMeta(file),
				FPCALC_AVAILABLE ? fingerprintFile(file).catch(() => null) : null,
			]);

			const albumId = await client.transaction(async (tx) => {
				const artistIds = await Promise.all(
					meta.artists.map((name) => upsertArtist(tx, name)),
				);

				const albumId = meta.album
					? await upsertAlbum(tx, meta.album, meta.year, meta.genre)
					: null;

				const [track] = await tx
					.insert(tracks)
					.values({
						title: meta.title,
						album_id: albumId,
						track_number: meta.track_number,
						year: meta.year,
						duration_seconds: meta.duration_seconds,
						file_path: file,
						file_mtime: mtime,
						fingerprint,
					})
					.onConflictDoUpdate({
						target: tracks.file_path,
						set: {
							title: meta.title,
							album_id: albumId,
							track_number: meta.track_number,
							year: meta.year,
							duration_seconds: meta.duration_seconds,
							file_mtime: mtime,
							fingerprint,
						},
					})
					.returning({ id: tracks.id });

				for (const artistId of artistIds) {
					await tx
						.insert(track_artists)
						.values({ track_id: track.id, artist_id: artistId })
						.onConflictDoNothing();

					if (albumId !== null) {
						await tx
							.insert(album_artists)
							.values({ album_id: albumId, artist_id: artistId })
							.onConflictDoNothing();
					}
				}

				return albumId;
			});

			if (albumId !== null) {
				extractAlbumArt(client, albumId, file, artDir).catch(() => null);
			}

			return "processed";
		} catch (err) {
			console.warn(`Skipped ${file}:`, err);
			return "error";
		}
	}

	private static async runScan(
		client: DbLike,
		dir: string,
		artDir: string,
	): Promise<number> {
		const glob = new Bun.Glob(`**/*.{${AUDIO_EXTENSIONS.join(",")}}`);
		let skipped = 0;
		let processed = 0;
		for await (const file of glob.scan({ cwd: dir, absolute: true })) {
			scanState.count++;
			const result = await LibraryService.processFile(client, file, artDir);
			if (result === "processed") processed++;
			else if (result === "unchanged") skipped++;
		}
		console.log(
			`Library scan complete: ${processed} processed, ${skipped} unchanged`,
		);
		return processed + skipped;
	}
}
