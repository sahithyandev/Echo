import { Elysia, t } from "elysia";
import type { DbLike } from "../../db/types";
import createAuthMiddleware from "../auth/middleware";
import { SettingsModel } from "./model";
import { SettingsService } from "./service";

export default function createSettingsModule(db: DbLike) {
	const authMiddleware = createAuthMiddleware(db);
	return new Elysia()
		.use(authMiddleware)
		.get(
			"/settings",
			async ({ currentUser, status }) => {
				if (!currentUser) return status(401);
				return SettingsService.getSettings(db, currentUser.id);
			},
			{ currentUser: true },
		)
		.put(
			"/settings",
			async ({ currentUser, status, body }) => {
				if (!currentUser) return status(401);
				await SettingsService.updateSettings(db, currentUser.id, body);
				return body;
			},
			{ currentUser: true, body: SettingsModel.SettingsBody },
		)
		.put(
			"/settings/playback",
			async ({ currentUser, status, body }) => {
				if (!currentUser) return status(401);
				await SettingsService.updatePlayback(db, currentUser.id, body);
				return body;
			},
			{ currentUser: true, body: SettingsModel.PlaybackBody },
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
			"/playback/heartbeat",
			async ({ currentUser, status, body }) => {
				if (!currentUser) return status(401);
				if (body.seconds <= 0) return status(204);
				await SettingsService.recordHeartbeat(db, currentUser.id, body);
				return status(204);
			},
			{ currentUser: true, body: SettingsModel.HeartbeatBody },
		);
}
