ALTER TABLE `tracks` ADD `sha1` text;--> statement-breakpoint
CREATE INDEX `play_history_user_id` ON `play_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `play_history_track_id` ON `play_history` (`track_id`);--> statement-breakpoint
CREATE INDEX `tracks_album_id` ON `tracks` (`album_id`);--> statement-breakpoint
CREATE INDEX `user_sessions_token_hash` ON `user_sessions` (`token_hash`);