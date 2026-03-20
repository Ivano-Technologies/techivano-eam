import type { IncomingMessage, ServerResponse } from "http";
import partHandler from "./part";

/**
 * Backward-compatible alias for legacy frontend callers still using /multipart/url.
 * Canonical endpoint is /multipart/part.
 */
export default function handler(req: IncomingMessage, res: ServerResponse): Promise<void> | void {
  return partHandler(req, res);
}
