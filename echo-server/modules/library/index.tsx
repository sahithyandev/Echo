import { Html } from "@elysiajs/html";
import { Elysia } from "elysia";
import type { DbLike } from "../../db/types";
import { LibraryPage } from "../../pages/library";
import { unused } from "../../utils/misc";
import createAuthMiddleware from "../auth/middleware";
import { Auth } from "../auth/service";
import { SettingsService } from "../settings/service";
import { buildRangeResponse, LibraryService } from "./service";

unused(Html);

export default function createLibraryModule(db: DbLike) {
	const authMiddleware = createAuthMiddleware(db);
	return new Elysia()
		.use(authMiddleware)
		.get(
			"/library",
			async ({ currentUser, redirect }) => {
				if (!currentUser) return redirect("/auth/login");
				const [user, tracks] = await Promise.all([
					Auth.findUserById(db, currentUser.id),
					LibraryService.listTracks(db),
				]);
				return <LibraryPage name={user.name} tracks={tracks} />;
			},
			{ currentUser: true },
		)
		.get("/art/:albumId", async ({ params }) => {
			const { dataDir } = await SettingsService.getDirs(db);
			const file = Bun.file(`${dataDir}/art/${params.albumId}.jpg`);
			return new Response(file, { headers: { "Content-Type": "image/jpeg" } });
		})
		.get(
			"/track/:id",
			async ({ currentUser, redirect, params }) => {
				if (!currentUser) return redirect("/auth/login");
				const track = await LibraryService.findTrackEntryById(
					db,
					Number(params.id),
				);
				if (!track) return new Response("Not found", { status: 404 });
				return track;
			},
			{ currentUser: true },
		)
		.get(
			"/track/:id/stream",
			async ({ currentUser, redirect, params, request }) => {
				if (!currentUser) return redirect("/auth/login");
				const track = await LibraryService.findTrackById(db, Number(params.id));
				if (!track) return new Response("Not found", { status: 404 });

				const file = Bun.file(track.file_path);
				if (!(await file.exists()))
					return new Response("Not found", { status: 404 });

				return buildRangeResponse(file, request.headers.get("Range"));
			},
			{ currentUser: true },
		);
}
