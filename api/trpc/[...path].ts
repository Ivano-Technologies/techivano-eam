/**
 * Serverless tRPC handler for /api/trpc without Express dependency.
 * Uses standalone adapter so runtime matches Vercel/serverless execution model.
 */
import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import type { IncomingMessage, ServerResponse } from "http";
import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import { appRouter } from "../../server/routers";
import { createContext } from "../../server/_core/context";

function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof value === "string" && value.trim()) {
    return value.split(",")[0]?.trim() || "";
  }
  return (req.socket.remoteAddress ?? "").trim();
}

const trpcHandler = createHTTPHandler({
  router: appRouter,
  createContext: async (opts) => {
    const req = opts.req as IncomingMessage & {
      protocol?: string;
      ip?: string;
      path?: string;
      query?: Record<string, string>;
      get?: (name: string) => string;
    };
    const proto = req.headers["x-forwarded-proto"];
    const firstProto = Array.isArray(proto) ? proto[0] : proto;
    req.protocol = firstProto === "https" ? "https" : "http";
    req.ip = getClientIp(req);
    req.path = req.url?.split("?")[0] ?? "/api/trpc";
    req.query = {};
    req.get = (name: string) => {
      const header = req.headers[name.toLowerCase()];
      return Array.isArray(header) ? (header[0] ?? "") : (header ?? "");
    };
    return createContext({
      req: req as never,
      res: opts.res as never,
    });
  },
  onError: ({ error, req, path }) => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[trpc][serverless]", req.method, path, error.message);
    }
  },
});

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  trpcHandler(req, res);
}
