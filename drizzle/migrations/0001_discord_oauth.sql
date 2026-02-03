ALTER TABLE `users` ADD `discord_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD `display_name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_url` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_discord_id_idx` ON `users` (`discord_id`);
