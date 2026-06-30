import { Html } from "@elysiajs/html";
import { Elysia } from "elysia";
import type { DbLike } from "../../db/types";
import { LibraryPage } from "../../pages/library";
import { getEnvVar } from "../../utils/env";
import { unused } from "../../utils/misc";
import createAuthMiddleware from "../auth/middleware";
import { Auth } from "../auth/service";
import { LibraryService } from "./service";

unused(Html);

export default function createLibraryModule(db: DbLike) {
	const artDir = `${getEnvVar("DATA_DIR")}/art`;
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
		.get("/art/:albumId", ({ params }) => {
			const file = Bun.file(`${artDir}/${params.albumId}.jpg`);
			return new Response(file, { headers: { "Content-Type": "image/jpeg" } });
		})
		.get(
			"/track/:id/stream",
			async ({ currentUser, redirect, params, request }) => {
				if (!currentUser) return redirect("/login");
				const track = await LibraryService.findTrackById(db, Number(params.id));
				if (!track) return new Response("Not found", { status: 404 });

				const file = Bun.file(track.file_path);
				const size = file.size;
				const rangeHeader = request.headers.get("Range");

				if (rangeHeader) {
					const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
					if (match) {
						const start = Number.parseInt(match[1], 10);
						const end = match[2] ? Number.parseInt(match[2], 10) : size - 1;
						return new Response(file.slice(start, end + 1), {
							status: 206,
							headers: {
								"Content-Range": `bytes ${start}-${end}/${size}`,
								"Accept-Ranges": "bytes",
								"Content-Length": String(end - start + 1),
								"Content-Type": file.type || "audio/mpeg",
							},
						});
					}
				}

				return new Response(file, {
					headers: {
						"Accept-Ranges": "bytes",
						"Content-Length": String(size),
						"Content-Type": file.type || "audio/mpeg",
					},
				});
			},
			{ currentUser: true },
		);
}
