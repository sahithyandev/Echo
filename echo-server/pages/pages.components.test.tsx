import { describe, expect, it } from "bun:test";
import { Html } from "@elysiajs/html";
import { AlbumPage } from "./album";
import { AlbumsPage } from "./albums";
import { ArtistPage } from "./artist";
import { ArtistsPage } from "./artists";
import { IndexPage } from "./index";
import { LibraryPage } from "./library";
import { LoginPage } from "./login";

const album = {
	id: 1,
	title: "Dummy Album",
	year: 2020,
	genre: "Rock",
	cover_path: null,
};
const tracks = [
	{ id: 1, title: "Track One", duration_seconds: 185, track_number: 1 },
	{ id: 2, title: "Track Two", duration_seconds: null, track_number: null },
];

describe("AlbumPage", () => {
	it("renders album title", () => {
		const html = Html.createElement(AlbumPage, {
			album,
			tracks,
			artists: [{ id: 1, name: "Artist A" }],
		}) as string;
		expect(html).toContain("Dummy Album");
	});

	it("renders artists", () => {
		const html = Html.createElement(AlbumPage, {
			album,
			tracks,
			artists: [
				{ id: 1, name: "Artist A" },
				{ id: 2, name: "Artist B" },
			],
		}) as string;
		expect(html).toContain("Artist A");
		expect(html).toContain("Artist B");
	});

	it("renders year and genre", () => {
		const html = Html.createElement(AlbumPage, {
			album,
			tracks,
			artists: [],
		}) as string;
		expect(html).toContain("2020");
		expect(html).toContain("Rock");
	});

	it("omits year and genre when absent", () => {
		const bare = { ...album, year: null, genre: null };
		const html = Html.createElement(AlbumPage, {
			album: bare,
			tracks,
			artists: [],
		}) as string;
		expect(html).not.toContain("2020");
		expect(html).not.toContain("Rock");
	});

	it("renders track number and title", () => {
		const html = Html.createElement(AlbumPage, {
			album,
			tracks,
			artists: [],
		}) as string;
		expect(html).toContain("Track One");
	});

	it("shows em dash for missing track number", () => {
		const html = Html.createElement(AlbumPage, {
			album,
			tracks,
			artists: [],
		}) as string;
		expect(html).toContain("—");
	});
});

describe("ArtistPage", () => {
	const artist = { id: 1, name: "Artist A" };
	const artistTracks = [
		{ id: 1, title: "Song One", duration_seconds: 200 },
		{ id: 2, title: "Song Two", duration_seconds: 180 },
	];

	it("renders artist name", () => {
		const html = Html.createElement(ArtistPage, {
			artist,
			tracks: artistTracks,
		}) as string;
		expect(html).toContain("Artist A");
	});

	it("shows plural track count", () => {
		const html = Html.createElement(ArtistPage, {
			artist,
			tracks: artistTracks,
		}) as string;
		expect(html).toContain("2 tracks");
	});

	it("shows singular track count", () => {
		const html = Html.createElement(ArtistPage, {
			artist,
			tracks: [artistTracks[0]],
		}) as string;
		expect(html).toContain("1 track");
		expect(html).not.toContain("1 tracks");
	});

	it("renders track titles", () => {
		const html = Html.createElement(ArtistPage, {
			artist,
			tracks: artistTracks,
		}) as string;
		expect(html).toContain("Song One");
	});
});

describe("LibraryPage", () => {
	const fullTracks = [
		{
			id: 1,
			title: "My Song",
			duration_seconds: 210,
			artists: [{ id: 1, name: "Artist A" }],
			album: { id: 1, title: "My Album" },
		},
	];

	it("shows empty state when no tracks", () => {
		const html = Html.createElement(LibraryPage, {
			name: "Alice",
			tracks: [],
		}) as string;
		expect(html).toContain("Your library is empty");
	});

	it("renders tracks when present", () => {
		const html = Html.createElement(LibraryPage, {
			name: "Alice",
			tracks: fullTracks,
		}) as string;
		expect(html).toContain("My Song");
	});

	it("renders artist name", () => {
		const html = Html.createElement(LibraryPage, {
			name: "Alice",
			tracks: fullTracks,
		}) as string;
		expect(html).toContain("Artist A");
	});

	it("renders track card with data attributes", () => {
		const html = Html.createElement(LibraryPage, {
			name: "Alice",
			tracks: fullTracks,
		}) as string;
		expect(html).toContain('data-track-id="1"');
		expect(html).toContain("My Song");
	});

	it("shows em dash for missing artist", () => {
		const t = [{ ...fullTracks[0], artists: [] }];
		const html = Html.createElement(LibraryPage, {
			name: "Alice",
			tracks: t,
		}) as string;
		expect(html).toContain("—");
	});

	it("shows em dash for missing album", () => {
		const t = [{ ...fullTracks[0], album: null }];
		const html = Html.createElement(LibraryPage, {
			name: "Alice",
			tracks: t,
		}) as string;
		expect(html).toContain("—");
	});

	it("shows welcome with user name", () => {
		const html = Html.createElement(LibraryPage, {
			name: "Alice",
			tracks: [],
		}) as string;
		expect(html).toContain("Alice");
	});
});

describe("AlbumsPage", () => {
	it("shows empty state when no albums", () => {
		const html = Html.createElement(AlbumsPage, { albums: [] }) as string;
		expect(html).toContain("No albums yet");
	});

	it("renders album links", () => {
		const html = Html.createElement(AlbumsPage, {
			albums: [
				{ id: 1, title: "My Album", cover_path: null, artists: ["Artist A"] },
			],
		}) as string;
		expect(html).toContain("My Album");
		expect(html).toContain('href="/album/1"');
	});
});

describe("ArtistsPage", () => {
	it("shows empty state when no artists", () => {
		const html = Html.createElement(ArtistsPage, { artists: [] }) as string;
		expect(html).toContain("No artists yet");
	});

	it("renders artist links", () => {
		const html = Html.createElement(ArtistsPage, {
			artists: [{ id: 1, name: "Artist A" }],
		}) as string;
		expect(html).toContain("Artist A");
		expect(html).toContain('href="/artist/1"');
	});

	it("groups artists under letter headers", () => {
		const html = Html.createElement(ArtistsPage, {
			artists: [
				{ id: 1, name: "Adele" },
				{ id: 2, name: "Beck" },
			],
		}) as string;
		const aIndex = html.indexOf(">A<");
		const bIndex = html.indexOf(">B<");
		expect(aIndex).toBeGreaterThan(-1);
		expect(bIndex).toBeGreaterThan(aIndex);
	});
});

describe("LoginPage", () => {
	it("sign-in mode: correct heading and action", () => {
		const html = Html.createElement(LoginPage, { register: false }) as string;
		expect(html).toContain("Sign in");
		expect(html).toContain('action="/auth/sign-in"');
	});

	it("register mode: correct heading and action", () => {
		const html = Html.createElement(LoginPage, { register: true }) as string;
		expect(html).toContain("Create admin account");
		expect(html).toContain('action="/auth/sign-up"');
	});

	it("shows error message when error=true", () => {
		const html = Html.createElement(LoginPage, {
			register: false,
			error: true,
		}) as string;
		expect(html).toContain("Invalid email or password");
	});

	it("no error message by default", () => {
		const html = Html.createElement(LoginPage, { register: false }) as string;
		expect(html).not.toContain("Invalid email or password");
	});

	it("shows password hint in register mode", () => {
		const html = Html.createElement(LoginPage, { register: true }) as string;
		expect(html).toContain("8+");
	});
});

describe("IndexPage", () => {
	it("renders Echo heading", () => {
		const html = Html.createElement(IndexPage, {}) as string;
		expect(html).toContain("Echo");
	});

	it("has Open Library link", () => {
		const html = Html.createElement(IndexPage, {}) as string;
		expect(html).toContain('href="/library"');
		expect(html).toContain("Open Library");
	});
});
