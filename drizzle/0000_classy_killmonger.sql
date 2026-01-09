CREATE TABLE `messages` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`to_handle` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`scheduled_for_utc` datetime NOT NULL,
	`timezone` varchar(255) NOT NULL,
	`message_status` enum('QUEUED','SENDING','SENT','DELIVERED','RECEIVED','FAILED','CANCELED') NOT NULL DEFAULT 'QUEUED',
	`attempt_count` int NOT NULL DEFAULT 0,
	`last_error` text,
	`locked_at` datetime,
	`locked_by` varchar(255),
	`gateway_message_id` varchar(255),
	`delivered_at` datetime,
	`received_at` datetime,
	`receipt_correlation` json,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`canceled_at` datetime,
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_rate_limit` (
	`user_id` varchar(36) NOT NULL,
	`last_sent_at` datetime,
	`window_started_at` datetime,
	`sent_in_window` int NOT NULL DEFAULT 0,
	CONSTRAINT `user_rate_limit_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`paid_user` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_rate_limit` ADD CONSTRAINT `user_rate_limit_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `messages_user_id_scheduled_for_utc_idx` ON `messages` (`user_id`,`scheduled_for_utc`);--> statement-breakpoint
CREATE INDEX `messages_status_idx` ON `messages` (`message_status`);--> statement-breakpoint
CREATE INDEX `messages_scheduled_for_utc_idx` ON `messages` (`scheduled_for_utc`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_rate_limit_user_id_idx` ON `user_rate_limit` (`user_id`);