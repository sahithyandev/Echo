CREATE TABLE `album_artists` (
	`album_id` integer NOT NULL,
	`artist_id` integer NOT NULL,
	CONSTRAINT `album_artists_pk` PRIMARY KEY(`album_id`, `artist_id`),
	CONSTRAINT `fk_album_artists_album_id_albums_id_fk` FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_album_artists_artist_id_artists_id_fk` FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `albums` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`title` text NOT NULL,
	`year` integer,
	`genre` text,
	`cover_path` text
);
--> statement-breakpoint
CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`music_dir` text,
	`data_dir` text,
	CONSTRAINT "app_settings_singleton" CHECK("id" = 1)
);
--> statement-breakpoint
CREATE TABLE `artists` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE `listening` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`track_id` integer NOT NULL,
	`seconds` integer NOT NULL,
	`day` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_listening_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_listening_track_id_tracks_id_fk` FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `play_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`track_id` integer NOT NULL,
	`played_at` integer NOT NULL,
	CONSTRAINT `fk_play_history_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_play_history_track_id_tracks_id_fk` FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `track_artists` (
	`track_id` integer NOT NULL,
	`artist_id` integer NOT NULL,
	CONSTRAINT `track_artists_pk` PRIMARY KEY(`track_id`, `artist_id`),
	CONSTRAINT `fk_track_artists_track_id_tracks_id_fk` FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_track_artists_artist_id_artists_id_fk` FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`title` text NOT NULL,
	`album_id` integer,
	`track_number` integer,
	`year` integer,
	`duration_seconds` integer,
	`file_path` text NOT NULL UNIQUE,
	`file_mtime` integer,
	`fingerprint` text,
	`added_at` integer NOT NULL,
	`added_by` integer,
	CONSTRAINT `fk_tracks_album_id_albums_id_fk` FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_tracks_added_by_users_id_fk` FOREIGN KEY (`added_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `user_playback_state` (
	`user_id` integer PRIMARY KEY,
	`track_id` integer,
	`position_seconds` integer,
	`playing` integer DEFAULT false NOT NULL,
	CONSTRAINT `fk_user_playback_state_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_user_playback_state_track_id_tracks_id_fk` FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`last_active_at` integer NOT NULL,
	`revoked_at` integer,
	CONSTRAINT `fk_user_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`password` text NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`shuffle` integer DEFAULT false NOT NULL,
	`repeat_mode` text DEFAULT 'off' NOT NULL,
	`subsonic_password` text,
	`verified_at` integer,
	`created_at` integer NOT NULL,
	CONSTRAINT "users_repeat_mode_valid" CHECK("repeat_mode" IN ('off', 'one', 'all'))
);
--> statement-breakpoint
CREATE INDEX `album_artists_artist_id` ON `album_artists` (`artist_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `listening_day_user_track` ON `listening` (`day`,`user_id`,`track_id`);--> statement-breakpoint
CREATE INDEX `track_artists_artist_id` ON `track_artists` (`artist_id`);