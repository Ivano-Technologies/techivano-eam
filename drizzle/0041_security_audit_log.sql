-- Security audit log: tamper-resistant, server-only log for auth/MFA/impersonation/session.
CREATE TABLE IF NOT EXISTS "security_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "org_id" uuid,
  "action" text NOT NULL,
  "entity" text,
  "entity_id" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "ip" text,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_audit_log_user_id" ON "security_audit_log" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_audit_log_org_id" ON "security_audit_log" ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_audit_log_action" ON "security_audit_log" ("action");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_security_audit_log_created_at" ON "security_audit_log" ("created_at");
