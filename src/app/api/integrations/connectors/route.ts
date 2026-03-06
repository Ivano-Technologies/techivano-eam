import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseForRequest } from "@/lib/supabase/server";
import { withRateLimit } from "@/lib/with-rate-limit";
import { ensureTenantMatch, resolveTenantId } from "@/lib/tenant/context";
import {
  upsertIntegrationConnector,
} from "@/lib/services/enterprise-integrations";
import { enqueueIntegrationSync } from "@/lib/jobs/integration-sync-queue";

const providerSchema = z.enum(["SAP", "Oracle", "QuickBooks", "ArcGIS"]);
const createSchema = z.object({
  tenant_id: z.string().uuid().optional(),
  business_id: z.string().uuid().optional(),
  provider: providerSchema,
  config: z.record(z.string(), z.unknown()).default({}),
});

async function handleGET(request: NextRequest) {
  const supabase = await getSupabaseForRequest(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenantId = request.nextUrl.searchParams.get("tenant_id") ?? user.id;
  if (tenantId !== user.id) {
    return NextResponse.json({ error: "Forbidden tenant context" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("integration_connectors")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ connectors: data ?? [] });
}

async function handlePOST(request: NextRequest) {
  const supabase = await getSupabaseForRequest(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    ensureTenantMatch(user.id, parsed.data);
  } catch {
    return NextResponse.json({ error: "Forbidden tenant context" }, { status: 403 });
  }
  const tenantId = resolveTenantId(user.id, parsed.data);

  await upsertIntegrationConnector(supabase, {
    tenantId,
    provider: parsed.data.provider,
    config: parsed.data.config,
  });
  await enqueueIntegrationSync({
    tenantId,
    provider: parsed.data.provider,
  });

  return NextResponse.json({ success: true, status: "queued" }, { status: 201 });
}

export const GET = withRateLimit(handleGET, { limit: 90 });
export const POST = withRateLimit(handlePOST, { limit: 40 });
