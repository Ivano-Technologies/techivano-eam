CREATE TABLE `fleet_units` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenant_id` int NOT NULL,
  `unit_name` varchar(255) NOT NULL,
  `vehicle_type` varchar(100) NOT NULL,
  `capacity` int NOT NULL DEFAULT 1,
  `current_location` varchar(255),
  `status` enum('available','assigned','maintenance','offline') NOT NULL DEFAULT 'available',
  `assigned_technician_id` int,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fleet_units_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_fleet_units_tenant` ON `fleet_units` (`tenant_id`);
--> statement-breakpoint
CREATE INDEX `idx_fleet_units_status` ON `fleet_units` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_fleet_units_current_location` ON `fleet_units` (`current_location`);
--> statement-breakpoint
CREATE TABLE `technicians` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenant_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `skill_profile` varchar(100) NOT NULL,
  `current_location` varchar(255),
  `availability_status` enum('available','busy','off_shift') NOT NULL DEFAULT 'available',
  `shift_start` varchar(8),
  `shift_end` varchar(8),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `technicians_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_technicians_tenant` ON `technicians` (`tenant_id`);
--> statement-breakpoint
CREATE INDEX `idx_technicians_availability_status` ON `technicians` (`availability_status`);
--> statement-breakpoint
CREATE INDEX `idx_technicians_current_location` ON `technicians` (`current_location`);
--> statement-breakpoint
CREATE TABLE `dispatch_assignments` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenant_id` int NOT NULL,
  `work_order_id` int NOT NULL,
  `technician_id` int NOT NULL,
  `fleet_unit_id` int NOT NULL,
  `dispatch_priority` enum('routine','prioritized','urgent','critical') NOT NULL,
  `estimated_travel_time` decimal(8,2) NOT NULL,
  `route_distance` decimal(8,2) NOT NULL,
  `dispatch_score` decimal(6,4) NOT NULL,
  `status` enum('created','completed','delayed') NOT NULL DEFAULT 'created',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `agent_execution_id` varchar(100) NOT NULL,
  CONSTRAINT `dispatch_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_dispatch_assignments_tenant` ON `dispatch_assignments` (`tenant_id`);
--> statement-breakpoint
CREATE INDEX `idx_dispatch_assignments_work_order` ON `dispatch_assignments` (`work_order_id`);
--> statement-breakpoint
CREATE INDEX `idx_dispatch_assignments_technician` ON `dispatch_assignments` (`technician_id`);
--> statement-breakpoint
CREATE INDEX `idx_dispatch_assignments_created_at` ON `dispatch_assignments` (`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_dispatch_assignments_execution` ON `dispatch_assignments` (`tenant_id`,`work_order_id`,`technician_id`,`fleet_unit_id`,`agent_execution_id`);
