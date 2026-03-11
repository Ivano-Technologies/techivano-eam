# Techivano EAM — Backend Status

Quick reference for the current Supabase backend state after the fresh baseline migration.

---

## Verification

- **Migration:** `supabase migration list` should show only **20260312100000_fresh_schema**.
- **Tables:** Supabase Dashboard → Table Editor — organizations, organization_members, tenant_organization_map, users, sites, assets, workOrders, maintenanceSchedules, inventoryItems, inventoryTransactions, vendors, complianceRecords, documents, assetPhotos, inspections, platform_events, telemetry_anomaly_events, etc.

---

## System Status

| System | Status |
|--------|--------|
| Supabase Auth | ✅ |
| Multi-tenant schema | ✅ |
| Tenant guardrail | ✅ |
| RLS policies | ✅ |
| Tenant indexes | ✅ |
| Clean baseline migration | ✅ |
| CI migration validation | ✅ |

---

## Schema (from baseline)

- **Tenancy:** organizations, organization_members, tenant_organization_map
- **EAM core:** users, sites, assets, workOrders, maintenanceSchedules, inventoryItems, inventoryTransactions, vendors, complianceRecords, documents, assetPhotos, inspections
- **Platform:** platform_events, warehouse_transfer_recommendations, vendor_performance, integration_connectors, telemetry_anomaly_events
- **App:** organization_encryption_keys, workOrderTemplates, passwordResetTokens, userPreferences, email_templates, emailNotifications, importHistory

---

## Migration Layout

```
supabase/
├── config.toml
└── migrations/
    └── 20260312100000_fresh_schema.sql
```

Future changes: add new migrations (e.g. `20260401_add_asset_warranty.sql`, `20260410_add_asset_location.sql`). Keep this file as the single baseline.

---

## RLS Guardrail

- Tenant context: `set_config('app.tenant_id', organization_id, true)` per request.
- Without tenant context: `SELECT * FROM assets` (and other tenant-scoped tables) returns **0 rows** — confirms RLS guardrail is working.
- See `docs/POSTGRES_TENANT_GUARDRAIL_VERIFICATION.md` for full verification steps.
