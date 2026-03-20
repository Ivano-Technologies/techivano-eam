import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import trpcHandler from "../../api/trpc/[...path]";
import healthHandler from "../../api/health";
import devLoginHandler from "../../api/dev-login";
import devHostnameHandler from "../../api/dev-hostname";
import devAdminLoginHandler from "../../api/dev-admin-login";
import googleAuthHandler from "../../api/auth/google";
import googleCallbackHandler from "../../api/auth/google/callback";
import verifyMagicLinkHandler from "../../api/auth/verify-magic-link";
import uploadSignedUrlHandler from "../../api/uploads/signed-url";
import uploadCompleteHandler from "../../api/uploads/complete";
import uploadMultipartStartHandler from "../../api/uploads/multipart/start";
import uploadMultipartPartHandler from "../../api/uploads/multipart/part";
import uploadMultipartUrlHandler from "../../api/uploads/multipart/url";
import uploadMultipartCompleteHandler from "../../api/uploads/multipart/complete";
import testProtectedHandler from "../../api/test/protected";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const publicDir = path.join(rootDir, "dist", "public");
const indexHtmlPath = path.join(publicDir, "index.html");

type Handler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
type Route = { method: string; path: string; handler: Handler };

const routes: Route[] = [
  { method: "ALL", path: "/api/trpc/", handler: trpcHandler as unknown as Handler },
  { method: "GET", path: "/api/health", handler: healthHandler },
  { method: "POST", path: "/api/dev-login", handler: devLoginHandler },
  { method: "GET", path: "/api/dev-hostname", handler: devHostnameHandler },
  { method: "POST", path: "/api/dev-admin-login", handler: devAdminLoginHandler },
  { method: "GET", path: "/api/auth/google", handler: googleAuthHandler },
  { method: "GET", path: "/api/auth/google/callback", handler: googleCallbackHandler },
  { method: "POST", path: "/api/auth/verify-magic-link", handler: verifyMagicLinkHandler },
  { method: "POST", path: "/api/uploads/signed-url", handler: uploadSignedUrlHandler },
  { method: "POST", path: "/api/uploads/complete", handler: uploadCompleteHandler },
  { method: "POST", path: "/api/uploads/multipart/start", handler: uploadMultipartStartHandler },
  { method: "POST", path: "/api/uploads/multipart/part", handler: uploadMultipartPartHandler },
  { method: "POST", path: "/api/uploads/multipart/url", handler: uploadMultipartUrlHandler },
  { method: "POST", path: "/api/uploads/multipart/complete", handler: uploadMultipartCompleteHandler },
  { method: "GET", path: "/api/test/protected", handler: testProtectedHandler },
];

function notFound(res: ServerResponse): void {
  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: "Not found" }));
}

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".ico") return "image/x-icon";
  return "application/octet-stream";
}

async function serveStatic(pathname: string, res: ServerResponse): Promise<boolean> {
  const normalized = pathname === "/" ? "/index.html" : pathname;
  const targetPath = path.join(publicDir, normalized);
  const safePath = path.normalize(targetPath);
  if (!safePath.startsWith(publicDir)) return false;
  try {
    const stat = await fs.stat(safePath);
    if (!stat.isFile()) return false;
    const body = await fs.readFile(safePath);
    res.statusCode = 200;
    res.setHeader("Content-Type", contentTypeFor(safePath));
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

async function serveSpa(res: ServerResponse): Promise<void> {
  try {
    const html = await fs.readFile(indexHtmlPath, "utf8");
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(html);
  } catch {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Missing dist/public/index.html. Run pnpm build first.");
  }
}

function matchRoute(req: IncomingMessage, pathname: string): Handler | null {
  const method = (req.method || "GET").toUpperCase();
  for (const route of routes) {
    if (route.path === "/api/trpc/") {
      if (pathname.startsWith("/api/trpc/") && (route.method === "ALL" || route.method === method)) {
        return route.handler;
      }
      continue;
    }
    if (route.path === pathname && (route.method === "ALL" || route.method === method)) {
      return route.handler;
    }
  }
  return null;
}

export function startServerlessRuntime(port: number): void {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      const pathname = url.pathname;

      const routeHandler = matchRoute(req, pathname);
      if (routeHandler) {
        await routeHandler(req, res);
        return;
      }

      if (pathname.startsWith("/api/")) {
        notFound(res);
        return;
      }

      const served = await serveStatic(pathname, res);
      if (served) return;
      await serveSpa(res);
    } catch {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    }
  });

  server.listen(port, () => {
    // Keep message format stable for existing scripts/log checks.
    console.log(`Server running on http://localhost:${port}/`);
  });
}
