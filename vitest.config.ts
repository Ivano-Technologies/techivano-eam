import { defineConfig } from "vitest/config";
import path from "path";
import "dotenv/config";

const templateRoot = path.resolve(import.meta.dirname);
const hasDatabase = Boolean(process.env.DATABASE_URL);
const dbRequiredTests = [
  "server/auth.password.test.ts",
  "server/auth.passwordReset.test.ts",
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
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    exclude: hasDatabase ? [] : dbRequiredTests,
  },
});
