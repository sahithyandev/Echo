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

	export const CreateUserBody = t.Object({
		email: t.String({ format: "email" }),
		name: t.String({ minLength: 1 }),
		password: t.String({ pattern: AuthModel.PasswordPattern.source }),
		is_admin: t.Optional(t.BooleanString()),
	});
	export type CreateUserBody = typeof CreateUserBody.static;

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
