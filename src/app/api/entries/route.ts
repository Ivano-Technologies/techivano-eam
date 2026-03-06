import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseForRequest } from "@/lib/supabase/server";
import { withRateLimit } from "@/lib/with-rate-limit";
import { computeTaxLedgerProjection } from "@/lib/services/tax-ledger-sync";
import { computeSnapshotDelta } from "@/lib/finance/snapshot-delta";
import { updateVendorIntelligence } from "@/lib/finance/vendor-intelligence";
import { EntrySchema } from "@/lib/validation/entry-schema";
import { ensureTenantMatch, resolveTenantId } from "@/lib/tenant/context";

export const runtime = "nodejs";

const getQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)")
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)")
    .optional(),
  type: z.enum(["income", "expense", "asset", "liability"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const createBodySchema = EntrySchema;

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

    const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = getQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { startDate, endDate, type, page, limit } = parsed.data;
    let query = supabase
      .from("entries")
      .select("*", { count: "exact" })
      .eq("business_id", user.id);

    if (startDate) {
      query = query.gte("created_at", `${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      query = query.lte("created_at", `${endDate}T23:59:59.999Z`);
    }
    if (type) {
      query = query.eq("type", type);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to fetch entries" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      entries: data ?? [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("entries GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await getSupabaseForRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    try {
      ensureTenantMatch(user.id, payload);
    } catch {
      return NextResponse.json(
        { error: "tenant_id/business_id does not match authenticated context" },
        { status: 403 },
      );
    }
    const tenantId = resolveTenantId(user.id, payload);
    const createdAt = payload.created_at
      ? payload.created_at.includes("T")
        ? payload.created_at
        : `${payload.created_at}T00:00:00.000Z`
      : undefined;
    const requestNow = createdAt ? new Date(createdAt) : new Date();
    const idempotencyKey =
      request.headers.get("x-idempotency-key")?.trim() || null;

    if (idempotencyKey) {
      const { data: existingByKey, error: existingByKeyError } = await supabase
        .from("entries")
        .select("*")
        .eq("business_id", tenantId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existingByKeyError) {
        return NextResponse.json(
          { error: existingByKeyError.message || "Failed idempotency lookup" },
          { status: 500 },
        );
      }

      if (existingByKey) {
        const snapshotDelta = await computeSnapshotDelta(supabase, tenantId);
        return NextResponse.json(
          { entry: existingByKey, snapshot_delta: snapshotDelta, idempotent: true },
          { status: 200 },
        );
      }
    }

    const { data, error } = await supabase
      .from("entries")
      .insert({
        business_id: tenantId,
        tenant_id: tenantId,
        type: payload.type,
        category_id: payload.category_id ?? null,
        product_id: payload.product_id ?? null,
        source: payload.source ?? "manual",
        tax_code: payload.tax_code ?? null,
        vat_applicable: payload.vat_applicable ?? false,
        amount: payload.amount,
        payment_method: payload.payment_method ?? null,
        linked_invoice_id: payload.linked_invoice_id ?? null,
        metadata: {
          ...(payload.metadata ?? {}),
          ...(payload.vat_amount !== undefined
            ? { vat_amount: payload.vat_amount }
            : {}),
          ...(payload.description ? { description: payload.description } : {}),
        },
        idempotency_key: idempotencyKey,
        ...(createdAt ? { created_at: createdAt } : {}),
      })
      .select("*")
      .single();

    if (error) {
      // Race-safe idempotency fallback (e.g. duplicate key from retries in flight)
      const isUniqueViolation =
        typeof (error as any)?.code === "string" &&
        (error as any).code === "23505";
      if (idempotencyKey && isUniqueViolation) {
        const { data: existingAfterConflict } = await supabase
          .from("entries")
          .select("*")
          .eq("business_id", user.id)
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();
        if (existingAfterConflict) {
          const snapshotDelta = await computeSnapshotDelta(supabase, tenantId);
          return NextResponse.json(
            {
              entry: existingAfterConflict,
              snapshot_delta: snapshotDelta,
              idempotent: true,
            },
            { status: 200 },
          );
        }
      }
      return NextResponse.json(
        { error: error.message || "Failed to create entry" },
        { status: 500 },
      );
    }

    if (payload.receipt_id) {
      try {
        const { error: receiptLinkError } = await supabase
          .from("receipts")
          .update({ entry_id: data.id })
          .eq("id", payload.receipt_id)
        .eq("business_id", tenantId);
        if (receiptLinkError) {
          console.error("receipt linkage warning:", receiptLinkError);
        }
      } catch (linkError) {
        console.error("receipt linkage warning:", linkError);
      }
    }

    // Vendor intelligence learning loop (soft-fail).
    try {
      const metadataVendor =
        payload.metadata &&
        typeof payload.metadata === "object" &&
        !Array.isArray(payload.metadata)
          ? (payload.metadata.vendor as string | undefined)
          : undefined;
      const vendorName = metadataVendor ?? payload.description ?? undefined;
      await updateVendorIntelligence({
        supabase,
        businessId: tenantId,
        vendorName,
        categoryId: payload.category_id,
        vatAmount: payload.vat_amount ?? 0,
      });
    } catch (vendorSyncError) {
      console.error("vendor intelligence sync warning:", vendorSyncError);
    }

    // Incremental snapshot update (soft-fail; computeSnapshotDelta has fallback path).
    try {
      await supabase.rpc("update_snapshot_incremental", {
        p_business_id: tenantId,
        p_type: payload.type,
        p_amount: payload.amount,
        p_vat_amount: payload.vat_amount ?? 0,
      });
    } catch (snapshotRpcError) {
      console.error("snapshot incremental warning:", snapshotRpcError);
    }

    // Week 4 critical path: keep tax_ledger in sync with entry writes.
    // Soft-fail to preserve write-path reliability during migration window.
    try {
      const entryDate = requestNow;
      const period = `${entryDate.getFullYear()}-${String(
        entryDate.getMonth() + 1,
      ).padStart(2, "0")}`;

      const isIncome = payload.type === "income";

      if (isIncome) {
        const { data: existingLedger, error: existingLedgerError } = await supabase
          .from("tax_ledger")
          .select("id, vat_collected, vat_paid, cit_estimate, net_due")
          .eq("business_id", tenantId)
          .eq("period", period)
          .maybeSingle();

        if (existingLedgerError) {
          throw existingLedgerError;
        }

        const projection = computeTaxLedgerProjection(existingLedger, {
          type: payload.type,
          amount: payload.amount,
          vatApplicable: payload.vat_applicable ?? false,
        });

        if (existingLedger?.id) {
          const { error: updateLedgerError } = await supabase
            .from("tax_ledger")
            .update({
              vat_collected: projection.vat_collected,
              cit_estimate: projection.cit_estimate,
              net_due: projection.net_due,
            })
            .eq("id", existingLedger.id);
          if (updateLedgerError) {
            throw updateLedgerError;
          }
        } else {
          const { error: insertLedgerError } = await supabase
            .from("tax_ledger")
            .insert({
              business_id: tenantId,
              tenant_id: tenantId,
              period,
              vat_collected: projection.vat_collected,
              vat_paid: 0,
              cit_estimate: projection.cit_estimate,
              net_due: projection.net_due,
            });
          if (insertLedgerError) {
            throw insertLedgerError;
          }
        }
      }
    } catch (syncError) {
      console.error("tax_ledger sync warning:", syncError);
    }

    const snapshotDelta = await computeSnapshotDelta(supabase, tenantId);
    return NextResponse.json(
      { entry: data, snapshot_delta: snapshotDelta, idempotent: false },
      { status: 201 },
    );
  } catch (error) {
    console.error("entries POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(handleGET);
export const POST = withRateLimit(handlePOST, { limit: 120 });

