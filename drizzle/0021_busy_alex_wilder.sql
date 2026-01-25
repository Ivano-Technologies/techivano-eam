CREATE TABLE `branchCodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(10) NOT NULL,
	`name` varchar(100) NOT NULL,
	`state` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `branchCodes_id` PRIMARY KEY(`id`),
	CONSTRAINT `branchCodes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `categoryCodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(10) NOT NULL,
	`name` varchar(100) NOT NULL,
	`usefulLifeYears` int,
	`depreciationRate` decimal(5,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categoryCodes_id` PRIMARY KEY(`id`),
	CONSTRAINT `categoryCodes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `subCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`categoryType` varchar(20),
	`parentCategory` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subCategories_id` PRIMARY KEY(`id`),
	CONSTRAINT `subCategories_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `assets` ADD `itemType` varchar(20) DEFAULT 'Asset';--> statement-breakpoint
ALTER TABLE `assets` ADD `subCategory` varchar(100);--> statement-breakpoint
ALTER TABLE `assets` ADD `branchCode` varchar(10);--> statement-breakpoint
ALTER TABLE `assets` ADD `itemCategoryCode` varchar(10);--> statement-breakpoint
ALTER TABLE `assets` ADD `assetNumber` int;--> statement-breakpoint
ALTER TABLE `assets` ADD `productNumber` varchar(255);--> statement-breakpoint
ALTER TABLE `assets` ADD `methodOfAcquisition` varchar(100);--> statement-breakpoint
ALTER TABLE `assets` ADD `acquisitionDetails` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `projectReference` varchar(255);--> statement-breakpoint
ALTER TABLE `assets` ADD `yearAcquired` int;--> statement-breakpoint
ALTER TABLE `assets` ADD `acquiredCondition` varchar(20);--> statement-breakpoint
ALTER TABLE `assets` ADD `currentDepreciatedValue` decimal(15,2);--> statement-breakpoint
ALTER TABLE `assets` ADD `assignedToName` varchar(255);--> statement-breakpoint
ALTER TABLE `assets` ADD `department` varchar(255);--> statement-breakpoint
ALTER TABLE `assets` ADD `condition` varchar(100);--> statement-breakpoint
ALTER TABLE `assets` ADD `lastPhysicalCheckDate` timestamp;--> statement-breakpoint
ALTER TABLE `assets` ADD `checkConductedBy` varchar(255);--> statement-breakpoint
ALTER TABLE `assets` ADD `remarks` text;