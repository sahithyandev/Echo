import { describe, expect, it } from "bun:test";
import type { AlbumRow, SongRow } from "./queries";
import { buildAlbum, buildSong } from "./song";

const baseSong: SongRow = {
	id: 1,
	title: "Track One",
	track_number: 3,
	year: 2020,
	duration_seconds: 200,
	file_path: "/music/does-not-exist.mp3",
	album_id: 7,
	album_title: "The Album",
	album_cover_path: "/art/7.jpg",
	genre: "Electronic",
};

describe("buildSong", () => {
	it("derives suffix and contentType from the file extension", () => {
		const song = buildSong(baseSong);
		expect(song.suffix).toBe("mp3");
		expect(song.contentType).toBe("audio/mpeg");
	});

	it("falls back to octet-stream for an unknown extension", () => {
		const song = buildSong({ ...baseSong, file_path: "/music/track.xyz" });
		expect(song.suffix).toBe("xyz");
		expect(song.contentType).toBe("application/octet-stream");
	});

	it("maps ids using the al/tr prefixes", () => {
		const song = buildSong(baseSong);
		expect(song.id).toBe("tr-1");
		expect(song.parent).toBe("al-7");
		expect(song.albumId).toBe("al-7");
		expect(song.coverArt).toBe("al-7");
	});

	it("omits album-derived fields when there is no album", () => {
		const song = buildSong({ ...baseSong, album_id: null, album_title: null });
		expect(song.parent).toBeUndefined();
		expect(song.albumId).toBeUndefined();
		expect(song.coverArt).toBeUndefined();
	});

	it("passes through opts for artist and playCount", () => {
		const song = buildSong(baseSong, { artist: "Someone", playCount: 4 });
		expect(song.artist).toBe("Someone");
		expect(song.playCount).toBe(4);
	});

	it("defaults playCount to 0 when not provided", () => {
		const song = buildSong(baseSong);
		expect(song.playCount).toBe(0);
	});
});

const baseAlbum: AlbumRow = {
	id: 7,
	title: "The Album",
	year: 2020,
	genre: "Electronic",
	cover_path: "/art/7.jpg",
};

describe("buildAlbum", () => {
	it("maps id and coverArt using the al- prefix", () => {
		const album = buildAlbum(baseAlbum, {});
		expect(album.id).toBe("al-7");
		expect(album.coverArt).toBe("al-7");
		expect(album.name).toBe("The Album");
	});

	it("maps artistId when provided", () => {
		const album = buildAlbum(baseAlbum, { artist: "Artist A", artistId: 3 });
		expect(album.artist).toBe("Artist A");
		expect(album.artistId).toBe("ar-3");
	});

	it("omits artistId when not provided", () => {
		const album = buildAlbum(baseAlbum, {});
		expect(album.artistId).toBeUndefined();
	});

	it("defaults songCount and duration to 0", () => {
		const album = buildAlbum(baseAlbum, {});
		expect(album.songCount).toBe(0);
		expect(album.duration).toBe(0);
	});
});
