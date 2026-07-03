import { makeId } from "./ids";
import type { AlbumRow, SongRow } from "./queries";

const MIME_TYPES: Record<string, string> = {
	mp3: "audio/mpeg",
	flac: "audio/flac",
	m4a: "audio/mp4",
	aac: "audio/aac",
	ogg: "audio/ogg",
	wav: "audio/wav",
};

/** Builds a Subsonic `child`/song entry, deriving suffix/contentType/size/bitRate from the file. */
export function buildSong(
	row: SongRow,
	opts: { artist?: string; playCount?: number } = {},
): Record<string, unknown> {
	const suffix = row.file_path.split(".").pop()?.toLowerCase() ?? "";
	const file = Bun.file(row.file_path);
	const size = file.size;
	const bitRate =
		row.duration_seconds && size
			? Math.round((size * 8) / 1000 / row.duration_seconds)
			: undefined;

	return {
		id: makeId("tr", row.id),
		parent: row.album_id ? makeId("al", row.album_id) : undefined,
		title: row.title,
		album: row.album_title ?? undefined,
		artist: opts.artist,
		track: row.track_number ?? undefined,
		year: row.year ?? undefined,
		genre: row.genre ?? undefined,
		coverArt: row.album_id ? makeId("al", row.album_id) : undefined,
		size,
		contentType: MIME_TYPES[suffix] ?? "application/octet-stream",
		suffix,
		duration: row.duration_seconds ?? undefined,
		bitRate,
		playCount: opts.playCount ?? 0,
		albumId: row.album_id ? makeId("al", row.album_id) : undefined,
		artistId: undefined,
		type: "music",
		isDir: false,
		isVideo: false,
	};
}

/** Builds a Subsonic album summary (no songs) for list endpoints. */
export function buildAlbum(
	row: AlbumRow,
	opts: {
		artist?: string;
		artistId?: number;
		songCount?: number;
		duration?: number;
	},
): Record<string, unknown> {
	return {
		id: makeId("al", row.id),
		name: row.title,
		artist: opts.artist,
		artistId: opts.artistId ? makeId("ar", opts.artistId) : undefined,
		coverArt: makeId("al", row.id),
		songCount: opts.songCount ?? 0,
		duration: opts.duration ?? 0,
		year: row.year ?? undefined,
		genre: row.genre ?? undefined,
		isDir: false,
	};
}
