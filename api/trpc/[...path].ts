/**
 * Vercel serverless handler for /api/trpc so tRPC requests return JSON instead of 404 HTML.
 * Ensures auth.setSession and auth.me work when the app is deployed on Vercel.
 * Rate limiting (100 req/15 min per IP) reduces abuse on login/signup and other procedures.
 * Error middleware ensures any uncaught error returns JSON so the client never receives plain text.
 * Uses Express Request/Response types explicitly so TS does not pick Web API Request/Response.
 */
import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
import express, {
  type Request as ExpressRequest,
  type Response as ExpressResponse,
  type NextFunction,
} from "express";
import rateLimit from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../../server/routers";
import { createContext } from "../../server/_core/context";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const trpcLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests; try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/trpc", trpcLimiter);
app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

// Ensure all errors return JSON so the client never gets "A server error..." as plain text
app.use((err: unknown, _req: ExpressRequest, res: ExpressResponse, _next: NextFunction) => {
  if (res.headersSent) return;
  res.setHeader("Content-Type", "application/json");
  res.status(500).end(
    JSON.stringify({
      error: {
        json: {
          message: err instanceof Error ? err.message : "A server error occurred",
          code: "INTERNAL_SERVER_ERROR",
        },
      },
    })
  );
});

export default function handler(req: ExpressRequest, res: ExpressResponse): void {
  try {
    app(req, res);
  } catch (err) {
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/json");
      res.status(500).end(
        JSON.stringify({
          error: {
            json: {
              message: err instanceof Error ? err.message : "A server error occurred",
              code: "INTERNAL_SERVER_ERROR",
            },
          },
        })
      );
    }
  }
}
