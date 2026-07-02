import { t } from "elysia";

export namespace SettingsModel {
	export const SettingsBody = t.Object({
		shuffle: t.Boolean(),
		repeat_mode: t.Union([
			t.Literal("off"),
			t.Literal("all"),
			t.Literal("one"),
		]),
	});
	export type SettingsBody = typeof SettingsBody.static;

	export const PlaybackSyncBody = t.Object({
		track_id: t.Nullable(t.Integer()),
		seconds: t.Number({ minimum: 0, maximum: 15 }),
		position_seconds: t.Optional(t.Nullable(t.Integer())),
		playing: t.Optional(t.Boolean()),
	});
	export type PlaybackSyncBody = typeof PlaybackSyncBody.static;
}
