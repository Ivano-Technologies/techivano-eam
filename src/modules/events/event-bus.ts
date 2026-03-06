import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const EventPayloadSchema = z.object({
  tenantId: z.string().uuid(),
});

export type PlatformEvent<TPayload extends Record<string, unknown>> = {
  id: string;
  tenant_id: string;
  event_type: string;
  event_payload: TPayload & { tenantId: string };
  processed: boolean;
  created_at: string;
};

export async function publishEvent<TPayload extends Record<string, unknown>>(
  supabase: SupabaseClient,
  eventType: string,
  payload: TPayload & { tenantId: string },
): Promise<void> {
  EventPayloadSchema.parse(payload);

  const { error } = await supabase.from("platform_events").insert({
    tenant_id: payload.tenantId,
    event_type: eventType,
    event_payload: payload,
    processed: false,
  });

  if (error) {
    throw new Error(`Failed to publish event: ${error.message}`);
  }
}

export async function consumeEvents(
  supabase: SupabaseClient,
  args: {
    tenantId: string;
    agentType: string;
    limit?: number;
  },
): Promise<PlatformEvent<Record<string, unknown>>[]> {
  const { data, error } = await supabase
    .from("platform_events")
    .select("*")
    .eq("tenant_id", args.tenantId)
    .eq("processed", false)
    .order("created_at", { ascending: true })
    .limit(args.limit ?? 50);

  if (error) {
    throw new Error(`Failed to consume events: ${error.message}`);
  }

  const rows = (data ?? []) as PlatformEvent<Record<string, unknown>>[];
  if (rows.length === 0) return [];

  const eventIds = rows.map((row) => row.id);
  const markProcessed = await supabase
    .from("platform_events")
    .update({
      processed: true,
      processed_by: args.agentType,
      processed_at: new Date().toISOString(),
    })
    .in("id", eventIds)
    .eq("tenant_id", args.tenantId);

  if (markProcessed.error) {
    throw new Error(`Failed to ack consumed events: ${markProcessed.error.message}`);
  }

  return rows;
}
