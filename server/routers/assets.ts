// @ts-nocheck — assets sub-router (HIGH-11)
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router } from "../_core/trpc";
import { adminProcedure, managerOrAdminProcedure, viewerProcedure } from "./_shared";
import * as db from "../db";
import * as notificationHelper from "../notificationHelper";
import { parseFileData, bulkImportAssets, generateAssetsTemplate } from "../bulkImport";
import { exportToCSV, exportToExcel, formatAssetsForExport } from "../bulkExport";

export const assetsRouter = router({
  list: viewerProcedure
    .input(
      z
        .object({
          siteId: z.number().optional(),
          status: z.string().optional(),
          categoryId: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      return await db.getAllAssets({
        ...input,
        organizationId: ctx.organizationId ?? undefined,
      });
    }),
  getById: viewerProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await db.getAssetById(input.id);
    }),
  getByTag: viewerProcedure
    .input(z.object({ assetTag: z.string() }))
    .query(async ({ input }) => {
      return await db.getAssetByTag(input.assetTag);
    }),
  search: viewerProcedure
    .input(z.object({ searchTerm: z.string() }))
    .query(async ({ input }) => {
      return await db.searchAssets(input.searchTerm);
    }),
  create: managerOrAdminProcedure
    .input(
      z.object({
        assetTag: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        categoryId: z.number(),
        siteId: z.number(),
        status: z.string().default("In Use"),
        manufacturer: z.string().optional(),
        model: z.string().optional(),
        serialNumber: z.string().optional(),
        acquisitionDate: z.date().optional(),
        acquisitionCost: z.string().optional(),
        currentValue: z.string().optional(),
        depreciationRate: z.string().optional(),
        warrantyExpiry: z.date().optional(),
        location: z.string().optional(),
        assignedTo: z.number().optional(),
        imageUrl: z.string().optional(),
        notes: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        itemType: z.enum(["Asset", "Inventory"]).default("Asset"),
        subCategory: z.string().optional(),
        branchCode: z.string().optional(),
        itemCategoryCode: z.string().optional(),
        assetNumber: z.number().optional(),
        productNumber: z.string().optional(),
        methodOfAcquisition: z.string().optional(),
        acquisitionDetails: z.string().optional(),
        projectReference: z.string().optional(),
        yearAcquired: z.number().optional(),
        acquiredCondition: z.enum(["New", "Used"]).optional(),
        currentDepreciatedValue: z.string().optional(),
        assignedToName: z.string().optional(),
        department: z.string().optional(),
        condition: z.string().optional(),
        lastPhysicalCheckDate: z.date().optional(),
        checkConductedBy: z.string().optional(),
        remarks: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await db.createAsset({
        ...input,
        organizationId: ctx.organizationId ?? undefined,
      });
    }),
  generateQRCode: viewerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { generateAssetQRCode } = await import("../qrcode");
      const asset = await db.getAssetById(input.id);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
      const qrCode = await generateAssetQRCode(asset.id, asset.assetTag);
      await db.updateAsset(asset.id, { qrCode });
      return { qrCode };
    }),
  generateBulkQRCodeLabels: viewerProcedure
    .input(
      z.object({
        assetIds: z.array(z.number()),
        labelSize: z.enum(["avery_5160", "avery_5163", "custom"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { generateBulkQRCodeLabels } = await import("../qrcode");
      const assets = [];
      for (const id of input.assetIds) {
        const asset = await db.getAssetById(id);
        if (asset) {
          assets.push({
            id: asset.id,
            assetTag: asset.assetTag,
            name: asset.name,
          });
        }
      }
      if (assets.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No valid assets found",
        });
      }
      const pdfBuffer = await generateBulkQRCodeLabels(assets, input.labelSize);
      return {
        data: pdfBuffer.toString("base64"),
        filename: `qr-labels-${Date.now()}.pdf`,
        mimeType: "application/pdf",
      };
    }),
  scanQRCode: viewerProcedure
    .input(z.object({ qrData: z.string() }))
    .query(async ({ input }) => {
      const { parseAssetQRCode } = await import("../qrcode");
      const parsed = parseAssetQRCode(input.qrData);
      if (!parsed)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid QR code" });
      const asset = await db.getAssetById(parsed.assetId);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
      return asset;
    }),
  generateBarcode: viewerProcedure
    .input(
      z.object({
        id: z.number(),
        format: z.enum(["CODE128", "CODE39", "EAN13"]).default("CODE128"),
      })
    )
    .mutation(async ({ input }) => {
      const { generateBarcode, generateBarcodeValue } = await import("../barcode");
      const asset = await db.getAssetById(input.id);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
      const barcodeValue = generateBarcodeValue(asset.assetTag, input.format);
      const barcodeImage = generateBarcode(barcodeValue, input.format);
      await db.updateAsset(input.id, {
        barcode: barcodeValue,
        barcodeFormat: input.format,
      });
      return { barcode: barcodeValue, image: barcodeImage, format: input.format };
    }),
  scanBarcode: viewerProcedure
    .input(z.object({ barcode: z.string() }))
    .query(async ({ input }) => {
      const asset = await db.getAssetByBarcode(input.barcode);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
      return asset;
    }),
  update: managerOrAdminProcedure
    .input(
      z.object({
        id: z.number(),
        assetTag: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        categoryId: z.number().optional(),
        siteId: z.number().optional(),
        status: z.string().optional(),
        manufacturer: z.string().optional(),
        model: z.string().optional(),
        serialNumber: z.string().optional(),
        acquisitionDate: z.date().optional(),
        acquisitionCost: z.string().optional(),
        currentValue: z.string().optional(),
        depreciationRate: z.string().optional(),
        warrantyExpiry: z.date().optional(),
        location: z.string().optional(),
        assignedTo: z.number().optional(),
        imageUrl: z.string().optional(),
        notes: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        itemType: z.enum(["Asset", "Inventory"]).optional(),
        subCategory: z.string().optional(),
        branchCode: z.string().optional(),
        itemCategoryCode: z.string().optional(),
        assetNumber: z.number().optional(),
        productNumber: z.string().optional(),
        methodOfAcquisition: z.string().optional(),
        acquisitionDetails: z.string().optional(),
        projectReference: z.string().optional(),
        yearAcquired: z.number().optional(),
        acquiredCondition: z.enum(["New", "Used"]).optional(),
        currentDepreciatedValue: z.string().optional(),
        assignedToName: z.string().optional(),
        department: z.string().optional(),
        condition: z.string().optional(),
        lastPhysicalCheckDate: z.date().optional(),
        checkConductedBy: z.string().optional(),
        remarks: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const currentAsset = await db.getAssetById(id);
      if (currentAsset) {
        for (const [field, newValue] of Object.entries(data)) {
          const oldValue = currentAsset[field as keyof typeof currentAsset];
          const oldStr = oldValue != null ? String(oldValue) : null;
          const newStr = newValue != null ? String(newValue) : null;
          if (oldStr !== newStr) {
            await db.logAssetEdit({
              assetId: id,
              userId: ctx.user.id,
              fieldName: field,
              oldValue: oldStr,
              newValue: newStr,
            });
          }
        }
      }
      await db.logAuditEntry({
        userId: ctx.user.id,
        action: "update",
        entityType: "asset",
        entityId: id,
        changes: JSON.stringify(data),
      });
      return await db.updateAsset(id, data);
    }),
  getExpiringWarranties: viewerProcedure.query(async () => {
    return await db.getExpiringWarranties();
  }),
  sendWarrantyAlert: managerOrAdminProcedure
    .input(z.object({ assetId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const asset = await db.getAssetById(input.assetId);
      if (!asset || !asset.warrantyExpiry) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Asset not found or no warranty expiry date",
        });
      }
      const daysUntilExpiry = Math.ceil(
        (new Date(asset.warrantyExpiry).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      );
      await notificationHelper.sendWarrantyExpirationAlert({
        assetId: asset.id,
        assetName: asset.name,
        assetTag: asset.assetTag,
        warrantyExpiry: asset.warrantyExpiry,
        daysUntilExpiry,
        manufacturer: asset.manufacturer || "N/A",
        model: asset.model || "N/A",
      });
      return { success: true };
    }),
  bulkDelete: adminProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ input, ctx }) => {
      let deleted = 0;
      for (const id of input.ids) {
        try {
          await db.deleteAsset(id);
          await db.createAuditLog({
            userId: ctx.user.id,
            action: "bulk_delete_asset",
            entityType: "asset",
            entityId: id,
          });
          deleted++;
        } catch (error) {
          console.error(`Failed to delete asset ${id}:`, error);
        }
      }
      return { deleted, total: input.ids.length };
    }),
  bulkUpdateStatus: managerOrAdminProcedure
    .input(
      z.object({
        ids: z.array(z.number()),
        status: z.enum([
          "operational",
          "maintenance",
          "repair",
          "retired",
          "disposed",
        ]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let updated = 0;
      for (const id of input.ids) {
        try {
          await db.updateAsset(id, { status: input.status });
          await db.createAuditLog({
            userId: ctx.user.id,
            action: "bulk_update_asset_status",
            entityType: "asset",
            entityId: id,
            changes: JSON.stringify({ status: input.status }),
          });
          updated++;
        } catch (error) {
          console.error(`Failed to update asset ${id}:`, error);
        }
      }
      return { updated, total: input.ids.length };
    }),
  bulkUpdate: managerOrAdminProcedure
    .input(
      z.object({
        assetIds: z.array(z.number()),
        updates: z.object({
          status: z.string().optional(),
          location: z.string().optional(),
          department: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let updated = 0;
      for (const id of input.assetIds) {
        try {
          await db.updateAsset(id, input.updates);
          await db.createAuditLog({
            userId: ctx.user.id,
            action: "bulk_update_asset",
            entityType: "asset",
            entityId: id,
            changes: JSON.stringify(input.updates),
          });
          updated++;
        } catch (error) {
          console.error(`Failed to update asset ${id}:`, error);
        }
      }
      return { updated, total: input.assetIds.length };
    }),
  bulkImport: adminProcedure
    .input(
      z.object({
        fileContent: z.string(),
        fileType: z.enum(["csv", "excel"]),
        fileName: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const data = parseFileData(input.fileContent, input.fileType);
      return await bulkImportAssets(
        data,
        ctx.user.id,
        input.fileName,
        input.fileType,
        ctx.organizationId ?? undefined
      );
    }),
  downloadTemplate: viewerProcedure
    .input(z.object({ format: z.enum(["csv", "excel"]) }))
    .query(({ input }) => {
      const template = generateAssetsTemplate(input.format);
      return { template, format: input.format };
    }),
  export: viewerProcedure
    .input(z.object({ format: z.enum(["csv", "excel"]) }))
    .query(async ({ input, ctx }) => {
      const assets = await db.getAllAssets({
        organizationId: ctx.organizationId ?? undefined,
      });
      const formatted = formatAssetsForExport(assets);
      const data =
        input.format === "csv"
          ? exportToCSV(formatted)
          : exportToExcel(formatted, "Assets");
      return {
        data,
        format: input.format,
        filename: `assets_export.${input.format === "csv" ? "csv" : "xlsx"}`,
      };
    }),
  getEditHistory: viewerProcedure
    .input(z.object({ assetId: z.number() }))
    .query(async ({ input }) => {
      return await db.getAssetEditHistory(input.assetId);
    }),
});
