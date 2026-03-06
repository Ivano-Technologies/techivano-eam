import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { createAdminClient, getSupabaseForRequest } from "@/lib/supabase/server";
import { ensureTenantMatch, resolveTenantId } from "@/lib/tenant/context";
import { withRateLimit } from "@/lib/with-rate-limit";

const ocrImageItemSchema = z
  .object({
    imageBase64: z.string().min(1).optional(),
    imageUrl: z.string().url().optional(),
    idempotency_key: z.string().min(1).optional(),
  })
  .refine((v) => Boolean(v.imageBase64 || v.imageUrl), {
    message: "imageBase64 or imageUrl is required",
    path: ["imageBase64"],
  });

const ocrBodySchema = z
  .object({
    imageBase64: z.string().min(1).optional(),
    imageUrl: z.string().url().optional(),
    items: z.array(ocrImageItemSchema).min(1).max(25).optional(),
    tenant_id: z.string().uuid().optional(),
    business_id: z.string().uuid().optional(),
    async: z.boolean().optional(),
  })
  .refine((v) => Boolean(v.items?.length || v.imageBase64 || v.imageUrl), {
    message: "imageBase64 or imageUrl is required",
    path: ["imageBase64"],
  });

function normalizeBase64Input(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("imageBase64 is empty");
  }
  const payload = trimmed.includes(",") ? trimmed.split(",")[1] ?? "" : trimmed;
  if (!payload) {
    throw new Error("imageBase64 is invalid");
  }
  return payload;
}

async function uploadReceiptImage(
  admin: ReturnType<typeof createAdminClient>,
  businessId: string,
  receiptId: string,
  imageBase64: string,
): Promise<string> {
  const bytes = Buffer.from(normalizeBase64Input(imageBase64), "base64");
  if (bytes.length === 0) {
    throw new Error("Invalid base64 image");
  }

  const path = `${businessId}/${receiptId}.jpg`;
  const { error: uploadError } = await admin.storage
    .from("receipts")
    .upload(path, bytes, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Receipt upload failed: ${uploadError.message}`);
  }

  const { data: publicUrl } = admin.storage.from("receipts").getPublicUrl(path);
  return publicUrl.publicUrl || path;
}

function getParsedPayload(receipt: {
  parsed_amount: number | null;
  parsed_vendor: string | null;
  parsed_date: string | null;
  confidence_score: number | null;
  ocr_raw_text: string | null;
}) {
  return {
    amount: receipt.parsed_amount,
    vendor: receipt.parsed_vendor,
    date: receipt.parsed_date,
    vatAmount: null,
    confidence: Number(receipt.confidence_score ?? 0),
    rawText: receipt.ocr_raw_text ?? "",
  };
}

async function queueReceiptJob(params: {
  admin: ReturnType<typeof createAdminClient>;
  businessId: string;
  imageUrl: string;
  idempotencyKey: string;
  enqueueOCRProcessingJob: (payload: {
    receipt_id: string;
    business_id: string;
    tenant_id?: string;
    image_url: string;
    idempotency_key: string;
  }) => Promise<void>;
}) {
  const { data: existingByKey, error: existingError } = await params.admin
    .from("receipts")
    .select(
      "id, status, image_url, ocr_raw_text, parsed_amount, parsed_vendor, parsed_date, confidence_score",
    )
    .eq("business_id", params.businessId)
    .eq("idempotency_key", params.idempotencyKey)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingByKey) {
    return {
      receiptId: existingByKey.id,
      status: existingByKey.status,
      parsed:
        existingByKey.status === "parsed"
          ? getParsedPayload(existingByKey)
          : null,
    };
  }

  const { data: receipt, error: receiptError } = await params.admin
    .from("receipts")
    .insert({
      business_id: params.businessId,
      image_url: params.imageUrl,
      status: "pending",
      idempotency_key: params.idempotencyKey,
    })
    .select("id")
    .single();

  if (receiptError || !receipt) {
    throw receiptError ?? new Error("Failed to create receipt record");
  }

  await params.enqueueOCRProcessingJob({
    receipt_id: receipt.id,
    business_id: params.businessId,
    tenant_id: params.businessId,
    image_url: params.imageUrl,
    idempotency_key: params.idempotencyKey,
  });

  const { error: queuedError } = await params.admin
    .from("receipts")
    .update({ status: "queued" })
    .eq("id", receipt.id);

  if (queuedError) {
    throw queuedError;
  }

  return {
    receiptId: receipt.id,
    status: "queued" as const,
    parsed: null,
  };
}

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsedBody = ocrBodySchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: "Missing or invalid imageBase64/imageUrl",
          details: parsedBody.error.flatten(),
        },
        { status: 400 },
      );
    }
    const payload = parsedBody.data;

    const supabase = await getSupabaseForRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      ensureTenantMatch(user.id, payload);
    } catch {
      return NextResponse.json(
        { error: "tenant_id/business_id does not match authenticated user context" },
        { status: 403 },
      );
    }
    const tenantId = resolveTenantId(user.id, payload);

    const [{ getBusinessPlan }, { isMvpFreeOnlyMode }, { PLAN_LIMITS }, usageLib] =
      await Promise.all([
        import("@/lib/subscription/get-plan"),
        import("@/lib/subscription/mvp-mode"),
        import("@/lib/subscription/plans"),
        import("@/lib/subscription/usage"),
      ]);
    const { incrementUsageMetric, getMonthlyUsage } = usageLib;
    const { enqueueOCRProcessingJob } = await import(
      "@/lib/jobs/ocr-processing-queue"
    );

    const admin = createAdminClient();
    const plan = await getBusinessPlan(supabase, tenantId);
    const mvpMode = isMvpFreeOnlyMode();
    const usage = await getMonthlyUsage(supabase, tenantId);

    const ensureOcrQuota = (count: number): NextResponse | null => {
      const limit = PLAN_LIMITS[plan].ocr_limit;
      if (Number.isFinite(limit) && usage.ocr_count + count > limit) {
        return NextResponse.json(
          {
            error: `OCR limit reached (${usage.ocr_count}/${limit}) for this month.`,
            message:
              "Monthly OCR limit reached for your current plan. Try manual entry or continue next month.",
            plan,
            limit,
            current_usage: usage.ocr_count,
          },
          { status: 402 },
        );
      }
      return null;
    };

    if (payload.items?.length) {
      if (!mvpMode && !PLAN_LIMITS[plan].bulk_upload) {
        return NextResponse.json(
          {
            error: "Bulk upload requires Pro or Growth plan.",
            plan,
          },
          { status: 402 },
        );
      }
      const quotaErr = ensureOcrQuota(payload.items.length);
      if (quotaErr) return quotaErr;

      const queued = [];
      for (const item of payload.items) {
        const idempotencyKey =
          item.idempotency_key ??
          request.headers.get("x-idempotency-key")?.trim() ??
          crypto.randomUUID();
        const itemImageUrl = item.imageUrl
          ? item.imageUrl
          : await uploadReceiptImage(
              admin,
              tenantId,
              crypto.randomUUID(),
              item.imageBase64!,
            );

        const result = await queueReceiptJob({
          admin,
          businessId: tenantId,
          imageUrl: itemImageUrl,
          idempotencyKey,
          enqueueOCRProcessingJob,
        });
        queued.push({
          receipt_id: result.receiptId,
          status: result.status,
        });
      }
      await incrementUsageMetric({
        supabase,
        businessId: tenantId,
        field: "ocr_count",
        amount: payload.items.length,
      });
      await incrementUsageMetric({
        supabase,
        businessId: tenantId,
        field: "bulk_upload_count",
        amount: 1,
      });
      return NextResponse.json(
        {
          status: "queued",
          receipts: queued,
        },
        { status: 202 },
      );
    }

    const quotaErr = ensureOcrQuota(1);
    if (quotaErr) return quotaErr;

    const idempotencyKey = request.headers.get("x-idempotency-key")?.trim();
    if (!idempotencyKey) {
      return NextResponse.json(
        { error: "Missing idempotency key" },
        { status: 400 },
      );
    }

    const { data: existingByKey, error: existingError } = await admin
      .from("receipts")
      .select(
        "id, status, image_url, ocr_raw_text, parsed_amount, parsed_vendor, parsed_date, confidence_score",
      )
      .eq("business_id", tenantId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingByKey) {
      if (payload.async && existingByKey.status !== "parsed") {
        if (existingByKey.image_url) {
          await enqueueOCRProcessingJob({
            receipt_id: existingByKey.id,
            business_id: tenantId,
            tenant_id: tenantId,
            image_url: existingByKey.image_url,
            idempotency_key: idempotencyKey,
          });
          await admin
            .from("receipts")
            .update({ status: "queued" })
            .eq("id", existingByKey.id);
        }
      }
      return NextResponse.json(
        {
          receipt_id: existingByKey.id,
          status: existingByKey.status,
          parsed:
            existingByKey.status === "parsed"
              ? getParsedPayload(existingByKey)
              : null,
        },
        { status: existingByKey.status === "parsed" ? 200 : 202 },
      );
    }

    const { data: receipt, error: receiptError } = await admin
      .from("receipts")
      .insert({
        business_id: user.id,
        tenant_id: tenantId,
        image_url: payload.imageUrl ?? "",
        status: "pending",
        idempotency_key: idempotencyKey,
      })
      .select("id")
      .single();

    if (receiptError || !receipt) {
      throw receiptError ?? new Error("Failed to create receipt record");
    }

    const imageUrl = payload.imageUrl
      ? payload.imageUrl
      : await uploadReceiptImage(admin, tenantId, receipt.id, payload.imageBase64!);

    const { error: updateImageError } = await admin
      .from("receipts")
      .update({ image_url: imageUrl })
      .eq("id", receipt.id);

    if (updateImageError) {
      throw updateImageError;
    }

    if (payload.async) {
      if (!mvpMode && !PLAN_LIMITS[plan].bulk_upload) {
        return NextResponse.json(
          {
            error: "Async OCR queue requires Pro or Growth plan.",
            plan,
          },
          { status: 402 },
        );
      }
      await enqueueOCRProcessingJob({
        receipt_id: receipt.id,
        business_id: tenantId,
        tenant_id: tenantId,
        image_url: imageUrl,
        idempotency_key: idempotencyKey,
      });
      await admin
        .from("receipts")
        .update({ status: "queued" })
        .eq("id", receipt.id);
      await incrementUsageMetric({
        supabase,
        businessId: tenantId,
        field: "ocr_count",
        amount: 1,
      });
      return NextResponse.json(
        { receipt_id: receipt.id, status: "queued" },
        { status: 202 },
      );
    }

    await admin
      .from("receipts")
      .update({ status: "processing" })
      .eq("id", receipt.id);

    const { runOCR } = await import("@/lib/ocr/runOCR");
    const parsed = await runOCR(imageUrl);
    const parsedDate =
      parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
        ? `${parsed.date}T00:00:00.000Z`
        : null;

    await admin
      .from("receipts")
      .update({
        status: "parsed",
        ocr_raw_text: parsed.rawText,
        parsed_amount: parsed.amount,
        parsed_vendor: parsed.vendor,
        parsed_date: parsedDate,
        confidence_score: parsed.confidence,
      })
      .eq("id", receipt.id);
    await incrementUsageMetric({
      supabase,
      businessId: tenantId,
      field: "ocr_count",
      amount: 1,
    });

    return NextResponse.json({
      receipt_id: receipt.id,
      parsed,
      // Backward-compatible flat keys for current callers.
      text: parsed.rawText,
      vendor: parsed.vendor ?? null,
      date: parsed.date ?? null,
      amount: parsed.amount ?? null,
      vat: parsed.vatAmount ?? null,
      status: "parsed",
    });
  } catch (err) {
    logger.error("OCR error", {
      error: err instanceof Error ? err.message : String(err),
      operation: "expenses/ocr",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "OCR failed" },
      { status: 500 },
    );
  }
}

export const POST = withRateLimit(handlePOST, { limit: 20 });
