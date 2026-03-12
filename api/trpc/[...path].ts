/**
 * Vercel serverless handler for /api/trpc so tRPC requests return JSON instead of 404 HTML.
 * Ensures auth.setSession and auth.me work when the app is deployed on Vercel.
 */
import "dotenv/config";
import express, { type Request, type Response } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../../server/routers";
import { createContext } from "../../server/_core/context";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

export default function handler(req: Request, res: Response): void {
  app(req, res);
}
