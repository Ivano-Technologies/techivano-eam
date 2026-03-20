import type { IncomingMessage, ServerResponse } from "http";

function json(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  return json(res, 200, {
    status: "ok",
    service: "techivano",
    timestamp: new Date().toISOString(),
  });
}
