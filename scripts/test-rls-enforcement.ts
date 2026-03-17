/**
 * RLS enforcement test: with test user token, request tenant-scoped data and assert
 * no item has a different organization_id. Run after seed-test-user, seed-org-data,
 * and create-test-session (or set TEST_SESSION).
 *
 *   TEST_SESSION='{"access_token":"..."}' TEST_ORG_ID=... E2E_BASE_URL=... pnpm tsx scripts/test-rls-enforcement.ts
 */
import "dotenv/config";

const baseUrl = (process.env.E2E_BASE_URL ?? "http://localhost:33123").replace(/\/$/, "");
const testOrgId = process.env.TEST_ORG_ID;
const rawSession = process.env.TEST_SESSION;

async function run() {
  if (!rawSession) {
    console.error("Missing TEST_SESSION (run create-test-session.ts and set TEST_SESSION)");
    process.exit(1);
  }
  if (!testOrgId) {
    console.error("Missing TEST_ORG_ID (run seed-org-data.ts; it prints TEST_ORG_ID)");
    process.exit(1);
  }

  const session = JSON.parse(rawSession) as { access_token: string };
  const token = session.access_token;
  if (!token) {
    console.error("TEST_SESSION must contain access_token");
    process.exit(1);
  }

  const url = `${baseUrl}/api/trpc/assets.list?input=${encodeURIComponent(JSON.stringify({}))}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Cookie: `app_session_id=${token}`,
      "x-organization-id": testOrgId,
    },
  });

  if (!res.ok) {
    console.error("Request failed:", res.status, await res.text());
    process.exit(1);
  }

  const data = (await res.json()) as {
    result?: { data?: { json?: unknown } };
  };
  const list = data?.result?.data?.json;
  if (!Array.isArray(list)) {
    console.log("No list in response (empty org is ok):", typeof list);
    process.exit(0);
  }

  const invalid = list.find(
    (item: { organizationId?: string; organization_id?: string }) => {
      const orgId = item?.organizationId ?? item?.organization_id;
      return orgId != null && orgId !== testOrgId;
    }
  );

  if (invalid) {
    console.error(
      "RLS violation: item with wrong organization_id:",
      (invalid as { organizationId?: string }).organizationId ?? (invalid as { organization_id?: string }).organization_id
    );
    process.exit(1);
  }

  console.log("✓ RLS enforcement check passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
