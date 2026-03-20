import type { IncomingMessage, ServerResponse } from "http";
import os from "node:os";

function json(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { error: "Method not allowed" });
  }
  if (process.env.NODE_ENV === "production") {
    return json(res, 404, { error: "Not found" });
  }
  return json(res, 200, { hostname: os.hostname() });
}
