CREATE TABLE `notification_scenes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`handler` text NOT NULL,
	`cache_ttl` integer DEFAULT 300 NOT NULL,
	`status` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notification_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scene_name` text NOT NULL,
	`name` text NOT NULL,
	`target_type` text NOT NULL,
	`target_url` text NOT NULL,
	`target_auth` text,
	`trigger_type` text NOT NULL,
	`trigger_config` text,
	`template` text,
	`status` integer DEFAULT 1 NOT NULL,
	`retry_count` integer DEFAULT 3 NOT NULL,
	`timeout` integer DEFAULT 30 NOT NULL,
	`created_by` integer,
	`last_triggered_at` text,
	`next_trigger_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`scene_name`) REFERENCES `notification_scenes`(`name`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_scenes_name_unique` ON `notification_scenes` (`name`);