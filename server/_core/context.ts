import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  tenantId?: number | null;
};

function parseTenantId(raw: unknown): number | null {
  const parsed = typeof raw === "string" ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return null;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    tenantId: parseTenantId(opts.req.headers["x-tenant-id"]),
  };
}
