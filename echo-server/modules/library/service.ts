import { eq } from "drizzle-orm";
import { fingerprintFile } from "../../bindings/chromaprint";
import {
	album_artists,
	albums,
	artists,
	track_artists,
	tracks,
} from "../../db/schema";
import type { DbLike } from "../../db/types";

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

async function upsertAlbum(
	client: DbLike,
	title: string,
	year: number | null,
	genre: string | null,
): Promise<number> {
	const existing = await client
		.select({ id: albums.id })
		.from(albums)
		.where(eq(albums.title, title));
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
	album: { id: number; title: string } | null;
};

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
			})
			.from(tracks)
			.leftJoin(track_artists, eq(track_artists.track_id, tracks.id))
			.leftJoin(artists, eq(artists.id, track_artists.artist_id))
			.leftJoin(albums, eq(albums.id, tracks.album_id))
			.orderBy(tracks.title);

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
							? { id: row.album_id, title: row.album_title }
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

	static async findArtist(client: DbLike, id: number) {
		const rows = await client.select().from(artists).where(eq(artists.id, id));
		return rows[0] ?? null;
	}

	static async getArtistTracks(client: DbLike, artistId: number) {
		return client
			.select({
				id: tracks.id,
				title: tracks.title,
				duration_seconds: tracks.duration_seconds,
			})
			.from(tracks)
			.innerJoin(track_artists, eq(track_artists.track_id, tracks.id))
			.where(eq(track_artists.artist_id, artistId))
			.orderBy(tracks.title);
	}

	static async findAlbum(client: DbLike, id: number) {
		const rows = await client.select().from(albums).where(eq(albums.id, id));
		return rows[0] ?? null;
	}

	static async getAlbumTracks(client: DbLike, albumId: number) {
		return client
			.select({
				id: tracks.id,
				title: tracks.title,
				duration_seconds: tracks.duration_seconds,
				track_number: tracks.track_number,
			})
			.from(tracks)
			.where(eq(tracks.album_id, albumId))
			.orderBy(tracks.track_number);
	}

	static async getAlbumArtists(
		client: DbLike,
		albumId: number,
	): Promise<string[]> {
		const rows = await client
			.select({ name: artists.name })
			.from(artists)
			.innerJoin(album_artists, eq(album_artists.artist_id, artists.id))
			.where(eq(album_artists.album_id, albumId));
		return rows.map((r) => r.name);
	}

	static async scanMusicFolder(client: DbLike, dir: string): Promise<number> {
		const glob = new Bun.Glob("**/*.{mp3,flac,m4a,aac,ogg,wav}");
		let skipped = 0;
		let processed = 0;
		for await (const file of glob.scan({ cwd: dir, absolute: true })) {
			try {
				const stat = await Bun.file(file).stat();
				const mtime = Math.floor(stat.mtimeMs);

				const existing = await client
					.select({ file_mtime: tracks.file_mtime })
					.from(tracks)
					.where(eq(tracks.file_path, file));

				if (existing.length > 0 && existing[0].file_mtime === mtime) {
					skipped++;
					continue;
				}

				const [meta, fingerprint] = await Promise.all([
					getTrackMeta(file),
					fingerprintFile(file).catch(() => null),
				]);

				const artistIds = await Promise.all(
					meta.artists.map((name) => upsertArtist(client, name)),
				);

				const albumId = meta.album
					? await upsertAlbum(client, meta.album, meta.year, meta.genre)
					: null;

				const [track] = await client
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
					await client
						.insert(track_artists)
						.values({ track_id: track.id, artist_id: artistId })
						.onConflictDoNothing();

					if (albumId !== null) {
						await client
							.insert(album_artists)
							.values({ album_id: albumId, artist_id: artistId })
							.onConflictDoNothing();
					}
				}

				processed++;
			} catch (err) {
				console.warn(`Skipped ${file}:`, err);
			}
		}
		console.log(`Library scan complete: ${processed} processed, ${skipped} unchanged`);
		return processed + skipped;
	}
}
