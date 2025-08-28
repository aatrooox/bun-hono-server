CREATE TABLE `oauth_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`provider` text NOT NULL,
	`provider_user_id` text NOT NULL,
	`provider_user_id2` text,
	`provider_user_info` text,
	`access_token` text,
	`refresh_token` text,
	`expires_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`token` text NOT NULL,
	`device_info` text,
	`ip_address` text,
	`expires_at` text NOT NULL,
	`is_revoked` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE users ADD `nickname` text;--> statement-breakpoint
ALTER TABLE users ADD `avatar` text;--> statement-breakpoint
ALTER TABLE users ADD `phone` text;--> statement-breakpoint
ALTER TABLE users ADD `gender` integer;--> statement-breakpoint
ALTER TABLE users ADD `birthday` text;--> statement-breakpoint
ALTER TABLE users ADD `bio` text;--> statement-breakpoint
ALTER TABLE users ADD `status` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_accounts_provider_provider_user_id_unique` ON `oauth_accounts` (`provider`,`provider_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `refresh_tokens_token_unique` ON `refresh_tokens` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_unique` ON `users` (`phone`);