import type { DbLike } from "../../db/types";
import { LibraryService, scanState } from "../library/service";
import { SettingsService } from "../settings/service";
import { makeId, parseId } from "./ids";
import { SubsonicQueries } from "./queries";
import { ok, SubsonicError, SubsonicErrorCode } from "./respond";
import { buildAlbum, buildSong } from "./song";

type Query = Record<string, string | undefined>;
type SubsonicUser = { id: number; name: string; email: string };

function str(query: Query, key: string): string | undefined {
	return query[key];
}

function int(query: Query, key: string, fallback: number): number {
	const v = query[key];
	if (!v) return fallback;
	const n = Number.parseInt(v, 10);
	return Number.isFinite(n) ? n : fallback;
}

function requireId(query: Query): { type: "ar" | "al" | "tr"; id: number } {
	const parsed = parseId(str(query, "id"));
	if (!parsed) throw new SubsonicError(SubsonicErrorCode.notFound, "Not found");
	return parsed;
}

async function getArtists(db: DbLike) {
	const rows = await SubsonicQueries.getArtistsIndexed(db);
	const groups = new Map<string, typeof rows>();
	for (const row of rows) {
		const letter = /[a-z]/i.test(row.name[0] ?? "")
			? row.name[0].toUpperCase()
			: "#";
		if (!groups.has(letter)) groups.set(letter, []);
		// biome-ignore lint/style/noNonNullAssertion: just set above
		groups.get(letter)!.push(row);
	}
	const index = [...groups.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([letter, artists]) => ({
			name: letter,
			artist: artists.map((a) => ({
				id: makeId("ar", a.id),
				name: a.name,
				albumCount: a.albumCount,
			})),
		}));
	return ok({ artists: { ignoredArticles: "", index } });
}

async function getIndexes(db: DbLike) {
	const rows = await SubsonicQueries.getArtistsIndexed(db);
	const groups = new Map<string, typeof rows>();
	for (const row of rows) {
		const letter = /[a-z]/i.test(row.name[0] ?? "")
			? row.name[0].toUpperCase()
			: "#";
		if (!groups.has(letter)) groups.set(letter, []);
		// biome-ignore lint/style/noNonNullAssertion: just set above
		groups.get(letter)!.push(row);
	}
	const index = [...groups.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([letter, artists]) => ({
			name: letter,
			artist: artists.map((a) => ({ id: makeId("ar", a.id), name: a.name })),
		}));
	return ok({ indexes: { ignoredArticles: "", index } });
}

/** Legacy folder-style browsing: `id` is either an artist (children = albums) or an album (children = songs). */
async function getMusicDirectory(db: DbLike, query: Query) {
	const { type, id } = requireId(query);

	if (type === "ar") {
		const artist = await SubsonicQueries.getArtistById(db, id);
		if (!artist)
			throw new SubsonicError(SubsonicErrorCode.notFound, "Artist not found");
		const albums = await SubsonicQueries.getArtistAlbums(db, id);
		return ok({
			directory: {
				id: makeId("ar", artist.id),
				name: artist.name,
				child: albums.map((a) => ({
					id: makeId("al", a.id),
					parent: makeId("ar", artist.id),
					isDir: true,
					title: a.title,
					artist: artist.name,
					coverArt: makeId("al", a.id),
					year: a.year,
					genre: a.genre,
				})),
			},
		});
	}

	if (type === "al") {
		const album = await SubsonicQueries.getAlbumById(db, id);
		if (!album)
			throw new SubsonicError(SubsonicErrorCode.notFound, "Album not found");
		const [primaryArtist, songs] = await Promise.all([
			SubsonicQueries.getAlbumPrimaryArtist(db, id),
			SubsonicQueries.getAlbumSongs(db, id),
		]);
		const songIds = songs.map((s) => s.id);
		const [artistNames, playCounts] = await Promise.all([
			SubsonicQueries.getTrackArtistNames(db, songIds),
			SubsonicQueries.getPlayCounts(db, songIds),
		]);
		return ok({
			directory: {
				id: makeId("al", album.id),
				name: album.title,
				parent: primaryArtist ? makeId("ar", primaryArtist.id) : undefined,
				child: songs.map((s) => ({
					...buildSong(s, {
						artist: artistNames.get(s.id) ?? primaryArtist?.name,
						playCount: playCounts.get(s.id) ?? 0,
					}),
					parent: makeId("al", album.id),
				})),
			},
		});
	}

	throw new SubsonicError(SubsonicErrorCode.notFound, "Not found");
}

async function getArtist(db: DbLike, query: Query) {
	const { type, id } = requireId(query);
	if (type !== "ar")
		throw new SubsonicError(SubsonicErrorCode.notFound, "Not found");
	const artist = await SubsonicQueries.getArtistById(db, id);
	if (!artist)
		throw new SubsonicError(SubsonicErrorCode.notFound, "Artist not found");
	const albums = await SubsonicQueries.getArtistAlbums(db, id);
	return ok({
		artist: {
			id: makeId("ar", artist.id),
			name: artist.name,
			albumCount: albums.length,
			album: albums.map((a) =>
				buildAlbum(a, {
					artist: artist.name,
					artistId: artist.id,
					songCount: a.songCount,
					duration: a.duration,
				}),
			),
		},
	});
}

async function getAlbum(db: DbLike, query: Query) {
	const { type, id } = requireId(query);
	if (type !== "al")
		throw new SubsonicError(SubsonicErrorCode.notFound, "Not found");
	const album = await SubsonicQueries.getAlbumById(db, id);
	if (!album)
		throw new SubsonicError(SubsonicErrorCode.notFound, "Album not found");

	const [primaryArtist, songs] = await Promise.all([
		SubsonicQueries.getAlbumPrimaryArtist(db, id),
		SubsonicQueries.getAlbumSongs(db, id),
	]);
	const songIds = songs.map((s) => s.id);
	const [artistNames, playCounts] = await Promise.all([
		SubsonicQueries.getTrackArtistNames(db, songIds),
		SubsonicQueries.getPlayCounts(db, songIds),
	]);
	const duration = songs.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);

	return ok({
		album: {
			...buildAlbum(album, {
				artist: primaryArtist?.name,
				artistId: primaryArtist?.id,
				songCount: songs.length,
				duration,
			}),
			song: songs.map((s) =>
				buildSong(s, {
					artist: artistNames.get(s.id) ?? primaryArtist?.name,
					playCount: playCounts.get(s.id) ?? 0,
				}),
			),
		},
	});
}

async function getSong(db: DbLike, query: Query) {
	const { type, id } = requireId(query);
	if (type !== "tr")
		throw new SubsonicError(SubsonicErrorCode.notFound, "Not found");
	const song = await SubsonicQueries.getSongById(db, id);
	if (!song)
		throw new SubsonicError(SubsonicErrorCode.notFound, "Song not found");
	const [artistNames, playCounts] = await Promise.all([
		SubsonicQueries.getTrackArtistNames(db, [id]),
		SubsonicQueries.getPlayCounts(db, [id]),
	]);
	return ok({
		song: buildSong(song, {
			artist: artistNames.get(id),
			playCount: playCounts.get(id) ?? 0,
		}),
	});
}

async function getGenres(db: DbLike) {
	const rows = await SubsonicQueries.getGenres(db);
	return ok({
		genres: {
			genre: rows
				.filter((r) => r.genre)
				.map((r) => ({
					value: r.genre,
					songCount: r.songCount,
					albumCount: r.albumCount,
				})),
		},
	});
}

async function getAlbumList2(db: DbLike, user: SubsonicUser, query: Query) {
	const rows = await SubsonicQueries.getAlbumList(db, {
		type: str(query, "type") ?? "newest",
		size: int(query, "size", 10),
		offset: int(query, "offset", 0),
		userId: user.id,
		genre: str(query, "genre"),
		fromYear: query.fromYear ? int(query, "fromYear", 0) : undefined,
		toYear: query.toYear ? int(query, "toYear", 0) : undefined,
	});
	const artistByAlbum = await batchPrimaryArtists(
		db,
		rows.map((r) => r.id),
	);
	return ok({
		albumList2: {
			album: rows.map((r) => {
				const a = artistByAlbum.get(r.id);
				return buildAlbum(r, { artist: a?.name, artistId: a?.id });
			}),
		},
	});
}

async function batchPrimaryArtists(db: DbLike, albumIds: number[]) {
	const entries = await Promise.all(
		albumIds.map(
			async (id) =>
				[id, await SubsonicQueries.getAlbumPrimaryArtist(db, id)] as const,
		),
	);
	const map = new Map<number, { id: number; name: string }>();
	for (const [id, artist] of entries) if (artist) map.set(id, artist);
	return map;
}

async function getRandomSongs(db: DbLike, query: Query) {
	const rows = await SubsonicQueries.getRandomSongs(
		db,
		int(query, "size", 10),
		str(query, "genre"),
	);
	const names = await SubsonicQueries.getTrackArtistNames(
		db,
		rows.map((r) => r.id),
	);
	return ok({
		randomSongs: {
			song: rows.map((r) => buildSong(r, { artist: names.get(r.id) })),
		},
	});
}

async function getSongsByGenre(db: DbLike, query: Query) {
	const genre = str(query, "genre");
	if (!genre)
		throw new SubsonicError(
			SubsonicErrorCode.missingParam,
			"Required parameter is missing: genre",
		);
	const rows = await SubsonicQueries.getSongsByGenre(
		db,
		genre,
		int(query, "count", 10),
		int(query, "offset", 0),
	);
	const names = await SubsonicQueries.getTrackArtistNames(
		db,
		rows.map((r) => r.id),
	);
	return ok({
		songsByGenre: {
			song: rows.map((r) => buildSong(r, { artist: names.get(r.id) })),
		},
	});
}

/** An empty/absent `query` means "list everything" — how clients build flat "all songs" browsing. */
async function search3(db: DbLike, query: Query) {
	const q = str(query, "query")?.trim() || undefined;
	const [artistRows, albumRows, songRows] = await Promise.all([
		SubsonicQueries.searchArtists(
			db,
			q,
			int(query, "artistCount", 20),
			int(query, "artistOffset", 0),
		),
		SubsonicQueries.searchAlbums(
			db,
			q,
			int(query, "albumCount", 20),
			int(query, "albumOffset", 0),
		),
		SubsonicQueries.searchSongs(
			db,
			q,
			int(query, "songCount", 20),
			int(query, "songOffset", 0),
		),
	]);
	const artistByAlbum = await batchPrimaryArtists(
		db,
		albumRows.map((a) => a.id),
	);
	const songIds = songRows.map((s) => s.id);
	const [artistNames, playCounts] = await Promise.all([
		SubsonicQueries.getTrackArtistNames(db, songIds),
		SubsonicQueries.getPlayCounts(db, songIds),
	]);
	return ok({
		searchResult3: {
			artist: artistRows.map((a) => ({ id: makeId("ar", a.id), name: a.name })),
			album: albumRows.map((a) => {
				const artist = artistByAlbum.get(a.id);
				return buildAlbum(a, { artist: artist?.name, artistId: artist?.id });
			}),
			song: songRows.map((s) =>
				buildSong(s, {
					artist: artistNames.get(s.id),
					playCount: playCounts.get(s.id) ?? 0,
				}),
			),
		},
	});
}

async function scrobble(db: DbLike, user: SubsonicUser, query: Query) {
	const { type, id } = requireId(query);
	if (type !== "tr")
		throw new SubsonicError(SubsonicErrorCode.notFound, "Not found");
	console.log(
		`[subsonic] scrobble user=${user.name} track=${id} submission=${str(query, "submission") ?? "(unset)"}`,
	);
	if (str(query, "submission") === "false") {
		await SettingsService.syncPlayback(db, user.id, {
			track_id: id,
			seconds: 0,
			playing: true,
		});
	} else {
		await SettingsService.scrobbleSubmission(db, user.id, id);
	}
	return ok({});
}

function scanStatus() {
	return ok({
		scanStatus: { scanning: scanState.scanning, count: scanState.count },
	});
}

async function startScan(db: DbLike) {
	if (!scanState.scanning) {
		const { musicDir, dataDir } = await SettingsService.getDirs(db);
		LibraryService.scanMusicFolder(db, musicDir, `${dataDir}/art`).catch(
			(err) => console.warn("[subsonic] startScan failed:", err),
		);
	}
	return scanStatus();
}

async function getNowPlaying(db: DbLike) {
	const rows = await SubsonicQueries.getNowPlaying(db);
	return ok({
		nowPlaying: {
			entry: rows.map((r) => ({
				...buildSong(r, {}),
				username: r.username,
				minutesAgo: 0,
				playerId: 1,
			})),
		},
	});
}

/** Dispatch table: each method receives the resolved user and raw query params, returns a full envelope. */
export const subsonicHandlers: Record<
	string,
	(
		db: DbLike,
		user: SubsonicUser,
		query: Query,
	) => Promise<ReturnType<typeof ok>>
> = {
	ping: async () => ok({}),
	getLicense: async () => ok({ license: { valid: true } }),
	getMusicFolders: async () =>
		ok({ musicFolders: { musicFolder: [{ id: 1, name: "Music" }] } }),
	getOpenSubsonicExtensions: async () => ok({ openSubsonicExtensions: [] }),
	getArtists: async (db) => getArtists(db),
	getIndexes: async (db) => getIndexes(db),
	getMusicDirectory: async (db, _u, q) => getMusicDirectory(db, q),
	getArtist: async (db, _u, q) => getArtist(db, q),
	getAlbum: async (db, _u, q) => getAlbum(db, q),
	getSong: async (db, _u, q) => getSong(db, q),
	getGenres: async (db) => getGenres(db),
	getAlbumList2: async (db, u, q) => getAlbumList2(db, u, q),
	getRandomSongs: async (db, _u, q) => getRandomSongs(db, q),
	getSongsByGenre: async (db, _u, q) => getSongsByGenre(db, q),
	search3: async (db, _u, q) => search3(db, q),
	search2: async (db, _u, q) => search3(db, q),
	scrobble: async (db, u, q) => scrobble(db, u, q),
	getNowPlaying: async (db) => getNowPlaying(db),
	startScan: async (db) => startScan(db),
	getScanStatus: async () => scanStatus(),
	getStarred2: async () =>
		ok({ starred2: { artist: [], album: [], song: [] } }),
	getStarred: async () => ok({ starred: { artist: [], album: [], song: [] } }),
	getPlaylists: async () => ok({ playlists: { playlist: [] } }),
	star: async () => ok({}),
	unstar: async () => ok({}),
	setRating: async () => ok({}),
};
