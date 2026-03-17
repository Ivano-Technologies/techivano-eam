import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

/** True if the path looks like a client route (e.g. /login, /) not a static asset or API. */
function isClientRoute(pathname: string): boolean {
  if (pathname.startsWith("/api") || pathname.startsWith("/admin")) return false;
  if (pathname.startsWith("/@") || pathname.startsWith("/node_modules")) return false;
  if (pathname.includes(".") && /\.(js|tsx?|css|ico|png|svg|woff2?)(\?|$)/i.test(pathname)) return false;
  return true;
}

const projectRoot = path.resolve(import.meta.dirname ?? process.cwd(), "..", "..");
const clientRoot = path.join(projectRoot, "client");
const configPath = path.join(projectRoot, "vite.config.ts");
const serverOptions = { middlewareMode: true, hmr: {} as { server: Server }, allowedHosts: true as const };

async function createVite(server: Server) {
  return createViteServer({
    configFile: fs.existsSync(configPath) ? configPath : false,
    root: clientRoot,
    publicDir: path.join(clientRoot, "public"),
    server: { ...serverOptions, hmr: { server } },
    appType: "custom",
    ...(!fs.existsSync(configPath) && { plugins: viteConfig.plugins, resolve: viteConfig.resolve, envDir: viteConfig.envDir ?? projectRoot, build: viteConfig.build }),
  });
}

/** Creates Vite and the module middleware so index can register the middleware before SPA routes. */
export async function setupViteModuleMiddleware(_app: Express, server: Server) {
  const vite = await createVite(server);
  const transformModule = async (url: string): Promise<{ code: string } | null> => {
    const env = vite.environments?.client as { transformRequest?: (u: string, opts?: { allowId?: (id: string) => boolean }) => Promise<{ code?: string } | null> } | undefined;
    const allowId = () => true;
    if (env?.transformRequest) {
      const r = await env.transformRequest(url, { allowId });
      return r?.code != null ? { code: r.code } : null;
    }
    const r = await vite.transformRequest(url as string, { allowId } as Parameters<typeof vite.transformRequest>[1]);
    return r?.code != null ? { code: r.code } : null;
  };
  const moduleMiddleware: express.RequestHandler = async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const raw = (req.originalUrl ?? req.url ?? "").split("?")[0] ?? "/";
    let pathname: string;
    try {
      pathname = decodeURIComponent(raw);
    } catch {
      pathname = raw;
    }
    const isModulePath =
      pathname.startsWith("/src/") ||
      pathname.startsWith("/@vite/") ||
      pathname.startsWith("/@react-refresh") ||
      pathname.includes("@vite") ||
      pathname.startsWith("/node_modules/") ||
      pathname.startsWith("/@id/");
    if (!isModulePath) return next();

    const rawUrl = req.originalUrl ?? req.url ?? pathname;
    const host = req.get("host") ?? "localhost";
    const proto = req.protocol === "https" ? "https" : "http";
    const fullUrl = `${proto}://${host}${rawUrl}`;
    // Vite transform middleware uses path (req.url); try path first then full URL.
    const urlsToTry = [rawUrl, fullUrl];
    for (const url of urlsToTry) {
      try {
        const result = await transformModule(url);
        if (result != null) {
          res.setHeader("Content-Type", "application/javascript; charset=UTF-8");
          return res.end(result.code);
        }
      } catch {
        //
      }
    }
    res.status(404).setHeader("Content-Type", "text/plain").end("Not found");
  };
  return { vite, moduleMiddleware };
}

export async function setupVite(app: Express, server: Server, existingVite?: Awaited<ReturnType<typeof createVite>>) {
  const vite = existingVite ?? (await createVite(server));

  const fromCwd = path.join(process.cwd(), "client", "index.html");
  const clientTemplate = fs.existsSync(fromCwd) ? fromCwd : path.join(projectRoot, "client", "index.html");
  const fallbackTemplatePath = path.join(import.meta.dirname ?? projectRoot, "public", "index.html");
  if (process.env.NODE_ENV === "development" && !fs.existsSync(clientTemplate)) {
    console.warn("[vite] client index.html not found at", clientTemplate, "(cwd:", process.cwd(), ")");
  }

  async function loadTemplate(): Promise<string> {
    try {
      return await fs.promises.readFile(clientTemplate, "utf-8");
    } catch {
      if (fs.existsSync(fallbackTemplatePath)) {
        return await fs.promises.readFile(fallbackTemplatePath, "utf-8");
      }
      throw new Error(`SPA template not found at ${clientTemplate} or ${fallbackTemplatePath}`);
    }
  }

  async function serveSpa(req: express.Request, res: express.Response, next: express.NextFunction) {
    const url = req.originalUrl || req.path || "/";
    if (process.env.NODE_ENV === "development") {
      console.log("[vite] serving SPA for", req.method, url);
    }
    try {
      let template = await loadTemplate();
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      let page: string;
      if (process.env.NODE_ENV === "development") {
        const devPreamble = `<script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/@vite/client"></script>`;
        page = template.replace(/<head>/i, `<head>${devPreamble}`);
      } else {
        try {
          page = await vite.transformIndexHtml(url, template);
        } catch {
          page = template;
        }
      }
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.error("[vite] SPA serve error for", url, (e as Error)?.message ?? e);
      }
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  }

  // Don't pass module paths to Vite middlewares (they can return HTML). Module requests are handled earlier in index.
  app.use((req, res, next) => {
    const rawPath = req.path ?? req.url ?? "/";
    let pathname: string;
    try {
      pathname = decodeURIComponent(rawPath.split("?")[0] || "/");
    } catch {
      pathname = rawPath.split("?")[0] || "/";
    }
    if (
      pathname.startsWith("/src/") ||
      pathname.startsWith("/@vite/") ||
      pathname.startsWith("/@react-refresh") ||
      pathname.startsWith("/node_modules/") ||
      pathname.startsWith("/@id/")
    ) {
      if (!res.headersSent) res.status(404).setHeader("Content-Type", "text/plain").end("Not found");
      return;
    }
    return vite.middlewares(req, res, next);
  });

  // Serve SPA for client routes Vite didn't handle (e.g. /login when reached via setupVite, /assets, /work-orders)
  app.use(async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const pathname = req.path || "/";
    if (!isClientRoute(pathname)) return next();
    return serveSpa(req, res, next);
  });

  // Fallback for any other GET (e.g. if Vite didn't handle it). Never serve HTML for script/module/virtual paths.
  app.use("*", async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const pathname = req.path || "/";
    const isScriptOrModule =
      pathname.startsWith("/src/") ||
      pathname.startsWith("/@vite/") ||
      pathname.startsWith("/@react-refresh") ||
      pathname.startsWith("/node_modules/") ||
      pathname.startsWith("/@id/") ||
      /\.(m?tsx?|m?jsx?)(\?|$)/i.test(pathname);
    if (isScriptOrModule) {
      return next();
    }
    try {
      let template = await loadTemplate();
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      let page: string;
      if (process.env.NODE_ENV === "development") {
        const devPreamble = `<script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/@vite/client"></script>`;
        page = template.replace(/<head>/i, `<head>${devPreamble}`);
      } else {
        try {
          page = await vite.transformIndexHtml(req.originalUrl || "/", template);
        } catch {
          page = template;
        }
      }
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
