import { Html, html } from "@elysiajs/html";
import staticPlugin from "@elysiajs/static";
import tailwind from "bun-plugin-tailwind";
import { Elysia } from "elysia";
import type { DbLike } from "../db/types";
import createAuthModule from "../modules/auth";
import createAuthMiddleware from "../modules/auth/middleware";
import { Auth } from "../modules/auth/service";
import { LibraryService } from "../modules/library/service";
import { AlbumPage } from "../pages/album";
import { ArtistPage } from "../pages/artist";
import { IndexPage } from "../pages/index";
import { LibraryPage } from "../pages/library";
import { LoginPage } from "../pages/login";
import { unused } from "./misc";

unused(Html);

export async function createApp(db: DbLike) {
	const cssPath = new URL("../styles.css", import.meta.url).pathname;
	const cssBuild = await Bun.build({
		entrypoints: [cssPath],
		plugins: [tailwind],
	});
	if (!cssBuild.success)
		throw new Error(`CSS build failed: ${cssBuild.logs.join("\n")}`);
	const css = await cssBuild.outputs[0].text();

	const authMiddleware = createAuthMiddleware(db);
	return new Elysia()
		.use(html())
		.get(
			"/global.css",
			() =>
				new Response(css, {
					headers: { "content-type": "text/css; charset=utf-8" },
				}),
		)
		.use(await staticPlugin({ prefix: "/" }))
		.use(authMiddleware)
		.get("/", () => <IndexPage />)
		.get(
			"/login",
			async ({ currentUser, redirect, query }) => {
				if (currentUser) return redirect("/library");
				const usersCount = await Auth.userCount(db);

				const register = usersCount === 0;
				return <LoginPage register={register} error={!!query.error} />;
			},
			{ currentUser: true },
		)
		.get(
			"/library",
			async ({ currentUser, redirect }) => {
				if (!currentUser) return redirect("/login");
				const [user, tracks] = await Promise.all([
					Auth.findUserById(db, currentUser.id),
					LibraryService.listTracks(db),
				]);
				return <LibraryPage name={user.name} tracks={tracks} />;
			},
			{ currentUser: true },
		)
		.get(
			"/artist/:id",
			async ({ currentUser, redirect, params }) => {
				if (!currentUser) return redirect("/login");
				const artistId = Number(params.id);
				const [artist, tracks] = await Promise.all([
					LibraryService.findArtist(db, artistId),
					LibraryService.getArtistTracks(db, artistId),
				]);
				if (!artist) return redirect("/library");
				return <ArtistPage artist={artist} tracks={tracks} />;
			},
			{ currentUser: true },
		)
		.get(
			"/album/:id",
			async ({ currentUser, redirect, params }) => {
				if (!currentUser) return redirect("/login");
				const albumId = Number(params.id);
				const [album, tracks, artistNames] = await Promise.all([
					LibraryService.findAlbum(db, albumId),
					LibraryService.getAlbumTracks(db, albumId),
					LibraryService.getAlbumArtists(db, albumId),
				]);
				if (!album) return redirect("/library");
				return (
					<AlbumPage album={album} tracks={tracks} artists={artistNames} />
				);
			},
			{ currentUser: true },
		)
		.use(createAuthModule(db));
}

export type App = Awaited<ReturnType<typeof createApp>>;
