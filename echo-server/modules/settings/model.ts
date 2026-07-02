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

	export const PlaybackBody = t.Object({
		track_id: t.Nullable(t.Integer()),
		position_seconds: t.Nullable(t.Integer()),
		playing: t.Boolean(),
	});
	export type PlaybackBody = typeof PlaybackBody.static;

	export const HeartbeatBody = t.Object({
		track_id: t.Integer(),
		seconds: t.Number({ minimum: 0, maximum: 15 }),
	});
	export type HeartbeatBody = typeof HeartbeatBody.static;
}
