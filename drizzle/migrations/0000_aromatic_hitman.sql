CREATE TABLE `elo_scores` (
	`group_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`elo` integer DEFAULT 1500 NOT NULL,
	`games_won` integer DEFAULT 0 NOT NULL,
	`games_lost` integer DEFAULT 0 NOT NULL,
	`games_tied` integer DEFAULT 0 NOT NULL,
	`total_games` integer DEFAULT 0 NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`highest_streak` integer DEFAULT 0 NOT NULL,
	`last_played_at` integer,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `group_members` (
	`group_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text,
	`invite_code` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `match_participants` (
	`match_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`team` integer NOT NULL,
	`elo_before` integer,
	`elo_after` integer,
	`elo_change` integer,
	`penalized` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`play_session_id` integer NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`winning_team` integer,
	`match_size` integer NOT NULL,
	`cancelled` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`play_session_id`) REFERENCES `play_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `play_session_participants` (
	`play_session_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`is_spectator` integer DEFAULT false NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`play_session_id`) REFERENCES `play_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `play_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`host_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`ended_at` integer,
	`host_last_seen_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`host_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text DEFAULT '' NOT NULL,
	`password` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `elo_scores_group_user_idx` ON `elo_scores` (`group_id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `group_members_group_user_idx` ON `group_members` (`group_id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `groups_invite_code_idx` ON `groups` (`invite_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `match_participants_match_user_idx` ON `match_participants` (`match_id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `play_session_participants_session_user_idx` ON `play_session_participants` (`play_session_id`,`user_id`);