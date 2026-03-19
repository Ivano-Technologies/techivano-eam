import { parse as parseCookie } from "cookie";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Request as ExpressRequest } from "express";
import type { User } from "../../drizzle/schema";
import { COOKIE_NAME, SESSION_COOKIE_NAME } from "@shared/const";
import { normalizeOrganizationId, getUserBySupabaseUserId, getSessionById, touchSessionLastSeen } from "../db";
import { authenticateRequest } from "./authenticateRequest";
import { getMembership } from "./getMembership";
import { getSessionCookieOptions } from "./cookies";
import { ENV, isGlobalOwnerEmail } from "./env";
import { verifyImpersonationToken } from "./impersonationToken";

export type MembershipContext = {
  role: string;
  permissions: Record<string, boolean>;
};

/** Host-based app variant for single deployment with multiple domains (admin / nrcs / marketing). */
export type AppVariant = "admin" | "nrcs" | "marketing";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  tenantId: number | null;
  organizationId: string | null;
  membership: MembershipContext | null;
  /** Host-based app: admin.techivano.com | nrcseam.techivano.com | marketing (apex). Enables RBAC/env isolation. */
  appVariant: AppVariant;
  /** True when user email is in GLOBAL_OWNER_EMAILS (MFA enforced for these accounts). */
  isGlobalOwner: boolean;
  /** When impersonating: the Supabase user id of the admin who started impersonation. */
  impersonatorId?: string;
  /** True when request is made with valid x-impersonation header (acting as target user). */
  isImpersonating?: boolean;
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

/** Normalize host from request (lowercase, no port). */
export function getHostFromRequest(req: { headers: Record<string, string | string[] | undefined> }): string {
  const raw = (req.headers["x-forwarded-host"] ?? req.headers.host) ?? "";
  const value = Array.isArray(raw) ? raw[0] : raw;
  const host = (value ?? "").split(":")[0].trim().toLowerCase();
  return host;
}

/** Single EAM app at techivano.com; marketing and admin/nrcseam subdomains disabled. */
export function getAppVariantFromHost(_host: string): AppVariant {
  return "nrcs";
}

/** Resolve organizationId and tenantId. Main site techivano.com (and localhost) use NRCS org. */
function getOrganizationContextFromHost(host: string): { organizationId: string | null; tenantId: number | null } {
  if (!host) return { organizationId: null, tenantId: null };
  const isMainSite =
    host === "techivano.com" ||
    host === "www.techivano.com" ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.includes("nrcseam.techivano.com");
  if (isMainSite && ENV.hostOrgNrcs) {
    const organizationId = ENV.hostOrgNrcs;
    const tenantId = tenantIdFromCanonicalOrganizationId(organizationId);
    return { organizationId, tenantId };
  }
  if (host.includes("admin.techivano.com") && ENV.hostOrgAdmin) {
    const organizationId = ENV.hostOrgAdmin;
    const tenantId = tenantIdFromCanonicalOrganizationId(organizationId);
    return { organizationId, tenantId };
  }
  return { organizationId: null, tenantId: null };
}

/** Uses Express Request so types are stable when used from api/trpc (Vercel) and server. */
type ResolveOrganizationContextOptions = {
  req: ExpressRequest & { session?: { organizationId?: unknown; tenantId?: unknown } };
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
  const host = getHostFromRequest(req);
  const fromHost = getOrganizationContextFromHost(host);
  if (fromHost.organizationId) {
    return fromHost;
  }

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
  const req = opts.req as ExpressRequest;
  const res = opts.res;
  const host = getHostFromRequest(req);
  const appVariant = getAppVariantFromHost(host);
  (req as ExpressRequest & { appVariant?: AppVariant }).appVariant = appVariant;
  const user = await authenticateRequest(req);

  let userToUse: User | null = user;
  const cookieHeader = req.headers.cookie;
  const currentSessionId =
    typeof cookieHeader === "string" ? parseCookie(cookieHeader)[SESSION_COOKIE_NAME] : undefined;
  if (typeof cookieHeader === "string" && user && currentSessionId) {
    const sessionRow = await getSessionById(currentSessionId);
    if (sessionRow?.revoked) {
      const cookieOptions = getSessionCookieOptions(req);
      res.clearCookie(SESSION_COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      userToUse = null;
    } else {
      touchSessionLastSeen(currentSessionId).catch(() => {});
    }
  }

  const orgContext = resolveOrganizationContext({ req, user: userToUse });

  let membership: MembershipContext | null = null;
  if (userToUse && orgContext.organizationId) {
    const supabaseUserId = (userToUse as User & { supabaseUserId?: string | null }).supabaseUserId;
    if (typeof supabaseUserId === "string" && supabaseUserId) {
      membership = await getMembership(supabaseUserId, orgContext.organizationId);
    }
    // Global owner emails are always elevated to owner for the resolved org (docs/FINAL_AUTH_POLICY.md)
    if (!membership && isGlobalOwnerEmail((userToUse as User & { email?: string | null }).email)) {
      membership = { role: "owner", permissions: {} };
    }
  }

  let isGlobalOwner = isGlobalOwnerEmail((userToUse as User & { email?: string | null })?.email ?? null);
  let effectiveUser: User | null = userToUse;
  let impersonatorId: string | undefined;
  let isImpersonating = false;

  const impHeader = req.headers["x-impersonation"];
  const impRaw = typeof impHeader === "string" ? impHeader : Array.isArray(impHeader) ? impHeader[0] : undefined;
  if (userToUse && impRaw?.trim()) {
    const payload = verifyImpersonationToken(impRaw.trim(), currentSessionId);
    const supabaseUserId = (userToUse as User & { supabaseUserId?: string | null }).supabaseUserId;
    if (
      payload &&
      typeof supabaseUserId === "string" &&
      payload.impersonatorId === supabaseUserId &&
      isGlobalOwner
    ) {
      const targetUser = await getUserBySupabaseUserId(payload.targetUserId);
      if (targetUser && targetUser.supabaseUserId !== supabaseUserId) {
        effectiveUser = targetUser as User;
        impersonatorId = payload.impersonatorId;
        isImpersonating = true;
        if (orgContext.organizationId) {
          membership = await getMembership(payload.targetUserId, orgContext.organizationId);
          if (!membership && isGlobalOwnerEmail((targetUser as User & { email?: string | null }).email)) {
            membership = { role: "owner", permissions: {} };
          }
        }
        isGlobalOwner = isGlobalOwnerEmail((targetUser as User & { email?: string | null }).email);
      }
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user: effectiveUser,
    tenantId: orgContext.tenantId,
    organizationId: orgContext.organizationId,
    membership,
    appVariant,
    isGlobalOwner,
    ...(impersonatorId !== undefined && { impersonatorId }),
    ...(isImpersonating && { isImpersonating: true }),
  };
}
