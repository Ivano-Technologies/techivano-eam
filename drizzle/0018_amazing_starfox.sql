CREATE TABLE `importHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('assets','sites','vendors') NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileType` enum('csv','excel') NOT NULL,
	`importedBy` int NOT NULL,
	`totalRows` int NOT NULL,
	`successCount` int NOT NULL,
	`failedCount` int NOT NULL,
	`errors` text,
	`status` enum('success','partial','failed') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `importHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `importHistory` ADD CONSTRAINT `importHistory_importedBy_users_id_fk` FOREIGN KEY (`importedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;