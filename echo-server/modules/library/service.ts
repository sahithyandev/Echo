import { fingerprintFile } from "../../bindings/chromaprint";
import { tracks } from "../../db/schema";
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
		artist: tags.artist ?? tags.ARTIST ?? null,
		album: tags.album ?? tags.ALBUM ?? null,
		track_number: tags.track ? Number.parseInt(tags.track, 10) : null,
		year: tags.date ? Number.parseInt(tags.date, 10) : null,
		genre: tags.genre ?? tags.GENRE ?? null,
		duration_seconds: duration > 0 ? Math.round(duration) : null,
	};
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
				await client
					.insert(tracks)
					.values({ ...meta, file_path: file, fingerprint })
					.onConflictDoUpdate({
						target: tracks.file_path,
						set: { ...meta, fingerprint },
					});
				count++;
			} catch (err) {
				console.warn(`Skipped ${file}:`, err);
			}
		}
		return count;
	}
}
