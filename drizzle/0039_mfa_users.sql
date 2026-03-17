-- MFA columns for users: global owners require MFA; store TOTP verification time.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_enabled" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_enforced" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_last_verified_at" timestamp with time zone;
--> statement-breakpoint
-- Enforce MFA for global owner emails
UPDATE "users" SET "mfa_enforced" = true WHERE LOWER(TRIM("email")) IN ('kezieokpala@gmail.com', 'ivanonigeria@gmail.com', 'kezie@ivanotechnologies.com');
