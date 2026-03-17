-- Tamper-evident chain for security_audit_log.
ALTER TABLE "security_audit_log" ADD COLUMN IF NOT EXISTS "hash" text;
