import { Html } from "@elysiajs/html";
import { Elysia } from "elysia";
import type { DbLike } from "../../db/types";
import { ArtistPage } from "../../pages/artist";
import { unused } from "../../utils/misc";
import createAuthMiddleware from "../auth/middleware";
import { ArtistService } from "./service";

unused(Html);

export default function createArtistModule(db: DbLike) {
	return new Elysia().use(createAuthMiddleware(db)).get(
		"/artist/:id",
		async ({ currentUser, redirect, params }) => {
			if (!currentUser) return redirect("/login");
			const artistId = Number(params.id);
			const [artist, tracks] = await Promise.all([
				ArtistService.findArtist(db, artistId),
				ArtistService.getArtistTracks(db, artistId),
			]);
			if (!artist) return redirect("/library");
			return <ArtistPage artist={artist} tracks={tracks} />;
		},
		{ currentUser: true },
	);
}
