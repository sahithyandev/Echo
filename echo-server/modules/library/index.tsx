import { Html } from "@elysiajs/html";
import { Elysia, t } from "elysia";
import type { DbLike } from "../../db/types";
import { LibraryPage } from "../../pages/library";
import { unused } from "../../utils/misc";
import createAuthMiddleware from "../auth/middleware";
import { Auth } from "../auth/service";
import { SettingsService } from "../settings/service";
import {
	AUDIO_EXTENSIONS,
	buildRangeResponse,
	LibraryService,
} from "./service";

unused(Html);

export default function createLibraryModule(db: DbLike) {
	const authMiddleware = createAuthMiddleware(db);
	return new Elysia()
		.use(authMiddleware)
		.get(
			"/library",
			async ({ currentUser, redirect, query }) => {
				if (!currentUser) return redirect("/auth/login");
				const [user, tracks] = await Promise.all([
					Auth.findUserById(db, currentUser.id),
					LibraryService.listTracks(db),
				]);
				return (
					<LibraryPage
						name={user.name}
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
			"/track/:id/delete",
			async ({ currentUser, redirect, status, params }) => {
				if (!currentUser) return redirect("/auth/login");
				const user = await Auth.findUserById(db, currentUser.id);
				if (!user.is_admin) return status(403);
				await LibraryService.deleteTrack(db, Number(params.id));
				return redirect("/library");
			},
			{ currentUser: true },
		)
		.post(
			"/library/upload",
			async ({ currentUser, redirect, status, body }) => {
				if (!currentUser) return redirect("/auth/login");
				const user = await Auth.findUserById(db, currentUser.id);
				if (!user.is_admin) return status(403);

				const { musicDir, dataDir } = await SettingsService.getDirs(db);
				const uploadedPaths: string[] = [];
				for (const file of body.files) {
					const name = file.name.replace(/^.*[/\\]/, "");
					if (
						!AUDIO_EXTENSIONS.some((ext) =>
							name.toLowerCase().endsWith(`.${ext}`),
						)
					)
						continue;
					const dest = `${musicDir}/${name}`;
					if (await Bun.file(dest).exists()) continue;
					await Bun.write(dest, file);
					uploadedPaths.push(dest);
				}
				if (uploadedPaths.length === 0)
					return redirect("/library?error=upload");

				const artDir = `${dataDir}/art`;
				LibraryService.scanFiles(db, uploadedPaths, artDir).then((n) =>
					console.log(`Scanned ${n} newly uploaded tracks`),
				);
				return redirect("/library?ok=upload");
			},
			{
				currentUser: true,
				body: t.Object({ files: t.Files({ minItems: 1 }) }),
			},
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
