CREATE TABLE `asset_edit_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`asset_id` int NOT NULL,
	`user_id` int NOT NULL,
	`field_name` varchar(100) NOT NULL,
	`old_value` text,
	`new_value` text,
	`changed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `asset_edit_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_asset_id` ON `asset_edit_history` (`asset_id`);--> statement-breakpoint
CREATE INDEX `idx_user_id` ON `asset_edit_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_changed_at` ON `asset_edit_history` (`changed_at`);