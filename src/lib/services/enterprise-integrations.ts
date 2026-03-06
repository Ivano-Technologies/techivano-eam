import type { SupabaseClient } from "@supabase/supabase-js";
import { publishEvent } from "@/modules/events/event-bus";

export type EnterpriseProvider = "SAP" | "Oracle" | "QuickBooks" | "ArcGIS";

export interface IntegrationAdapter {
  provider: EnterpriseProvider;
  validateConfig(config: Record<string, unknown>): void;
  sync(tenantId: string): Promise<{ status: "ok"; syncedAt: string }>;
}

abstract class BaseAdapter implements IntegrationAdapter {
  constructor(public provider: EnterpriseProvider) {}

  validateConfig(config: Record<string, unknown>): void {
    if (!config || Object.keys(config).length === 0) {
      throw new Error(`${this.provider} config is required`);
    }
  }

  async sync(_tenantId: string): Promise<{ status: "ok"; syncedAt: string }> {
    return { status: "ok", syncedAt: new Date().toISOString() };
  }
}

export const adapters: Record<EnterpriseProvider, IntegrationAdapter> = {
  SAP: new (class extends BaseAdapter {
    constructor() {
      super("SAP");
    }
  })(),
  Oracle: new (class extends BaseAdapter {
    constructor() {
      super("Oracle");
    }
  })(),
  QuickBooks: new (class extends BaseAdapter {
    constructor() {
      super("QuickBooks");
    }
  })(),
  ArcGIS: new (class extends BaseAdapter {
    constructor() {
      super("ArcGIS");
    }
  })(),
};

export async function upsertIntegrationConnector(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    provider: EnterpriseProvider;
    config: Record<string, unknown>;
  },
) {
  const adapter = adapters[input.provider];
  adapter.validateConfig(input.config);

  const { error } = await supabase.from("integration_connectors").upsert(
    {
      tenant_id: input.tenantId,
      provider: input.provider,
      status: "connected",
      config: input.config,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,provider" },
  );
  if (error) {
    throw new Error(`Failed to upsert connector: ${error.message}`);
  }

  await publishEvent(supabase, "integration.connector.updated", {
    tenantId: input.tenantId,
    provider: input.provider,
  });
}

export async function runIntegrationSync(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    provider: EnterpriseProvider;
  },
) {
  const adapter = adapters[input.provider];
  const result = await adapter.sync(input.tenantId);

  await supabase
    .from("integration_connectors")
    .update({
      status: "connected",
      last_synced_at: result.syncedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", input.tenantId)
    .eq("provider", input.provider);

  await publishEvent(supabase, "integration.sync.completed", {
    tenantId: input.tenantId,
    provider: input.provider,
    syncedAt: result.syncedAt,
  });
}
