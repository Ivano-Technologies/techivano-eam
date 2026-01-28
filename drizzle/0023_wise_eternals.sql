ALTER TABLE `users` ADD `status` enum('pending','approved','rejected','active','inactive') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `jobTitle` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `phoneNumber` varchar(50);--> statement-breakpoint
ALTER TABLE `users` ADD `phoneCountryCode` varchar(10) DEFAULT '+234';--> statement-breakpoint
ALTER TABLE `users` ADD `agency` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `geographicalArea` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `registrationPurpose` text;--> statement-breakpoint
ALTER TABLE `users` ADD `employeeId` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `department` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `supervisorName` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `supervisorEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `users` ADD `approvedBy` int;--> statement-breakpoint
ALTER TABLE `users` ADD `approvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `rejectionReason` text;