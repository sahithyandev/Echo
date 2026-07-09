import { unlink } from "node:fs/promises";
import { Html } from "@elysiajs/html";
import { Elysia, t } from "elysia";
import type { DbLike } from "../../db/types";
import { LibraryPage, TrackGroups } from "../../pages/library";
import { unused } from "../../utils/misc";
import createAuthMiddleware from "../auth/middleware";
import { Auth } from "../auth/service";
import { SettingsService } from "../settings/service";
import {
	AUDIO_EXTENSIONS,
	buildRangeResponse,
	LIBRARY_PAGE_SIZE,
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
					LibraryService.listTracksPage(db, 0, LIBRARY_PAGE_SIZE),
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
		.get(
			"/library/tracks",
			async ({ currentUser, status, query }) => {
				if (!currentUser) return status(401);
				const user = await Auth.findUserById(db, currentUser.id);
				const offset = Math.max(0, Number(query.offset) || 0);
				const tracks = await LibraryService.listTracksPage(
					db,
					offset,
					LIBRARY_PAGE_SIZE,
				);
				const nextOffset = offset + tracks.length;
				const hasMore = tracks.length >= LIBRARY_PAGE_SIZE;
				return (
					<>
						<TrackGroups tracks={tracks} isAdmin={user.is_admin} />
						{hasMore && (
							<div id="library-sentinel" data-offset={String(nextOffset)} />
						)}
					</>
				);
			},
			{
				currentUser: true,
				query: t.Object({ offset: t.Optional(t.String()) }),
			},
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
			"/track/:id/rename",
			async ({ currentUser, redirect, status, params, body }) => {
				if (!currentUser) return redirect("/auth/login");
				const user = await Auth.findUserById(db, currentUser.id);
				if (!user.is_admin) return status(403);
				const returnTo = body.return ?? "/library";
				try {
					await LibraryService.renameTrack(db, Number(params.id), body.title);
					return redirect(`${returnTo}?ok=rename`);
				} catch (err) {
					console.error(`Rename failed for track ${params.id}:`, err);
					return redirect(`${returnTo}?error=rename`);
				}
			},
			{
				currentUser: true,
				body: t.Object({
					title: t.String({ minLength: 1 }),
					return: t.Optional(t.String()),
				}),
			},
		)
		.post(
			"/library/upload",
			async ({ currentUser, redirect, status, body }) => {
				if (!currentUser) return redirect("/auth/login");
				const user = await Auth.findUserById(db, currentUser.id);
				if (!user.is_admin) return status(403);

				const { musicDir, dataDir } = await SettingsService.getDirs(db);
				console.log(
					`Upload: received ${body.files.length} file(s) from user ${user.id}`,
				);
				const uploadedPaths: string[] = [];
				const seenFingerprints = new Set<string>();
				for (const file of body.files) {
					const name = file.name.replace(/^.*[/\\]/, "");
					if (
						!AUDIO_EXTENSIONS.some((ext) =>
							name.toLowerCase().endsWith(`.${ext}`),
						)
					) {
						console.warn(`Upload: skipping "${name}" — unsupported extension`);
						continue;
					}
					const dest = `${musicDir}/${name}`;
					if (await Bun.file(dest).exists()) {
						console.warn(
							`Upload: skipping "${name}" — a file already exists at ${dest}`,
						);
						continue;
					}
					try {
						await Bun.write(dest, file);
					} catch (err) {
						console.error(`Upload: failed writing "${name}" to ${dest}:`, err);
						continue;
					}
					if (
						await LibraryService.isDuplicateContent(db, dest, seenFingerprints)
					) {
						console.warn(
							`Upload: skipping "${name}" — duplicate of an existing track`,
						);
						await unlink(dest);
						continue;
					}
					uploadedPaths.push(dest);
				}

				console.log(
					`Upload: accepted ${uploadedPaths.length}/${body.files.length} file(s)`,
				);
				if (uploadedPaths.length > 0) {
					const artDir = `${dataDir}/art`;
					LibraryService.scanFiles(db, uploadedPaths, artDir)
						.then((n) => console.log(`Scanned ${n} newly uploaded tracks`))
						.catch((err) => console.error("Upload: scan failed:", err));
				}
				return { uploaded: uploadedPaths.length };
			},
			{
				currentUser: true,
				body: t.Object({ files: t.Files({ minItems: 1 }) }),
			},
		)
		.get("/art/:albumId", async ({ params, headers }) => {
			const { dataDir } = await SettingsService.getDirs(db);
			const fullPath = `${dataDir}/art/${params.albumId}.jpg`;
			if (!(await Bun.file(fullPath).exists()))
				return new Response("Not found", { status: 404 });

			let path = fullPath;

			const thumbPath = `${dataDir}/art/${params.albumId}.thumb.jpg`;

			if (await Bun.file(thumbPath).exists()) {
				path = thumbPath;
			} else {
				const result =
					await Bun.$`ffmpeg -y -i ${fullPath} -vf scale=256:-1 ${thumbPath}`.quiet();
				if (result.exitCode === 0) path = thumbPath;
			}

			const file = Bun.file(path);
			const etag = `"${file.lastModified.toString(36)}-${file.size.toString(36)}"`;
			if (headers["if-none-match"] === etag)
				return new Response(null, { status: 304 });

			return new Response(file, {
				headers: {
					"Content-Type": "image/jpeg",
					"Cache-Control": "public, max-age=86400",
					ETag: etag,
				},
			});
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
