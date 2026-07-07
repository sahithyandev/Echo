import { Html } from "@elysiajs/html";
import { Elysia, t } from "elysia";
import type { DbLike } from "../../db/types";
import { ArtistPage } from "../../pages/artist";
import { ArtistsPage } from "../../pages/artists";
import { unused } from "../../utils/misc";
import createAuthMiddleware from "../auth/middleware";
import { Auth } from "../auth/service";
import { ArtistService } from "./service";

unused(Html);

export default function createArtistModule(db: DbLike) {
	return new Elysia()
		.use(createAuthMiddleware(db))
		.get(
			"/artists",
			async ({ currentUser, redirect }) => {
				if (!currentUser) return redirect("/auth/login");
				const artists = await ArtistService.listArtists(db);
				return <ArtistsPage artists={artists} />;
			},
			{ currentUser: true },
		)
		.get(
			"/artist/:id",
			async ({ currentUser, redirect, params, query }) => {
				if (!currentUser) return redirect("/auth/login");
				const artistId = Number(params.id);
				const [user, artist, tracks] = await Promise.all([
					Auth.findUserById(db, currentUser.id),
					ArtistService.findArtist(db, artistId),
					ArtistService.getArtistTracks(db, artistId),
				]);
				if (!artist) return redirect("/library");
				return (
					<ArtistPage
						artist={artist}
						tracks={tracks}
						isAdmin={user.is_admin}
						ok={typeof query.ok === "string" ? query.ok : undefined}
						error={typeof query.error === "string" ? query.error : undefined}
					/>
				);
			},
			{ currentUser: true },
		)
		.post(
			"/artist/:id/rename",
			async ({ currentUser, redirect, status, params, body }) => {
				if (!currentUser) return redirect("/auth/login");
				const user = await Auth.findUserById(db, currentUser.id);
				if (!user.is_admin) return status(403);
				const id = Number(params.id);
				try {
					const result = await ArtistService.renameArtist(db, id, body.name);
					const flag = result.merged ? "merge" : "rename";
					return redirect(`/artist/${result.id}?ok=${flag}`);
				} catch {
					return redirect(`/artist/${id}?error=rename`);
				}
			},
			{
				currentUser: true,
				body: t.Object({ name: t.String({ minLength: 1 }) }),
			},
		);
}
