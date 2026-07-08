CREATE TABLE `signup_allowed_emails` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`email` text NOT NULL UNIQUE,
	`added_by` integer,
	`added_at` integer NOT NULL,
	CONSTRAINT `fk_signup_allowed_emails_added_by_users_id_fk` FOREIGN KEY (`added_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
ALTER TABLE `app_settings` ADD `signup_mode` text DEFAULT 'closed' NOT NULL;