import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { normalizeOrganizationId } from "../db";
import { authenticateRequest } from "./authenticateRequest";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  tenantId: number | null;
  organizationId: string | null;
};

const CANONICAL_TENANT_UUID_PREFIX = "00000000-0000-4000-8000-";

function firstValue(raw: unknown): unknown {
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

function parsePositiveInteger(raw: unknown): number | null {
  const value = firstValue(raw);
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return null;
}

function normalizeOrganizationInput(raw: unknown): string | null {
  const value = firstValue(raw);
  if (value === null || value === undefined) return null;

  const numeric = parsePositiveInteger(value);
  if (numeric !== null) {
    return normalizeOrganizationId(numeric);
  }

  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return normalizeOrganizationId(trimmed);
  } catch {
    return null;
  }
}

export function tenantIdFromCanonicalOrganizationId(
  organizationId: string | null | undefined
): number | null {
  if (!organizationId) return null;
  const normalized = organizationId.trim().toLowerCase();
  if (!normalized.startsWith(CANONICAL_TENANT_UUID_PREFIX)) {
    return null;
  }
  const tenantHex = normalized.slice(CANONICAL_TENANT_UUID_PREFIX.length);
  if (!/^[0-9a-f]{12}$/.test(tenantHex)) {
    return null;
  }
  const parsed = parseInt(tenantHex, 16);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

type ResolveOrganizationContextOptions = {
  req: Pick<CreateExpressContextOptions["req"], "headers" | "query"> & {
    session?: { organizationId?: unknown; tenantId?: unknown };
  };
  user?: User | null;
  explicitOrganizationId?: unknown;
  explicitTenantId?: unknown;
};

export function resolveOrganizationContext({
  req,
  user,
  explicitOrganizationId,
  explicitTenantId,
}: ResolveOrganizationContextOptions): { organizationId: string | null; tenantId: number | null } {
  const requestAsAny = req;
  const userAsAny = user as (User & { organizationId?: unknown; tenantId?: unknown }) | null | undefined;

  const organizationId =
    normalizeOrganizationInput(explicitOrganizationId) ??
    normalizeOrganizationInput(req.headers["x-organization-id"]) ??
    normalizeOrganizationInput(req.headers["x-org-id"]) ??
    normalizeOrganizationInput(req.query.organizationId) ??
    normalizeOrganizationInput(requestAsAny.session?.organizationId) ??
    normalizeOrganizationInput(userAsAny?.organizationId) ??
    normalizeOrganizationInput(explicitTenantId) ??
    normalizeOrganizationInput(req.headers["x-tenant-id"]) ??
    normalizeOrganizationInput(req.query.tenantId) ??
    normalizeOrganizationInput(requestAsAny.session?.tenantId) ??
    normalizeOrganizationInput(userAsAny?.tenantId);

  const tenantId =
    parsePositiveInteger(explicitTenantId) ??
    parsePositiveInteger(req.headers["x-tenant-id"]) ??
    parsePositiveInteger(req.query.tenantId) ??
    parsePositiveInteger(requestAsAny.session?.tenantId) ??
    parsePositiveInteger(userAsAny?.tenantId) ??
    tenantIdFromCanonicalOrganizationId(organizationId);

  return { organizationId, tenantId };
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const user = await authenticateRequest(opts.req);
  const orgContext = resolveOrganizationContext({ req: opts.req, user });

  return {
    req: opts.req,
    res: opts.res,
    user,
    tenantId: orgContext.tenantId,
    organizationId: orgContext.organizationId,
  };
}
