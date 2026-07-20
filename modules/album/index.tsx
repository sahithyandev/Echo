import { Html } from "@elysiajs/html";
import { Elysia, t } from "elysia";
import type { DbLike } from "../../db/types";
import { AlbumPage } from "../../pages/album";
import { AlbumsPage } from "../../pages/albums";
import { unused } from "../../utils/misc";
import { AnalyticsService } from "../analytics/service";
import createAuthMiddleware from "../auth/middleware";
import { Auth } from "../auth/service";
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
			async ({ currentUser, redirect, params, query }) => {
				if (!currentUser) return redirect("/auth/login");
				const albumId = Number(params.id);
				const isNoAlbum = albumId === 0;
				const [user, album, tracks, artists] = await Promise.all([
					Auth.findUserById(db, currentUser.id),
					isNoAlbum
						? {
								id: 0,
								title: "No Album",
								year: null,
								genre: null,
								cover_path: null,
							}
						: AlbumService.findAlbum(db, albumId),
					isNoAlbum
						? AlbumService.getUnalbumedTracks(db)
						: AlbumService.getAlbumTracks(db, albumId),
					isNoAlbum ? [] : AlbumService.getAlbumArtists(db, albumId),
				]);
				if (!album) return redirect("/library");
				const playCounts = await AnalyticsService.getPlayCounts(
					db,
					currentUser.id,
					tracks.map((t) => t.id),
				);
				return (
					<AlbumPage
						album={album}
						tracks={tracks}
						artists={artists}
						playCounts={playCounts}
						isAdmin={user.is_admin}
						ok={typeof query.ok === "string" ? query.ok : undefined}
						error={typeof query.error === "string" ? query.error : undefined}
					/>
				);
			},
			{ currentUser: true },
		)
		.post(
			"/album/:id/rename",
			async ({ currentUser, redirect, status, params, body }) => {
				if (!currentUser) return redirect("/auth/login");
				const user = await Auth.findUserById(db, currentUser.id);
				if (!user.is_admin) return status(403);
				const id = Number(params.id);
				try {
					const result = await AlbumService.renameAlbum(db, id, body.title);
					const flag = result.merged ? "merge" : "rename";
					return redirect(`/album/${result.id}?ok=${flag}`);
				} catch {
					return redirect(`/album/${id}?error=rename`);
				}
			},
			{
				currentUser: true,
				body: t.Object({ title: t.String({ minLength: 1 }) }),
			},
		);
}
