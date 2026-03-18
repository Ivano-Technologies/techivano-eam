import { request, type FullConfig } from "@playwright/test";
import fs from "node:fs";

const STORAGE_STATE_PATH = "tests/storageState.json";

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!;
  const ctx = await request.newContext();

  const res = await ctx.post(`${baseURL}/api/dev-login`);
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`dev-login failed (${res.status()}): ${body}`);
  }

  const storage = await ctx.storageState();
  fs.writeFileSync(STORAGE_STATE_PATH, JSON.stringify(storage));

  await ctx.dispose();
}

export default globalSetup;
