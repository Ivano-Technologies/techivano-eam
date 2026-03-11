// @ts-nocheck — NRCS reference data sub-router (HIGH-11 audit follow-up)
import { z } from "zod";
import { router, protectedOrgProcedure } from "../_core/trpc";
import * as db from "../db";

export const nrcsRouter = router({
  getBranchCodes: protectedOrgProcedure.query(async () => {
    return await db.getAllBranchCodes();
  }),
  getCategoryCodes: protectedOrgProcedure.query(async () => {
    return await db.getAllCategoryCodes();
  }),
  getSubCategories: protectedOrgProcedure
    .input(z.object({ type: z.enum(["Asset", "Inventory"]).optional() }).optional())
    .query(async ({ input }) => {
      if (input?.type) {
        return await db.getSubCategoriesByType(input.type);
      }
      return await db.getAllSubCategories();
    }),
  generateAssetCode: protectedOrgProcedure
    .input(z.object({
      branchCode: z.string(),
      categoryCode: z.string(),
    }))
    .query(async ({ input }) => {
      return await db.generateAssetCode(input.branchCode, input.categoryCode);
    }),
  getDepreciationSummary: protectedOrgProcedure
    .input(
      z
        .object({
          year: z.number().optional(),
          categoryCode: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const assets = await db.getAllAssets({ organizationId: ctx.organizationId ?? undefined });
      const categoryCodes = await db.getAllCategoryCodes();
      const branchCodes = await db.getAllBranchCodes();

      const currentYear = input?.year ?? new Date().getFullYear();
      const filterCategory = input?.categoryCode;

      const filteredAssets = filterCategory
        ? assets.filter((a) => a.itemCategoryCode === filterCategory)
        : assets;

      let totalAcquisitionCost = 0;
      let totalCurrentValue = 0;
      let totalDepreciation = 0;
      let annualDepreciation = 0;

      const byCategory: Record<string, { categoryCode: string; categoryName: string; assetCount: number; totalAcquisitionCost: number; totalCurrentValue: number; totalDepreciation: number }> = {};
      const byBranch: Record<string, { branchCode: string; branchName: string; assetCount: number; totalAcquisitionCost: number; totalCurrentValue: number }> = {};
      const ageGroups = { "0-1": 0, "1-3": 0, "3-5": 0, "5-10": 0, "10+": 0 };

      for (const asset of filteredAssets) {
        const acquisitionCost = Number(asset.acquisitionCost ?? 0);
        const currentValue = Number(asset.currentDepreciatedValue ?? acquisitionCost);
        const depreciation = acquisitionCost - currentValue;

        totalAcquisitionCost += acquisitionCost;
        totalCurrentValue += currentValue;
        totalDepreciation += depreciation;

        const categoryCode = asset.itemCategoryCode ?? "";
        const category = categoryCodes.find((c) => c.code === categoryCode);
        if (category?.depreciationRate && acquisitionCost > 0) {
          const annualRate = Number(category.depreciationRate) / 100;
          annualDepreciation += acquisitionCost * annualRate;
        }

        if (categoryCode) {
          if (!byCategory[categoryCode]) {
            byCategory[categoryCode] = {
              categoryCode,
              categoryName: category?.name ?? categoryCode,
              assetCount: 0,
              totalAcquisitionCost: 0,
              totalCurrentValue: 0,
              totalDepreciation: 0,
            };
          }
          byCategory[categoryCode].assetCount++;
          byCategory[categoryCode].totalAcquisitionCost += acquisitionCost;
          byCategory[categoryCode].totalCurrentValue += currentValue;
          byCategory[categoryCode].totalDepreciation += depreciation;
        }

        const branchCode = asset.branchCode ?? "";
        if (branchCode) {
          if (!byBranch[branchCode]) {
            const branch = branchCodes.find((b) => b.code === branchCode);
            byBranch[branchCode] = {
              branchCode,
              branchName: branch?.name ?? branchCode,
              assetCount: 0,
              totalAcquisitionCost: 0,
              totalCurrentValue: 0,
            };
          }
          byBranch[branchCode].assetCount++;
          byBranch[branchCode].totalAcquisitionCost += acquisitionCost;
          byBranch[branchCode].totalCurrentValue += currentValue;
        }

        if (asset.yearAcquired) {
          const age = currentYear - asset.yearAcquired;
          if (age <= 1) ageGroups["0-1"]++;
          else if (age <= 3) ageGroups["1-3"]++;
          else if (age <= 5) ageGroups["3-5"]++;
          else if (age <= 10) ageGroups["5-10"]++;
          else ageGroups["10+"]++;
        }
      }

      const futureDepreciation = [];
      for (let i = 0; i < 5; i++) {
        const year = currentYear + i;
        futureDepreciation.push({
          year,
          depreciation: annualDepreciation,
          remainingValue: totalCurrentValue - annualDepreciation * i,
        });
      }

      return {
        totalAcquisitionCost,
        totalCurrentValue,
        totalDepreciation,
        annualDepreciation,
        totalAssets: filteredAssets.length,
        byCategory: Object.values(byCategory),
        byBranch: Object.values(byBranch),
        ageDistribution: [
          { ageRange: "0-1 years", count: ageGroups["0-1"], totalValue: 0 },
          { ageRange: "1-3 years", count: ageGroups["1-3"], totalValue: 0 },
          { ageRange: "3-5 years", count: ageGroups["3-5"], totalValue: 0 },
          { ageRange: "5-10 years", count: ageGroups["5-10"], totalValue: 0 },
          { ageRange: "10+ years", count: ageGroups["10+"], totalValue: 0 },
        ],
        futureDepreciation,
      };
    }),
  getAssetsByCategory: protectedOrgProcedure.query(async ({ ctx }) => {
    const assets = await db.getAllAssets({ organizationId: ctx.organizationId ?? undefined });
    const categoryCodes = await db.getAllCategoryCodes();

    const result: Record<string, { categoryCode: string; categoryName: string; count: number; totalValue: number }> = {};
    for (const asset of assets) {
      const categoryCode = asset.itemCategoryCode ?? "Uncategorized";
      if (!result[categoryCode]) {
        const category = categoryCodes.find((c) => c.code === categoryCode);
        result[categoryCode] = {
          categoryCode,
          categoryName: category?.name ?? categoryCode,
          count: 0,
          totalValue: 0,
        };
      }
      result[categoryCode].count++;
      result[categoryCode].totalValue += Number(asset.currentDepreciatedValue ?? asset.acquisitionCost ?? 0);
    }
    return Object.values(result);
  }),
});
