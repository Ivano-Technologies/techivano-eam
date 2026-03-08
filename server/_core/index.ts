import "dotenv/config";
// Initialize Sentry first for error tracking
import { initSentry } from "./sentry";
initSentry();

import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getBackgroundQueue } from "../jobs/queue";
import { sdk } from "./sdk";
import { enqueueWarehouseRebalanceJob } from "../jobs/queue";
import { listWarehouseTransferRecommendations } from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // Magic link verification endpoint
  app.post("/api/auth/verify-magic-link", async (req, res) => {
    const { handleMagicLinkVerification } = await import("./magicLinkVerification");
    return handleMagicLinkVerification(req, res);
  });

  app.post("/warehouse/rebalance", async (req, res) => {
    const stockItemId = Number(req.body?.stockItemId);
    const tenantId = Number(req.headers["x-tenant-id"]);
    if (!Number.isInteger(stockItemId) || stockItemId <= 0) {
      return res.status(400).json({ error: "stockItemId must be a positive integer" });
    }
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      return res.status(400).json({ error: "x-tenant-id header is required" });
    }

    try {
      const user = await sdk.authenticateRequest(req);
      const queued = await enqueueWarehouseRebalanceJob({
        tenantId,
        requestedBy: user?.id ?? null,
        stockItemId,
      });
      return res.status(202).json({ queued: true, ...queued });
    } catch (error) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  });

  app.get("/warehouse/recommendations", async (req, res) => {
    const tenantId = Number(req.headers["x-tenant-id"]);
    const stockItemId = req.query.stockItemId ? Number(req.query.stockItemId) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;

    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      return res.status(400).json({ error: "x-tenant-id header is required" });
    }
    if (stockItemId !== undefined && (!Number.isInteger(stockItemId) || stockItemId <= 0)) {
      return res.status(400).json({ error: "stockItemId must be a positive integer" });
    }
    if (!Number.isInteger(limit) || limit <= 0 || limit > 200) {
      return res.status(400).json({ error: "limit must be between 1 and 200" });
    }

    try {
      await sdk.authenticateRequest(req);
      const recommendations = await listWarehouseTransferRecommendations({
        tenantId,
        stockItemId,
        limit,
      });
      return res.json(recommendations);
    } catch (error) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Queue monitoring dashboard
  const bullBoardAdapter = new ExpressAdapter();
  bullBoardAdapter.setBasePath("/admin/queues");
  createBullBoard({
    queues: [new BullMQAdapter(getBackgroundQueue())],
    serverAdapter: bullBoardAdapter,
  });
  app.use("/admin/queues", bullBoardAdapter.getRouter());

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
