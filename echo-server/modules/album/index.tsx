import { Html } from "@elysiajs/html";
import { Elysia } from "elysia";
import type { DbLike } from "../../db/types";
import { AlbumPage } from "../../pages/album";
import { AlbumsPage } from "../../pages/albums";
import { unused } from "../../utils/misc";
import createAuthMiddleware from "../auth/middleware";
import { AlbumService } from "./service";

unused(Html);

export default function createAlbumModule(db: DbLike) {
	return new Elysia()
		.use(createAuthMiddleware(db))
		.get(
			"/albums",
			async ({ currentUser, redirect }) => {
				if (!currentUser) return redirect("/auth/login");
				const albums = await AlbumService.listAlbums(db);
				return <AlbumsPage albums={albums} />;
			},
			{ currentUser: true },
		)
		.get(
			"/album/:id",
			async ({ currentUser, redirect, params }) => {
				if (!currentUser) return redirect("/auth/login");
				const albumId = Number(params.id);
				const [album, tracks, artists] = await Promise.all([
					AlbumService.findAlbum(db, albumId),
					AlbumService.getAlbumTracks(db, albumId),
					AlbumService.getAlbumArtists(db, albumId),
				]);
				if (!album) return redirect("/library");
				return <AlbumPage album={album} tracks={tracks} artists={artists} />;
			},
			{ currentUser: true },
		);
}
