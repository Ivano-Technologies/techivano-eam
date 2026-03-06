import { NextRequest, NextResponse } from "next/server";
import { getSupabaseForRequest } from "@/lib/supabase/server";
import { withRateLimit } from "@/lib/with-rate-limit";
import { withAudit } from "@/lib/with-audit";
import { ensureTenantMatch, resolveTenantId } from "@/lib/tenant/context";
import { z } from "zod";

export const runtime = "nodejs";

/**
 * @deprecated v2 compatibility endpoint.
 * New mobile-first flows should use `/api/entries`.
 * Kept during migration window to avoid breaking legacy screens.
 */

const getQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)")
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)")
    .optional(),
  categoryId: z.string().uuid("Invalid category ID").optional(),
  type: z.enum(["debit", "credit"]).optional(),
  search: z.string().max(200).optional(),
  tenant_id: z.string().uuid().optional(),
  business_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const deleteBodySchema = z.object({
  ids: z.array(z.string().uuid("Invalid transaction ID")).min(1).max(500),
});

// Web shape: transaction_type, transaction_date, category_id
// Mobile shape: type ("income"|"expense"), date, category (name string)
const createBodySchema = z.object({
  description: z.string().min(1, "Description is required").max(500),
  amount: z.number().positive("Amount must be positive"),
  transaction_type: z.enum(["debit", "credit"]).optional(),
  type: z.enum(["income", "expense"]).optional(),
  transaction_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
  category_id: z.string().uuid().nullable().optional(),
  category: z.string().optional(),
  tenant_id: z.string().uuid().optional(),
  business_id: z.string().uuid().optional(),
}).refine(
  (data) =>
    data.transaction_type !== undefined ||
    data.type !== undefined,
  { message: "Provide transaction_type or type" },
).refine(
  (data) =>
    data.transaction_date !== undefined || data.date !== undefined,
  { message: "Provide transaction_date or date" },
);

async function handleGET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await getSupabaseForRequest(request);

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const raw = Object.fromEntries(searchParams.entries());
    const parsed = getQuerySchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const filters = parsed.data;
    try {
      ensureTenantMatch(user.id, filters);
    } catch {
      return NextResponse.json({ error: "Forbidden tenant context" }, { status: 403 });
    }
    const tenantId = resolveTenantId(user.id, filters);

    // Build query
    let query = supabase
      .from("transactions")
      .select(
        `
        *,
        category:categories(id, name, category_type, tax_treatment)
      `,
        { count: "exact" },
      )
      .eq("user_id", tenantId);

    // Apply filters
    if (filters.startDate) {
      query = query.gte("transaction_date", filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte("transaction_date", filters.endDate);
    }

    if (filters.categoryId) {
      query = query.eq("category_id", filters.categoryId);
    }

    if (filters.type) {
      query = query.eq("transaction_type", filters.type);
    }

    if (filters.search) {
      query = query.ilike("description", `%${filters.search}%`);
    }

    // Apply pagination
    const from = (filters.page - 1) * filters.limit;
    const to = from + filters.limit - 1;

    query = query
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    const { data: transactions, error, count } = await query;

    if (error) {
      console.error("Error fetching transactions:", error);
      return NextResponse.json(
        { error: "Failed to fetch transactions" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      transactions,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / filters.limit),
      },
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

async function handleDELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await getSupabaseForRequest(request);

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = deleteBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { ids } = parsed.data;

    // Delete transactions (RLS ensures user can only delete their own)
    const { error } = await supabase
      .from("transactions")
      .delete()
      .in("id", ids)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting transactions:", error);
      return NextResponse.json(
        { error: "Failed to delete transactions" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${ids.length} transaction(s)`,
    });
  } catch (error) {
    console.error("Delete error:", error);
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

    const p = parsed.data;
    try {
      ensureTenantMatch(user.id, p);
    } catch {
      return NextResponse.json({ error: "Forbidden tenant context" }, { status: 403 });
    }
    const tenantId = resolveTenantId(user.id, p);
    const transactionType =
      p.transaction_type ??
      (p.type === "income" ? "credit" : p.type === "expense" ? "debit" : "debit");
    const transactionDate = p.transaction_date ?? p.date ?? "";

    let categoryId = p.category_id ?? null;
    if (categoryId === null && p.category && typeof p.category === "string") {
      const { data: categories } = await supabase
        .from("categories")
        .select("id, name")
        .eq("user_id", tenantId);
      const match = (categories ?? []).find(
        (c) =>
          c.name.toLowerCase() === p.category!.toLowerCase() ||
          c.name.toLowerCase().includes(p.category!.toLowerCase()),
      );
      categoryId = match?.id ?? null;
    }

    const { data: transaction, error } = await supabase
      .from("transactions")
      .insert({
        user_id: tenantId,
        description: p.description,
        amount: p.amount,
        transaction_type: transactionType,
        transaction_date: transactionDate,
        category_id: categoryId,
        confidence_score: categoryId ? 100 : null,
      })
      .select(
        `
        *,
        category:categories(id, name, category_type, tax_treatment)
      `,
      )
      .single();

    if (error) {
      console.error("Error creating transaction:", error);
      return NextResponse.json(
        { error: error.message || "Failed to create transaction" },
        { status: 500 },
      );
    }

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(handleGET);
export const POST = withRateLimit(handlePOST, { limit: 60 });
export const DELETE = withRateLimit(
  withAudit(handleDELETE, { action: "delete", resourceType: "transactions" }),
);
