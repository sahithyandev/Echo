import { t } from "elysia";
import { AuthModel } from "../auth/model";

export namespace SettingsModel {
	export const ProfileBody = t.Object({ name: t.String({ minLength: 1 }) });
	export type ProfileBody = typeof ProfileBody.static;

	export const PasswordChangeBody = t.Object({
		current_password: t.String(),
		new_password: t.String({ pattern: AuthModel.PasswordPattern.source }),
	});
	export type PasswordChangeBody = typeof PasswordChangeBody.static;

	export const SignupConfigBody = t.Object({
		mode: t.Union([
			t.Literal("closed"),
			t.Literal("open"),
			t.Literal("allowlist"),
		]),
		allowed_emails: t.Optional(t.String()),
	});
	export type SignupConfigBody = typeof SignupConfigBody.static;

	export const SiteNameBody = t.Object({
		site_name: t.String({ minLength: 1, maxLength: 60 }),
	});
	export type SiteNameBody = typeof SiteNameBody.static;

	export const DirsBody = t.Object({
		music_dir: t.String({ minLength: 1 }),
		data_dir: t.String({ minLength: 1 }),
	});
	export type DirsBody = typeof DirsBody.static;

	export const SettingsBody = t.Object({
		shuffle: t.Boolean(),
		repeat_mode: t.Union([
			t.Literal("off"),
			t.Literal("all"),
			t.Literal("one"),
		]),
	});
	export type SettingsBody = typeof SettingsBody.static;

	export const SubsonicPasswordBody = t.Object({
		subsonic_password: t.String(),
	});
	export type SubsonicPasswordBody = typeof SubsonicPasswordBody.static;

	export const PlaybackSyncBody = t.Object({
		track_id: t.Nullable(t.Integer()),
		seconds: t.Number({ minimum: 0, maximum: 15 }),
		position_seconds: t.Optional(t.Nullable(t.Integer())),
		playing: t.Optional(t.Boolean()),
	});
	export type PlaybackSyncBody = typeof PlaybackSyncBody.static;
}
