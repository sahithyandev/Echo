ALTER TABLE `app_settings` ADD `allow_anonymous` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `anonymous_subsonic_password` text;