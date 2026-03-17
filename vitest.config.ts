import { defineConfig } from "vitest/config";
import path from "path";
import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { alias } from "./config/aliases";

const templateRoot = path.resolve(import.meta.dirname);
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = "test_jwt_secret_32_characters_min_key";
}
if (!process.env.APP_SECRET || process.env.APP_SECRET.length < 32) {
  process.env.APP_SECRET = "test_app_secret_32_chars_minimum_key";
}
const databaseUrl = process.env.DATABASE_URL?.trim();
const hasDatabase = Boolean(
  databaseUrl &&
    !databaseUrl.includes("YOUR_PROJECT_REF") &&
    !databaseUrl.includes("YOUR_PASSWORD"),
);
const dbRequiredTests = [
  "server/auth.password.test.ts",
  "server/auth.passwordReset.test.ts",
  "server/bulkSiteImport.test.ts",
  "server/bulkUserManagement.test.ts",
  "server/eam.test.ts",
  "server/notifications.test.ts",
  "server/qrcode.test.ts",
  "server/quickbooks.test.ts",
  "server/userSearchFilter.test.ts",
  "server/userVerification.test.ts",
];

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      ...alias,
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    exclude: hasDatabase ? [] : dbRequiredTests,
    setupFiles: hasDatabase ? ["server/test/bootstrapLegacyTables.ts"] : [],
    testTimeout: 15000,
    hookTimeout: 120000,
    fileParallelism: false,
  },
});
