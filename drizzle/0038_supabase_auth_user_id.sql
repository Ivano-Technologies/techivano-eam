-- Supabase Auth migration: link app users to auth.users
-- Phase 1 of docs/SUPABASE_AUTH_MIGRATION_PLAN.md
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "supabase_user_id" uuid;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_supabase_user_id" ON "users" ("supabase_user_id");
