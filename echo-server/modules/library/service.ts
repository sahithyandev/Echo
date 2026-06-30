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

export abstract class LibraryService {
	static async scanMusicFolder(client: DbLike, dir: string): Promise<number> {
		const glob = new Bun.Glob("**/*.{mp3,flac,m4a,aac,ogg,wav}");
		let count = 0;
		for await (const file of glob.scan({ cwd: dir, absolute: true })) {
			try {
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

				count++;
			} catch (err) {
				console.warn(`Skipped ${file}:`, err);
			}
		}
		return count;
	}
}
