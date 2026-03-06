import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { suggestCategoryFromVendor } from "@/lib/finance/vendor-intelligence";
import { getSupabaseForRequest } from "@/lib/supabase/server";
import { ensureTenantMatch, resolveTenantId } from "@/lib/tenant/context";
import { withRateLimit } from "@/lib/with-rate-limit";

const querySchema = z.object({
  vendor: z.string().min(1),
  tenant_id: z.string().uuid().optional(),
  business_id: z.string().uuid().optional(),
});

async function handleGET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await getSupabaseForRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = querySchema.safeParse({
      vendor: request.nextUrl.searchParams.get("vendor"),
      tenant_id: request.nextUrl.searchParams.get("tenant_id") ?? undefined,
      business_id: request.nextUrl.searchParams.get("business_id") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    try {
      ensureTenantMatch(user.id, parsed.data);
    } catch {
      return NextResponse.json(
        { error: "tenant_id/business_id does not match authenticated context" },
        { status: 403 },
      );
    }
    const tenantId = resolveTenantId(user.id, parsed.data);

    const normalized = parsed.data.vendor.trim().toLowerCase();
    const { data: vendor, error } = await supabase
      .from("vendors")
      .select(
        "id, name, category_frequency, vat_usage_frequency, non_vat_usage_frequency, usage_count",
      )
      .eq("business_id", tenantId)
      .eq("name_normalized", normalized)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to fetch vendor suggestion" },
        { status: 500 },
      );
    }

    if (!vendor) {
      return NextResponse.json({ suggestion: null });
    }

    const suggestion = suggestCategoryFromVendor({
      category_frequency:
        (vendor.category_frequency as Record<string, number> | null) ?? {},
      vat_usage_frequency: vendor.vat_usage_frequency,
      non_vat_usage_frequency: vendor.non_vat_usage_frequency,
    });

    return NextResponse.json({
      suggestion: {
        vendor_id: vendor.id,
        vendor_name: vendor.name,
        category_id: suggestion.categoryId,
        vat_likely: suggestion.vatLikely,
        usage_count: vendor.usage_count,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(handleGET, { limit: 120 });

