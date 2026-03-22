const forbiddenEnv = ["ENABLE_TEST_AUTH", "OAUTH_E2E_MOCK", "ALLOW_E2E_DEV_LOGIN"];
const isProd = process.env.NODE_ENV === "production";

if (isProd) {
  for (const key of forbiddenEnv) {
    if (process.env[key]) {
      console.error(`❌ Forbidden auth flag in production: ${key}`);
      process.exit(1);
    }
  }
}

console.log("✅ Auth safety check passed");
