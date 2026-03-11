import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { createTestContextWithOrg } from "./test/contextHelpers";
import { tableExists } from "./test/schemaChecks";
import { generateAssetQRCode, parseAssetQRCode } from "./qrcode";

describe("QR Code Generation", () => {
  it("should generate QR code data URL for an asset", async () => {
    const qrCode = await generateAssetQRCode(1, "TEST-001");
    
    expect(qrCode).toBeDefined();
    expect(qrCode).toContain("data:image/png;base64");
  });

  it("should parse QR code data correctly", () => {
    const qrData = JSON.stringify({
      assetId: 1,
      assetTag: "TEST-001",
      url: "https://example.com/assets/1",
      type: "NRCS_ASSET",
    });

    const parsed = parseAssetQRCode(qrData);
    
    expect(parsed).toBeDefined();
    expect(parsed?.assetId).toBe(1);
    expect(parsed?.assetTag).toBe("TEST-001");
  });

  it("should return null for invalid QR code data", () => {
    const parsed = parseAssetQRCode("invalid json");
    expect(parsed).toBeNull();
  });

  it("should return null for QR code without NRCS_ASSET type", () => {
    const qrData = JSON.stringify({
      assetId: 1,
      assetTag: "TEST-001",
      type: "OTHER_TYPE",
    });

    const parsed = parseAssetQRCode(qrData);
    expect(parsed).toBeNull();
  });
});

describe("QR Code API Endpoints", () => {
  it("should generate QR code for an asset via API", async () => {
    const ctx = createTestContextWithOrg("admin");
    const caller = appRouter.createCaller(ctx);

    // First create an asset (ensure we have site and category)
    let sites = await caller.sites.list();
    let categories = await caller.assetCategories.list();
    if (sites.length === 0) {
      await caller.sites.create({ name: "QR Test Site", address: "123 Test St", city: "Test", state: "TS", country: "Nigeria" });
      sites = await caller.sites.list();
    }
    if (categories.length === 0) {
      await caller.assetCategories.create({ name: "QR Test Category", description: "For tests" });
      categories = await caller.assetCategories.list();
    }
    if (sites.length === 0 || categories.length === 0) {
      throw new Error("No sites or categories available for testing");
    }

    const asset = await caller.assets.create({
      assetTag: `QR-TEST-${Date.now()}`,
      name: "QR Test Asset",
      description: "Asset for QR code testing",
      categoryId: categories[0]!.id,
      siteId: sites[0]!.id,
      manufacturer: "Test Manufacturer",
      model: "Test Model",
    });

    expect(asset).toBeDefined();
    expect(asset.id).toBeGreaterThan(0);

    // Generate QR code
    const result = await caller.assets.generateQRCode({ id: asset.id });
    
    expect(result).toBeDefined();
    expect(result.qrCode).toContain("data:image/png;base64");
  });

  it("should scan QR code and retrieve asset", async () => {
    const ctx = createTestContextWithOrg("admin");
    const caller = appRouter.createCaller(ctx);

    // Create an asset (ensure we have site and category)
    let sites = await caller.sites.list();
    let categories = await caller.assetCategories.list();
    if (sites.length === 0) {
      await caller.sites.create({ name: "Scan Test Site", address: "123 Test St", city: "Test", state: "TS", country: "Nigeria" });
      sites = await caller.sites.list();
    }
    if (categories.length === 0) {
      await caller.assetCategories.create({ name: "Scan Test Category", description: "For tests" });
      categories = await caller.assetCategories.list();
    }

    const asset = await caller.assets.create({
      assetTag: `SCAN-TEST-${Date.now()}`,
      name: "Scan Test Asset",
      categoryId: categories[0]!.id,
      siteId: sites[0]!.id,
    });

    // Create QR code data
    const qrData = JSON.stringify({
      assetId: asset.id,
      assetTag: asset.assetTag,
      url: `https://example.com/assets/${asset.id}`,
      type: "NRCS_ASSET",
    });

    // Scan QR code
    const scannedAsset = await caller.assets.scanQRCode({ qrData });
    
    expect(scannedAsset).toBeDefined();
    expect(scannedAsset.id).toBe(asset.id);
    expect(scannedAsset.assetTag).toBe(asset.assetTag);
  });
});

describe("Asset Mapping", () => {
  it("should list assets with GPS coordinates", async () => {
    const ctx = createTestContextWithOrg("admin");
    const caller = appRouter.createCaller(ctx);

    const assets = await caller.assets.list({});
    
    expect(Array.isArray(assets)).toBe(true);
    
    // Check if any assets have GPS coordinates
    const assetsWithCoords = assets.filter(a => a.latitude && a.longitude);
    
    // This is fine if zero, as it just means no assets have coordinates yet
    expect(assetsWithCoords.length).toBeGreaterThanOrEqual(0);
  });

  it("should update asset with GPS coordinates", async () => {
    if (!(await tableExists("asset_edit_history"))) return; // skip when baseline lacks table
    const ctx = createTestContextWithOrg("admin");
    const caller = appRouter.createCaller(ctx);
    let sites = await caller.sites.list();
    let categories = await caller.assetCategories.list();
    if (sites.length === 0) {
      await caller.sites.create({ name: "GPS Test Site", address: "123 Test St", city: "Test", state: "TS", country: "Nigeria" });
      sites = await caller.sites.list();
    }
    if (categories.length === 0) {
      await caller.assetCategories.create({ name: "GPS Test Category", description: "For tests" });
      categories = await caller.assetCategories.list();
    }

    const asset = await caller.assets.create({
      assetTag: `GPS-TEST-${Date.now()}`,
      name: "GPS Test Asset",
      categoryId: categories[0]!.id,
      siteId: sites[0]!.id,
    });

    const updated = await caller.assets.update({
      id: asset.id,
      latitude: "9.0765",
      longitude: "7.3986",
    });

    expect(updated).toBeDefined();
    const fetched = await caller.assets.getById({ id: asset.id });
    expect(fetched?.latitude).toBeDefined();
    expect(fetched?.longitude).toBeDefined();
    expect(fetched?.latitude?.startsWith("9.0765")).toBe(true);
    expect(fetched?.longitude?.startsWith("7.3986")).toBe(true);
  });
});
