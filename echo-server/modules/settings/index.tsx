import { Html } from "@elysiajs/html";
import { Elysia, t } from "elysia";
import type { DbLike } from "../../db/types";
import { SettingsPage } from "../../pages/settings";
import { unused } from "../../utils/misc";
import createAuthMiddleware from "../auth/middleware";
import { Auth } from "../auth/service";
import { LibraryService } from "../library/service";
import { SettingsModel } from "./model";
import { SettingsService } from "./service";

unused(Html);

export default function createSettingsModule(db: DbLike) {
	const authMiddleware = createAuthMiddleware(db);
	return new Elysia()
		.use(authMiddleware)
		.get(
			"/settings",
			async ({ currentUser, redirect, query, cookie }) => {
				if (!currentUser) return redirect("/auth/login");

				const user = await Auth.findUserById(db, currentUser.id);
				const sessions = await Auth.listUserSessions(db, currentUser.id);
				const currentTokenHash = Auth.hashToken(
					(cookie as Record<string, { value?: string }>).session?.value ?? "",
				);

				const [users, stats, dirs] = user.is_admin
					? await Promise.all([
							Auth.listUsers(db),
							SettingsService.getStats(db),
							SettingsService.getDirs(db),
						])
					: [undefined, undefined, undefined];

				return (
					<SettingsPage
						user={user}
						sessions={sessions}
						currentTokenHash={currentTokenHash}
						users={users}
						stats={
							stats &&
							dirs && {
								...stats,
								musicDir: dirs.musicDir,
								dataDir: dirs.dataDir,
							}
						}
						ok={typeof query.ok === "string" ? query.ok : undefined}
						error={typeof query.error === "string" ? query.error : undefined}
					/>
				);
			},
			{ currentUser: true },
		)
		.post(
			"/settings/profile",
			async ({ currentUser, redirect, body }) => {
				if (!currentUser) return redirect("/auth/login");
				await Auth.updateName(db, currentUser.id, body.name);
				return redirect("/settings?ok=profile");
			},
			{ currentUser: true, body: SettingsModel.ProfileBody },
		)
		.post(
			"/settings/password",
			async ({ currentUser, redirect, body }) => {
				if (!currentUser) return redirect("/auth/login");
				try {
					const valid = await Auth.verifyPassword(
						db,
						currentUser.id,
						body.current_password,
					);
					if (!valid) return redirect("/settings?error=password");
					const hashed = await Bun.password.hash(body.new_password);
					await Auth.updatePassword(db, currentUser.id, hashed);
					return redirect("/settings?ok=password");
				} catch {
					return redirect("/settings?error=password");
				}
			},
			{ currentUser: true, body: SettingsModel.PasswordChangeBody },
		)
		.post(
			"/settings/sessions/:id/revoke",
			async ({ currentUser, redirect, params }) => {
				if (!currentUser) return redirect("/auth/login");
				await Auth.revokeSessionById(db, currentUser.id, Number(params.id));
				return redirect("/settings?ok=session-revoked");
			},
			{ currentUser: true, params: t.Object({ id: t.String() }) },
		)
		.post(
			"/settings/sessions/revoke-others",
			async ({ currentUser, redirect, cookie }) => {
				if (!currentUser) return redirect("/auth/login");
				const currentTokenHash = Auth.hashToken(
					(cookie as Record<string, { value?: string }>).session?.value ?? "",
				);
				await Auth.revokeOtherSessions(db, currentUser.id, currentTokenHash);
				return redirect("/settings?ok=sessions-revoked");
			},
			{ currentUser: true },
		)
		.post(
			"/settings/admin/users",
			async ({ currentUser, redirect, status, body }) => {
				if (!currentUser) return redirect("/auth/login");
				const user = await Auth.findUserById(db, currentUser.id);
				if (!user.is_admin) return status(403);
				try {
					await Auth.createUser(db, {
						email: body.email,
						name: body.name,
						password: body.password,
						isAdmin: body.is_admin ?? false,
					});
					return redirect("/settings?ok=user-created");
				} catch {
					return redirect("/settings?error=user-create");
				}
			},
			{ currentUser: true, body: SettingsModel.CreateUserBody },
		)
		.post(
			"/settings/admin/users/:id/admin",
			async ({ currentUser, redirect, status, params, body }) => {
				if (!currentUser) return redirect("/auth/login");
				const user = await Auth.findUserById(db, currentUser.id);
				if (!user.is_admin) return status(403);
				const targetId = Number(params.id);
				if (targetId === currentUser.id)
					return redirect("/settings?error=self");
				if (!body.is_admin && (await Auth.activeAdminCount(db)) <= 1) {
					return redirect("/settings?error=last-admin");
				}
				await Auth.setAdmin(db, targetId, body.is_admin);
				return redirect("/settings?ok=user-updated");
			},
			{
				currentUser: true,
				params: t.Object({ id: t.String() }),
				body: t.Object({ is_admin: t.BooleanString() }),
			},
		)
		.post(
			"/settings/admin/users/:id/active",
			async ({ currentUser, redirect, status, params, body }) => {
				if (!currentUser) return redirect("/auth/login");
				const user = await Auth.findUserById(db, currentUser.id);
				if (!user.is_admin) return status(403);
				const targetId = Number(params.id);
				if (targetId === currentUser.id)
					return redirect("/settings?error=self");
				if (!body.is_active && (await Auth.activeAdminCount(db)) <= 1) {
					const target = (await Auth.listUsers(db)).find(
						(u) => u.id === targetId,
					);
					if (target?.is_admin) return redirect("/settings?error=last-admin");
				}
				await Auth.setActive(db, targetId, body.is_active);
				return redirect("/settings?ok=user-updated");
			},
			{
				currentUser: true,
				params: t.Object({ id: t.String() }),
				body: t.Object({ is_active: t.BooleanString() }),
			},
		)
		.post(
			"/settings/admin/rescan",
			async ({ currentUser, redirect, status }) => {
				if (!currentUser) return redirect("/auth/login");
				const user = await Auth.findUserById(db, currentUser.id);
				if (!user.is_admin) return status(403);
				const { musicDir, dataDir } = await SettingsService.getDirs(db);
				const artDir = `${dataDir}/art`;
				LibraryService.scanMusicFolder(db, musicDir, artDir).then((n) =>
					console.log(`Rescanned ${n} tracks from ${musicDir}`),
				);
				return redirect("/settings?ok=rescan");
			},
			{ currentUser: true },
		)
		.post(
			"/settings/admin/dirs",
			async ({ currentUser, redirect, status, body }) => {
				if (!currentUser) return redirect("/auth/login");
				const user = await Auth.findUserById(db, currentUser.id);
				if (!user.is_admin) return status(403);
				await SettingsService.setDirs(db, body.music_dir, body.data_dir);
				const artDir = `${body.data_dir}/art`;
				LibraryService.scanMusicFolder(db, body.music_dir, artDir).then((n) =>
					console.log(`Rescanned ${n} tracks from ${body.music_dir}`),
				);
				return redirect("/settings?ok=dirs");
			},
			{ currentUser: true, body: SettingsModel.DirsBody },
		)
		.get(
			"/playback/settings",
			async ({ currentUser, status }) => {
				if (!currentUser) return status(401);
				return SettingsService.getSettings(db, currentUser.id);
			},
			{ currentUser: true },
		)
		.put(
			"/playback/settings",
			async ({ currentUser, status, body }) => {
				if (!currentUser) return status(401);
				await SettingsService.updateSettings(db, currentUser.id, body);
				return body;
			},
			{ currentUser: true, body: SettingsModel.SettingsBody },
		)
		.post(
			"/history",
			async ({ currentUser, status, body }) => {
				if (!currentUser) return status(401);
				await SettingsService.recordHistory(db, currentUser.id, body.track_id);
				return status(204);
			},
			{ currentUser: true, body: t.Object({ track_id: t.Integer() }) },
		)
		.post(
			"/playback/sync",
			async ({ currentUser, status, body }) => {
				if (!currentUser) return status(401);
				await SettingsService.syncPlayback(db, currentUser.id, body);
				return status(204);
			},
			{ currentUser: true, body: SettingsModel.PlaybackSyncBody },
		);
}
