// @ts-nocheck — sites sub-router (HIGH-11)
import { z } from "zod";
import { router } from "../_core/trpc";
import { adminProcedure, managerOrAdminProcedure, viewerProcedure } from "./_shared";
import * as db from "../db";
import {
  parseFileData,
  bulkImportSites,
  generateSitesTemplate,
} from "../bulkImport";
import { exportToCSV, exportToExcel, formatSitesForExport } from "../bulkExport";

export const sitesRouter = router({
  list: viewerProcedure.query(async ({ ctx }) => {
    return await db.getAllSites(ctx.organizationId ?? undefined);
  }),
  getById: viewerProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await db.getSiteById(input.id);
    }),
  create: managerOrAdminProcedure
    .input(z.object({
      name: z.string().min(1),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().default("Nigeria"),
      contactPerson: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().email().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return await db.createSite({
        ...input,
        organizationId: ctx.organizationId ?? undefined,
      });
    }),
  update: managerOrAdminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      contactPerson: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().email().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return await db.updateSite(id, data);
    }),
  bulkDelete: adminProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ input, ctx }) => {
      let deleted = 0;
      for (const id of input.ids) {
        try {
          await db.deleteSite(id);
          await db.createAuditLog({
            userId: ctx.user.id,
            action: "bulk_delete_site",
            entityType: "site",
            entityId: id,
          });
          deleted++;
        } catch (error) {
          console.error(`Failed to delete site ${id}:`, error);
        }
      }
      return { deleted, total: input.ids.length };
    }),
  bulkImport: adminProcedure
    .input(z.object({
      fileContent: z.string(),
      fileType: z.enum(["csv", "excel"]),
      fileName: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const data = parseFileData(input.fileContent, input.fileType);
      return await bulkImportSites(
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
      const template = generateSitesTemplate(input.format);
      return { template, format: input.format };
    }),
  export: viewerProcedure
    .input(z.object({ format: z.enum(["csv", "excel"]) }))
    .query(async ({ input, ctx }) => {
      const sites = await db.getAllSites(ctx.organizationId ?? undefined);
      const formatted = formatSitesForExport(sites);
      const data =
        input.format === "csv"
          ? exportToCSV(formatted)
          : exportToExcel(formatted, "Sites");
      return {
        data,
        format: input.format,
        filename: `sites_export.${input.format === "csv" ? "csv" : "xlsx"}`,
      };
    }),
});
