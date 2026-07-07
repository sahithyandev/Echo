import { sql } from "drizzle-orm";
import {
	check,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	password: text("password").notNull(),
	is_admin: integer("is_admin", { mode: "boolean" }).default(false).notNull(),
	is_active: integer("is_active", { mode: "boolean" }).default(true).notNull(),
	shuffle: integer("shuffle", { mode: "boolean" }).default(false).notNull(),
	repeat_mode: text("repeat_mode").default("off").notNull(),
	subsonic_password: text("subsonic_password"),
	verified_at: integer("verified_at", { mode: "timestamp" }),
	created_at: integer("created_at", { mode: "timestamp" })
		.$defaultFn(() => new Date())
		.notNull(),
});

export const user_sessions = sqliteTable("user_sessions", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	user_id: integer("user_id")
		.notNull()
		.references(() => users.id),
	token_hash: text("token_hash").notNull(),
	ip_address: text("ip_address"),
	user_agent: text("user_agent"),
	created_at: integer("created_at", { mode: "timestamp" })
		.$defaultFn(() => new Date())
		.notNull(),
	last_active_at: integer("last_active_at", { mode: "timestamp" })
		.$defaultFn(() => new Date())
		.notNull(),
	revoked_at: integer("revoked_at", { mode: "timestamp" }),
});

export const artists = sqliteTable("artists", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull().unique(),
});

export const albums = sqliteTable("albums", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	title: text("title").notNull(),
	year: integer("year"),
	genre: text("genre"),
	cover_path: text("cover_path"),
});

export const tracks = sqliteTable("tracks", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	title: text("title").notNull(),
	album_id: integer("album_id").references(() => albums.id),
	track_number: integer("track_number"),
	year: integer("year"),
	duration_seconds: integer("duration_seconds"),
	file_path: text("file_path").notNull().unique(),
	file_mtime: integer("file_mtime"),
	fingerprint: text("fingerprint"),
	added_at: integer("added_at", { mode: "timestamp" })
		.$defaultFn(() => new Date())
		.notNull(),
	added_by: integer("added_by").references(() => users.id),
});

export const app_settings = sqliteTable(
	"app_settings",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		music_dir: text("music_dir"),
		data_dir: text("data_dir"),
	},
	(t) => [check("app_settings_singleton", sql`${t.id} = 1`)],
);

export const user_playback_state = sqliteTable("user_playback_state", {
	user_id: integer("user_id")
		.primaryKey()
		.references(() => users.id),
	track_id: integer("track_id").references(() => tracks.id),
	position_seconds: integer("position_seconds"),
	playing: integer("playing", { mode: "boolean" }).default(false).notNull(),
});

export const play_history = sqliteTable("play_history", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	user_id: integer("user_id")
		.notNull()
		.references(() => users.id),
	track_id: integer("track_id")
		.notNull()
		.references(() => tracks.id),
	played_at: integer("played_at", { mode: "timestamp" })
		.$defaultFn(() => new Date())
		.notNull(),
});

export const listening = sqliteTable(
	"listening",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		user_id: integer("user_id")
			.notNull()
			.references(() => users.id),
		track_id: integer("track_id")
			.notNull()
			.references(() => tracks.id),
		seconds: integer("seconds").notNull(),
		day: text("day").notNull(),
		created_at: integer("created_at", { mode: "timestamp" })
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(t) => [
		uniqueIndex("listening_day_user_track").on(t.day, t.user_id, t.track_id),
	],
);

export const album_artists = sqliteTable(
	"album_artists",
	{
		album_id: integer("album_id")
			.notNull()
			.references(() => albums.id),
		artist_id: integer("artist_id")
			.notNull()
			.references(() => artists.id),
	},
	(t) => [primaryKey({ columns: [t.album_id, t.artist_id] })],
);

export const track_artists = sqliteTable(
	"track_artists",
	{
		track_id: integer("track_id")
			.notNull()
			.references(() => tracks.id),
		artist_id: integer("artist_id")
			.notNull()
			.references(() => artists.id),
	},
	(t) => [primaryKey({ columns: [t.track_id, t.artist_id] })],
);
