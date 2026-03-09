// @ts-nocheck — ctx.user nullable, db/schema result types, pg vs mysql schema
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedOrgProcedure } from "./_core/trpc";
import * as db from "./db";
import * as notificationHelper from "./notificationHelper";
import { generatePDFReport, generateExcelReport } from "./reportGenerator";
import { parseFileData, bulkImportAssets, bulkImportSites, bulkImportVendors, generateAssetsTemplate, generateSitesTemplate, generateVendorsTemplate } from "./bulkImport";
import { exportToCSV, exportToExcel, formatAssetsForExport, formatSitesForExport, formatVendorsForExport } from "./bulkExport";
import {
  enqueuePmEvaluationJob,
  enqueuePredictiveScoringJob,
  enqueueReportGenerationJob,
  enqueueTelemetryAggregationJob,
  enqueueWarehouseRebalanceJob,
  enqueueVendorRiskScoringJob,
  enqueueProcurementRecommendationJob,
  enqueueSupplyChainRiskEvaluationJob,
  enqueueDispatchOptimizationJob,
  enqueueExecutiveMetricsJob,
} from "./jobs/queue";
import { getJobRunById, listRecentJobRuns } from "./jobs/jobRunStore";
import {
  analyticsService,
  complianceService,
  dispatchOptimizationService,
  executiveIntelligenceService,
  inspectionService,
  procurementService,
  slaService,
  supplyChainRiskService,
  stockIntelligenceService,
  vendorIntelligenceService,
  warehouseIntelligenceService
} from "./modules";

// Role-based middleware
const adminProcedure = protectedOrgProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

const managerOrAdminProcedure = protectedOrgProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "manager") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Manager or Admin access required" });
  }
  return next({ ctx });
});

function resolveTenantIdFromContext(ctx: { tenantId: number | null; organizationId: string | null }) {
  void analyticsService;
  void complianceService;
  void dispatchOptimizationService;
  void executiveIntelligenceService;
  void inspectionService;
  void procurementService;
  void slaService;
  void supplyChainRiskService;
  void stockIntelligenceService;
  void vendorIntelligenceService;
  void warehouseIntelligenceService;
  if (!ctx.organizationId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Organization context is required",
    });
  }
  if (typeof ctx.tenantId === "number" && ctx.tenantId > 0) {
    return ctx.tenantId;
  }
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Tenant ID is required for organization-scoped operations",
  });
}

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    signup: publicProcedure
      .input(z.object({
        email: z.string().email(),
        name: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        // Email domain whitelist
        const allowedDomains = ['redcross.org', 'nrcs.gov.ng', 'gmail.com', 'outlook.com', 'yahoo.com'];
        const emailDomain = input.email.split('@')[1];
        if (!allowedDomains.includes(emailDomain)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Email domain @${emailDomain} is not allowed. Please contact your administrator.`,
          });
        }
        const { createSignupRequest } = await import("./magicLinkAuth");
        return await createSignupRequest(input.email, input.name);
      }),
    requestMagicLink: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const user = await db.getUserByEmail(input.email);
        if (!user) {
          return { success: false, message: "No account found with this email" };
        }
        const { createMagicLinkToken, sendMagicLink } = await import("./magicLinkAuth");
        const token = await createMagicLinkToken(user.id);
        const sent = await sendMagicLink(input.email, token);
        if (sent) {
          return { success: true, message: "Magic link sent to your email" };
        }
        return { success: false, message: "Failed to send magic link" };
      }),
    signupWithPassword: publicProcedure
      .input(z.object({
        email: z.string().email(),
        name: z.string().min(1),
        password: z.string().min(6, "Password must be at least 6 characters"),
        jobTitle: z.string().optional(),
        phoneNumber: z.string().optional(),
        phoneCountryCode: z.string().optional(),
        agency: z.string().optional(),
        geographicalArea: z.string().optional(),
        registrationPurpose: z.string().optional(),
        employeeId: z.string().optional(),
        department: z.string().optional(),
        supervisorName: z.string().optional(),
        supervisorEmail: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Check if user already exists
        const existing = await db.getUserByEmail(input.email);
        if (existing) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'An account with this email already exists',
          });
        }
        const { createUserWithPassword } = await import("./passwordAuth");
        const user = await createUserWithPassword(
          input.email, 
          input.name, 
          input.password,
          {
            jobTitle: input.jobTitle,
            phoneNumber: input.phoneNumber,
            phoneCountryCode: input.phoneCountryCode,
            agency: input.agency,
            geographicalArea: input.geographicalArea,
            registrationPurpose: input.registrationPurpose,
            employeeId: input.employeeId,
            department: input.department,
            supervisorName: input.supervisorName,
            supervisorEmail: input.supervisorEmail,
          }
        );
        return { success: true, message: "Registration submitted successfully. An administrator will review your request.", user };
      }),
    loginWithPassword: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { authenticateWithPassword } = await import("./passwordAuth");
        const user = await authenticateWithPassword(input.email, input.password);
        if (!user) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid email or password',
          });
        }
        
        // Check user status
        if (user.status === 'pending') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Your account is pending admin approval. You will receive an email once approved.',
          });
        }
        
        if (user.status === 'rejected') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Your account registration was not approved. Please contact the administrator for more information.',
          });
        }
        
        if (user.status === 'inactive') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Your account has been deactivated. Please contact the administrator.',
          });
        }
        
        // Create session by setting JWT cookie
        const { sdk } = await import("./_core/sdk");
        const token = await sdk.createSessionToken(user.openId, { name: user.name || "" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, cookieOptions);
        return { success: true, user };
      }),
    requestPasswordReset: publicProcedure
      .input(z.object({
        email: z.string().email(),
      }))
      .mutation(async ({ input }) => {
        const { generateResetToken } = await import("./passwordReset");
        const result = await generateResetToken(input.email);
        
        if (!result) {
          // Don't reveal if email exists - security best practice
          return { success: true, message: "If an account exists with this email, you will receive a password reset link." };
        }
        
        // TODO: Send email with reset link
        // For now, return success (email integration pending)
        const resetLink = `${process.env.VITE_OAUTH_PORTAL_URL || 'http://localhost:3000'}/reset-password?token=${result.token}`;
        console.log(`[Password Reset] Link for ${input.email}: ${resetLink}`);
        
        return { success: true, message: "If an account exists with this email, you will receive a password reset link." };
      }),
    resetPassword: publicProcedure
      .input(z.object({
        token: z.string(),
        newPassword: z.string().min(6, "Password must be at least 6 characters"),
      }))
      .mutation(async ({ input }) => {
        const { resetPassword } = await import("./passwordReset");
        const success = await resetPassword(input.token, input.newPassword);
        
        if (!success) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid or expired reset token',
          });
        }
        
        return { success: true, message: "Password reset successfully. You can now log in with your new password." };
      }),
  }),

  // ============= SITES MANAGEMENT =============
  sites: router({
    list: protectedOrgProcedure.query(async () => {
      return await db.getAllSites();
    }),
    
    getById: protectedOrgProcedure
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
      .mutation(async ({ input }) => {
        return await db.createSite(input);
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
        fileType: z.enum(['csv', 'excel']),
        fileName: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const data = parseFileData(input.fileContent, input.fileType);
        return await bulkImportSites(data, ctx.user.id, input.fileName, input.fileType);
      }),

    downloadTemplate: protectedOrgProcedure
      .input(z.object({ format: z.enum(['csv', 'excel']) }))
      .query(({ input }) => {
        const template = generateSitesTemplate(input.format);
        return { template, format: input.format };
      }),

    export: protectedOrgProcedure
      .input(z.object({ format: z.enum(['csv', 'excel']) }))
      .query(async ({ input }) => {
        const sites = await db.getAllSites();
        const formatted = formatSitesForExport(sites);
        const data = input.format === 'csv' ? exportToCSV(formatted) : exportToExcel(formatted, 'Sites');
        return { data, format: input.format, filename: `sites_export.${input.format === 'csv' ? 'csv' : 'xlsx'}` };
      }),
  }),

  // ============= ASSET CATEGORIES =============
  assetCategories: router({
    list: protectedOrgProcedure.query(async () => {
      return await db.getAllAssetCategories();
    }),
    
    create: managerOrAdminProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createAssetCategory(input.name, input.description);
      }),
  }),

  // ============= NRCS REFERENCE DATA =============
  nrcs: router({
    getBranchCodes: protectedOrgProcedure.query(async () => {
      return await db.getAllBranchCodes();
    }),
    
    getCategoryCodes: protectedOrgProcedure.query(async () => {
      return await db.getAllCategoryCodes();
    }),
    
    getSubCategories: protectedOrgProcedure
      .input(z.object({ type: z.enum(['Asset', 'Inventory']).optional() }).optional())
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
      .input(z.object({
        year: z.number().optional(),
        categoryCode: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const assets = await db.getAllAssets();
        const categoryCodes = await db.getAllCategoryCodes();
        const branchCodes = await db.getAllBranchCodes();
        
        const currentYear = input?.year || new Date().getFullYear();
        const filterCategory = input?.categoryCode;
        
        // Filter assets if category specified
        const filteredAssets = filterCategory
          ? assets.filter(a => a.itemCategoryCode === filterCategory)
          : assets;
        
        let totalAcquisitionCost = 0;
        let totalCurrentValue = 0;
        let totalDepreciation = 0;
        let annualDepreciation = 0;
        
        const byCategory: any = {};
        const byBranch: any = {};
        const ageGroups: any = { '0-1': 0, '1-3': 0, '3-5': 0, '5-10': 0, '10+': 0 };
        
        for (const asset of filteredAssets) {
          const acquisitionCost = Number(asset.acquisitionCost || 0);
          const currentValue = Number(asset.currentDepreciatedValue || acquisitionCost);
          const depreciation = acquisitionCost - currentValue;
          
          totalAcquisitionCost += acquisitionCost;
          totalCurrentValue += currentValue;
          totalDepreciation += depreciation;
          
          // Calculate annual depreciation based on category
          const categoryCode = asset.itemCategoryCode || '';
          const category = categoryCodes.find(c => c.code === categoryCode);
          if (category && category.depreciationRate && acquisitionCost > 0) {
            const annualRate = Number(category.depreciationRate) / 100;
            annualDepreciation += acquisitionCost * annualRate;
          }
          
          // Group by category
          if (categoryCode) {
            if (!byCategory[categoryCode]) {
              byCategory[categoryCode] = {
                categoryCode,
                categoryName: category?.name || categoryCode,
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
          
          // Group by branch
          const branchCode = asset.branchCode || '';
          if (branchCode) {
            if (!byBranch[branchCode]) {
              const branch = branchCodes.find(b => b.code === branchCode);
              byBranch[branchCode] = {
                branchCode,
                branchName: branch?.name || branchCode,
                assetCount: 0,
                totalAcquisitionCost: 0,
                totalCurrentValue: 0,
              };
            }
            byBranch[branchCode].assetCount++;
            byBranch[branchCode].totalAcquisitionCost += acquisitionCost;
            byBranch[branchCode].totalCurrentValue += currentValue;
          }
          
          // Age distribution
          if (asset.yearAcquired) {
            const age = currentYear - asset.yearAcquired;
            if (age <= 1) ageGroups['0-1']++;
            else if (age <= 3) ageGroups['1-3']++;
            else if (age <= 5) ageGroups['3-5']++;
            else if (age <= 10) ageGroups['5-10']++;
            else ageGroups['10+']++;
          }
        }
        
        // Calculate future depreciation
        const futureDepreciation = [];
        for (let i = 0; i < 5; i++) {
          const year = currentYear + i;
          futureDepreciation.push({
            year,
            depreciation: annualDepreciation,
            remainingValue: totalCurrentValue - (annualDepreciation * i),
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
            { ageRange: '0-1 years', count: ageGroups['0-1'], totalValue: 0 },
            { ageRange: '1-3 years', count: ageGroups['1-3'], totalValue: 0 },
            { ageRange: '3-5 years', count: ageGroups['3-5'], totalValue: 0 },
            { ageRange: '5-10 years', count: ageGroups['5-10'], totalValue: 0 },
            { ageRange: '10+ years', count: ageGroups['10+'], totalValue: 0 },
          ],
          futureDepreciation,
        };
      }),
    
    getAssetsByCategory: protectedOrgProcedure.query(async () => {
      const assets = await db.getAllAssets();
      const categoryCodes = await db.getAllCategoryCodes();
      
      const result: any = {};
      for (const asset of assets) {
        const categoryCode = asset.itemCategoryCode || 'Uncategorized';
        if (!result[categoryCode]) {
          const category = categoryCodes.find(c => c.code === categoryCode);
          result[categoryCode] = {
            categoryCode,
            categoryName: category?.name || categoryCode,
            count: 0,
            totalValue: 0,
          };
        }
        result[categoryCode].count++;
        result[categoryCode].totalValue += Number(asset.currentDepreciatedValue || asset.acquisitionCost || 0);
      }
      
      return Object.values(result);
    }),
  }),

  // ============= ASSETS MANAGEMENT =============
  assets: router({
    list: protectedOrgProcedure
      .input(z.object({
        siteId: z.number().optional(),
        status: z.string().optional(),
        categoryId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAllAssets(input);
      }),
    
    getById: protectedOrgProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getAssetById(input.id);
      }),
    
    getByTag: protectedOrgProcedure
      .input(z.object({ assetTag: z.string() }))
      .query(async ({ input }) => {
        return await db.getAssetByTag(input.assetTag);
      }),
    
    search: protectedOrgProcedure
      .input(z.object({ searchTerm: z.string() }))
      .query(async ({ input }) => {
        return await db.searchAssets(input.searchTerm);
      }),
    
    create: managerOrAdminProcedure
      .input(z.object({
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
        // NRCS fields
        itemType: z.enum(['Asset', 'Inventory']).default('Asset'),
        subCategory: z.string().optional(),
        branchCode: z.string().optional(),
        itemCategoryCode: z.string().optional(),
        assetNumber: z.number().optional(),
        productNumber: z.string().optional(),
        methodOfAcquisition: z.string().optional(),
        acquisitionDetails: z.string().optional(),
        projectReference: z.string().optional(),
        yearAcquired: z.number().optional(),
        acquiredCondition: z.enum(['New', 'Used']).optional(),
        currentDepreciatedValue: z.string().optional(),
        assignedToName: z.string().optional(),
        department: z.string().optional(),
        condition: z.string().optional(),
        lastPhysicalCheckDate: z.date().optional(),
        checkConductedBy: z.string().optional(),
        remarks: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createAsset(input);
      }),
    
    generateQRCode: protectedOrgProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { generateAssetQRCode } = await import('./qrcode');
        const asset = await db.getAssetById(input.id);
        if (!asset) throw new TRPCError({ code: 'NOT_FOUND', message: 'Asset not found' });
        
        const qrCode = await generateAssetQRCode(asset.id, asset.assetTag);
        await db.updateAsset(asset.id, { qrCode });
        return { qrCode };
      }),

    generateBulkQRCodeLabels: protectedOrgProcedure
      .input(z.object({
        assetIds: z.array(z.number()),
        labelSize: z.enum(['avery_5160', 'avery_5163', 'custom']).optional(),
      }))
      .mutation(async ({ input }) => {
        const { generateBulkQRCodeLabels } = await import('./qrcode');
        
        // Get assets
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
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No valid assets found' });
        }
        
        const pdfBuffer = await generateBulkQRCodeLabels(assets, input.labelSize);
        return {
          data: pdfBuffer.toString('base64'),
          filename: `qr-labels-${Date.now()}.pdf`,
          mimeType: 'application/pdf',
        };
      }),
    
    scanQRCode: protectedOrgProcedure
      .input(z.object({ qrData: z.string() }))
      .query(async ({ input }) => {
        const { parseAssetQRCode } = await import('./qrcode');
        const parsed = parseAssetQRCode(input.qrData);
        if (!parsed) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid QR code' });
        
        const asset = await db.getAssetById(parsed.assetId);
        if (!asset) throw new TRPCError({ code: 'NOT_FOUND', message: 'Asset not found' });
        return asset;
      }),

    generateBarcode: protectedOrgProcedure
      .input(z.object({ 
        id: z.number(),
        format: z.enum(['CODE128', 'CODE39', 'EAN13']).default('CODE128'),
      }))
      .mutation(async ({ input }) => {
        const { generateBarcode, generateBarcodeValue } = await import('./barcode');
        const asset = await db.getAssetById(input.id);
        if (!asset) throw new TRPCError({ code: 'NOT_FOUND', message: 'Asset not found' });
        
        const barcodeValue = generateBarcodeValue(asset.assetTag, input.format);
        const barcodeImage = generateBarcode(barcodeValue, input.format);
        
        await db.updateAsset(input.id, {
          barcode: barcodeValue,
          barcodeFormat: input.format,
        });
        
        return { barcode: barcodeValue, image: barcodeImage, format: input.format };
      }),

    scanBarcode: protectedOrgProcedure
      .input(z.object({ barcode: z.string() }))
      .query(async ({ input }) => {
        const asset = await db.getAssetByBarcode(input.barcode);
        if (!asset) throw new TRPCError({ code: 'NOT_FOUND', message: 'Asset not found' });
        return asset;
      }),
    
    update: managerOrAdminProcedure
      .input(z.object({
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
        // NRCS fields
        itemType: z.enum(['Asset', 'Inventory']).optional(),
        subCategory: z.string().optional(),
        branchCode: z.string().optional(),
        itemCategoryCode: z.string().optional(),
        assetNumber: z.number().optional(),
        productNumber: z.string().optional(),
        methodOfAcquisition: z.string().optional(),
        acquisitionDetails: z.string().optional(),
        projectReference: z.string().optional(),
        yearAcquired: z.number().optional(),
        acquiredCondition: z.enum(['New', 'Used']).optional(),
        currentDepreciatedValue: z.string().optional(),
        assignedToName: z.string().optional(),
        department: z.string().optional(),
        condition: z.string().optional(),
        lastPhysicalCheckDate: z.date().optional(),
        checkConductedBy: z.string().optional(),
        remarks: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        
        // Get current asset values before update
        const currentAsset = await db.getAssetById(id);
        if (currentAsset) {
          // Log each changed field
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
          action: 'update',
          entityType: 'asset',
          entityId: id,
          changes: JSON.stringify(data),
        });
        return await db.updateAsset(id, data);
      }),

    getExpiringWarranties: protectedOrgProcedure
      .query(async () => {
        return await db.getExpiringWarranties();
      }),

    sendWarrantyAlert: managerOrAdminProcedure
      .input(z.object({ assetId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const asset = await db.getAssetById(input.assetId);
        if (!asset || !asset.warrantyExpiry) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Asset not found or no warranty expiry date' });
        }

        const daysUntilExpiry = Math.ceil((new Date(asset.warrantyExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        await notificationHelper.sendWarrantyExpirationAlert({
          assetId: asset.id,
          assetName: asset.name,
          assetTag: asset.assetTag,
          warrantyExpiry: asset.warrantyExpiry,
          daysUntilExpiry,
          manufacturer: asset.manufacturer || 'N/A',
          model: asset.model || 'N/A',
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
      .input(z.object({
        ids: z.array(z.number()),
        status: z.enum(["operational", "maintenance", "repair", "retired", "disposed"]),
      }))
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
      .input(z.object({
        assetIds: z.array(z.number()),
        updates: z.object({
          status: z.string().optional(),
          location: z.string().optional(),
          department: z.string().optional(),
        }),
      }))
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
      .input(z.object({
        fileContent: z.string(),
        fileType: z.enum(['csv', 'excel']),
        fileName: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const data = parseFileData(input.fileContent, input.fileType);
        return await bulkImportAssets(data, ctx.user.id, input.fileName, input.fileType);
      }),

    downloadTemplate: protectedOrgProcedure
      .input(z.object({ format: z.enum(['csv', 'excel']) }))
      .query(({ input }) => {
        const template = generateAssetsTemplate(input.format);
        return { template, format: input.format };
      }),

    export: protectedOrgProcedure
      .input(z.object({ format: z.enum(['csv', 'excel']) }))
      .query(async ({ input }) => {
        const assets = await db.getAllAssets();
        const formatted = formatAssetsForExport(assets);
        const data = input.format === 'csv' ? exportToCSV(formatted) : exportToExcel(formatted, 'Assets');
        return { data, format: input.format, filename: `assets_export.${input.format === 'csv' ? 'csv' : 'xlsx'}` };
      }),

    getEditHistory: protectedOrgProcedure
      .input(z.object({ assetId: z.number() }))
      .query(async ({ input }) => {
        return await db.getAssetEditHistory(input.assetId);
      }),
  }),

  // ============= WORK ORDERS =============
  workOrders: router({
    list: protectedOrgProcedure
      .input(z.object({
        siteId: z.number().optional(),
        status: z.string().optional(),
        assignedTo: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAllWorkOrders(input);
      }),
    
    getById: protectedOrgProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getWorkOrderById(input.id);
      }),
    
    getByAssetId: protectedOrgProcedure
      .input(z.object({ assetId: z.number() }))
      .query(async ({ input }) => {
        return await db.getWorkOrdersByAssetId(input.assetId);
      }),
    
    create: protectedOrgProcedure
      .input(z.object({
        workOrderNumber: z.string().min(1),
        title: z.string().min(1),
        description: z.string().optional(),
        assetId: z.number(),
        siteId: z.number(),
        type: z.enum(["corrective", "preventive", "inspection", "emergency"]),
        priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
        assignedTo: z.number().optional(),
        scheduledStart: z.date().optional(),
        scheduledEnd: z.date().optional(),
        estimatedCost: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const workOrder = await db.createWorkOrder({
          ...input,
          requestedBy: ctx.user.id,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "create_work_order",
          entityType: "work_order",
          entityId: workOrder?.id,
        });
        
        // Notify assigned user
        if (input.assignedTo && workOrder?.id) {
          await notificationHelper.notifyWorkOrderAssigned(
            input.assignedTo,
            workOrder.id,
            input.title
          );
        }
        
        return workOrder;
      }),
    
    update: protectedOrgProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["pending", "assigned", "in_progress", "on_hold", "completed", "cancelled"]).optional(),
        priority: z.enum(["low", "medium", "high", "critical"]).optional(),
        assignedTo: z.number().optional(),
        scheduledStart: z.date().optional(),
        scheduledEnd: z.date().optional(),
        actualStart: z.date().optional(),
        actualEnd: z.date().optional(),
        estimatedCost: z.string().optional(),
        actualCost: z.string().optional(),
        completionNotes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        
        // Get existing work order to check for changes
        const existingWorkOrder = await db.getWorkOrderById(id);
        
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "update_work_order",
          entityType: "work_order",
          entityId: id,
          changes: JSON.stringify(data),
        });
        
        const result = await db.updateWorkOrder(id, data);
        
        // Notify on status change to completed
        if (data.status === "completed" && existingWorkOrder?.status !== "completed") {
          if (existingWorkOrder?.requestedBy) {
            await notificationHelper.notifyWorkOrderCompleted(
              existingWorkOrder.requestedBy,
              id,
              existingWorkOrder.title
            );
          }
        }
        
        // Notify newly assigned user
        if (data.assignedTo && data.assignedTo !== existingWorkOrder?.assignedTo) {
          await notificationHelper.notifyWorkOrderAssigned(
            data.assignedTo,
            id,
            existingWorkOrder?.title || "Work Order"
          );
        }
        
        return result;
      }),
  }),

  // ============= MAINTENANCE SCHEDULES =============
  maintenance: router({
    list: protectedOrgProcedure
      .input(z.object({
        assetId: z.number().optional(),
        isActive: z.boolean().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAllMaintenanceSchedules(input);
      }),
    
    upcoming: protectedOrgProcedure
      .input(z.object({ days: z.number().default(30) }))
      .query(async ({ input }) => {
        return await db.getUpcomingMaintenance(input.days);
      }),
    
    create: managerOrAdminProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        assetId: z.number(),
        frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "semi_annual", "annual"]),
        frequencyValue: z.number().default(1),
        nextDue: z.date(),
        assignedTo: z.number().optional(),
        taskTemplate: z.string().optional(),
        estimatedDuration: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const schedule = await db.createMaintenanceSchedule(input);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "create_maintenance_schedule",
          entityType: "maintenance_schedule",
          entityId: schedule?.id,
        });
        return schedule;
      }),
    
    update: managerOrAdminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "semi_annual", "annual"]).optional(),
        frequencyValue: z.number().optional(),
        lastPerformed: z.date().optional(),
        nextDue: z.date().optional(),
        assignedTo: z.number().optional(),
        isActive: z.boolean().optional(),
        taskTemplate: z.string().optional(),
        estimatedDuration: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "update_maintenance_schedule",
          entityType: "maintenance_schedule",
          entityId: id,
          changes: JSON.stringify(data),
        });
        return await db.updateMaintenanceSchedule(id, data);
      }),

    // Predictive Maintenance AI
    getPredictions: protectedOrgProcedure
      .query(async () => {
        const { getAllMaintenancePredictions } = await import('./predictiveMaintenance');
        return await getAllMaintenancePredictions();
      }),

    getHighPriorityPredictions: protectedOrgProcedure
      .query(async () => {
        const { getHighPriorityPredictions } = await import('./predictiveMaintenance');
        return await getHighPriorityPredictions();
      }),

    getAssetPrediction: protectedOrgProcedure
      .input(z.object({ assetId: z.number() }))
      .query(async ({ input }) => {
        const { analyzeAssetMaintenancePattern } = await import('./predictiveMaintenance');
        return await analyzeAssetMaintenancePattern(input.assetId);
      }),

    autoCreateWorkOrders: managerOrAdminProcedure
      .mutation(async ({ ctx }) => {
        const tenantId = resolveTenantIdFromContext(ctx);
        const queued = await enqueuePmEvaluationJob({
          tenantId,
          requestedBy: ctx.user.id,
          actorUserId: ctx.user.id,
        });
        return {
          queued: true,
          ...queued,
        };
      }),

    enqueuePredictiveScoring: managerOrAdminProcedure
      .input(z.object({
        assetId: z.number().optional(),
      }).optional())
      .mutation(async ({ ctx, input }) => {
        const tenantId = resolveTenantIdFromContext(ctx);
        const queued = await enqueuePredictiveScoringJob({
          tenantId,
          requestedBy: ctx.user.id,
          assetId: input?.assetId,
        });
        return {
          queued: true,
          ...queued,
        };
      }),
  }),

  // ============= INVENTORY =============
  inventory: router({
    list: protectedOrgProcedure
      .input(z.object({ siteId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getAllInventoryItems(input?.siteId);
      }),
    
    lowStock: protectedOrgProcedure
      .input(z.object({ siteId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getLowStockItems(input?.siteId);
      }),
    
    transactions: protectedOrgProcedure
      .input(z.object({ itemId: z.number() }))
      .query(async ({ input }) => {
        return await db.getInventoryTransactions(input.itemId);
      }),
    
    create: managerOrAdminProcedure
      .input(z.object({
        itemCode: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        category: z.string().optional(),
        siteId: z.number(),
        currentStock: z.number().default(0),
        minStockLevel: z.number().default(0),
        reorderPoint: z.number().default(0),
        maxStockLevel: z.number().optional(),
        unitOfMeasure: z.string().optional(),
        unitCost: z.string().optional(),
        vendorId: z.number().optional(),
        location: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createInventoryItem(input);
      }),
    
    update: managerOrAdminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        currentStock: z.number().optional(),
        minStockLevel: z.number().optional(),
        reorderPoint: z.number().optional(),
        maxStockLevel: z.number().optional(),
        unitOfMeasure: z.string().optional(),
        unitCost: z.string().optional(),
        vendorId: z.number().optional(),
        location: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateInventoryItem(id, data);
      }),
    
    addTransaction: protectedOrgProcedure
      .input(z.object({
        itemId: z.number(),
        type: z.enum(["in", "out", "adjustment", "transfer"]),
        quantity: z.number(),
        workOrderId: z.number().optional(),
        fromSiteId: z.number().optional(),
        toSiteId: z.number().optional(),
        unitCost: z.string().optional(),
        totalCost: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const transaction = await db.createInventoryTransaction({
          ...input,
          performedBy: ctx.user.id,
        });
        
        // Update inventory stock
        const item = await db.getAllInventoryItems().then(items => items.find(i => i.id === input.itemId));
        if (item) {
          let newStock = item.currentStock;
          if (input.type === "in") newStock += input.quantity;
          else if (input.type === "out") newStock -= input.quantity;
          else if (input.type === "adjustment") newStock = input.quantity;
          
          await db.updateInventoryItem(input.itemId, { currentStock: newStock });
        }
        
        return transaction;
      }),

    bulkDelete: adminProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input, ctx }) => {
        let deleted = 0;
        for (const id of input.ids) {
          try {
            await db.deleteInventoryItem(id);
            await db.createAuditLog({
              userId: ctx.user.id,
              action: "bulk_delete_inventory",
              entityType: "inventory",
              entityId: id,
            });
            deleted++;
          } catch (error) {
            console.error(`Failed to delete inventory item ${id}:`, error);
          }
        }
        return { deleted, total: input.ids.length };
      }),
  }),

  warehouseV1: router({
    rebalance: managerOrAdminProcedure
      .input(
        z.object({
          stockItemId: z.number().int().positive(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const queued = await enqueueWarehouseRebalanceJob({
          tenantId: resolveTenantIdFromContext(ctx),
          requestedBy: ctx.user.id,
          stockItemId: input.stockItemId,
        });
        return { queued: true, ...queued };
      }),

    recommendations: protectedOrgProcedure
      .input(
        z.object({
          stockItemId: z.number().int().positive().optional(),
          limit: z.number().int().min(1).max(200).optional(),
        }).optional(),
      )
      .query(async ({ ctx, input }) => {
        return db.listWarehouseTransferRecommendations({
          tenantId: resolveTenantIdFromContext(ctx),
          stockItemId: input?.stockItemId,
          limit: input?.limit ?? 50,
        });
      }),
  }),

  procurementV1: router({
    recommend: managerOrAdminProcedure
      .input(
        z.object({
          stockItemId: z.number().int().positive().optional(),
        }).optional(),
      )
      .mutation(async ({ ctx, input }) => {
        const queued = await enqueueProcurementRecommendationJob({
          tenantId: resolveTenantIdFromContext(ctx),
          requestedBy: ctx.user.id,
          stockItemId: input?.stockItemId,
        });
        return { queued: true, ...queued };
      }),

    recommendations: protectedOrgProcedure
      .input(
        z.object({
          stockItemId: z.number().int().positive().optional(),
          limit: z.number().int().min(1).max(200).optional(),
        }).optional(),
      )
      .query(async ({ ctx, input }) => {
        return db.listProcurementRecommendations({
          tenantId: resolveTenantIdFromContext(ctx),
          stockItemId: input?.stockItemId,
          limit: input?.limit ?? 50,
        });
      }),

    createPurchaseOrder: managerOrAdminProcedure
      .input(
        z.object({
          recommendationId: z.number().int().positive(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const purchaseOrder = await db.createPurchaseOrderFromRecommendation({
          tenantId: resolveTenantIdFromContext(ctx),
          recommendationId: input.recommendationId,
        });
        if (!purchaseOrder) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Recommendation not found for tenant",
          });
        }
        return purchaseOrder;
      }),
  }),

  supplyChainV1: router({
    evaluate: managerOrAdminProcedure
      .input(
        z.object({
          stockItemId: z.number().int().positive().optional(),
          vendorId: z.number().int().positive().optional(),
        }).optional(),
      )
      .mutation(async ({ ctx, input }) => {
        const queued = await enqueueSupplyChainRiskEvaluationJob({
          tenantId: resolveTenantIdFromContext(ctx),
          requestedBy: ctx.user.id,
          stockItemId: input?.stockItemId,
          vendorId: input?.vendorId,
        });
        return { queued: true, ...queued };
      }),

    risk: protectedOrgProcedure
      .input(
        z.object({
          stockItemId: z.number().int().positive().optional(),
          vendorId: z.number().int().positive().optional(),
          riskBand: z.enum(["low", "moderate", "elevated", "high", "critical"]).optional(),
          limit: z.number().int().min(1).max(200).optional(),
        }).optional(),
      )
      .query(async ({ ctx, input }) => {
        return db.listSupplyChainRiskScores({
          tenantId: resolveTenantIdFromContext(ctx),
          stockItemId: input?.stockItemId,
          vendorId: input?.vendorId,
          riskBand: input?.riskBand,
          limit: input?.limit ?? 50,
        });
      }),
  }),

  dispatchV1: router({
    optimize: managerOrAdminProcedure
      .input(
        z.object({
          workOrderId: z.number().int().positive().optional(),
          facilityId: z.number().int().positive().optional(),
        }).optional(),
      )
      .mutation(async ({ ctx, input }) => {
        const queued = await enqueueDispatchOptimizationJob({
          tenantId: resolveTenantIdFromContext(ctx),
          requestedBy: ctx.user.id,
          workOrderId: input?.workOrderId,
          facilityId: input?.facilityId,
        });
        return { queued: true, ...queued };
      }),

    assignments: protectedOrgProcedure
      .input(
        z.object({
          facilityId: z.number().int().positive().optional(),
          technicianId: z.number().int().positive().optional(),
          status: z.enum(["created", "completed", "delayed"]).optional(),
          limit: z.number().int().min(1).max(200).optional(),
        }).optional(),
      )
      .query(async ({ ctx, input }) => {
        return db.listDispatchAssignments({
          tenantId: resolveTenantIdFromContext(ctx),
          facilityId: input?.facilityId,
          technicianId: input?.technicianId,
          status: input?.status,
          limit: input?.limit ?? 50,
        });
      }),
  }),

  executiveV1: router({
    compute: managerOrAdminProcedure
      .input(
        z.object({
          snapshotDate: z.string().optional(),
        }).optional(),
      )
      .mutation(async ({ ctx, input }) => {
        const queued = await enqueueExecutiveMetricsJob({
          tenantId: resolveTenantIdFromContext(ctx),
          requestedBy: ctx.user.id,
          snapshotDate: input?.snapshotDate,
        });
        return { queued: true, ...queued };
      }),

    metrics: protectedOrgProcedure.query(async ({ ctx }) => {
      return db.getLatestExecutiveMetricsSnapshot(resolveTenantIdFromContext(ctx));
    }),

    kpiTrends: protectedOrgProcedure
      .input(
        z.object({
          metricName: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          limit: z.number().int().min(1).max(200).optional(),
        }).optional(),
      )
      .query(async ({ ctx, input }) => {
        return db.listOperationalKpiTrends({
          tenantId: resolveTenantIdFromContext(ctx),
          metricName: input?.metricName,
          startDate: input?.startDate ? new Date(input.startDate) : undefined,
          endDate: input?.endDate ? new Date(input.endDate) : undefined,
          limit: input?.limit ?? 100,
        });
      }),
  }),

  // ============= VENDORS =============
  vendors: router({
    list: protectedOrgProcedure.query(async () => {
      return await db.getAllVendors();
    }),
    
    create: managerOrAdminProcedure
      .input(z.object({
        name: z.string().min(1),
        vendorCode: z.string().optional(),
        contactPerson: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        website: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createVendor(input);
      }),
    
    update: managerOrAdminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        contactPerson: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        website: z.string().optional(),
        notes: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateVendor(id, data);
      }),

    bulkImport: adminProcedure
      .input(z.object({
        fileContent: z.string(),
        fileType: z.enum(['csv', 'excel']),
        fileName: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const data = parseFileData(input.fileContent, input.fileType);
        return await bulkImportVendors(data, ctx.user.id, input.fileName, input.fileType);
      }),

    downloadTemplate: protectedOrgProcedure
      .input(z.object({ format: z.enum(['csv', 'excel']) }))
      .query(({ input }) => {
        const template = generateVendorsTemplate(input.format);
        return { template, format: input.format };
      }),

    export: protectedOrgProcedure
      .input(z.object({ format: z.enum(['csv', 'excel']) }))
      .query(async ({ input }) => {
        const vendors = await db.getAllVendors();
        const formatted = formatVendorsForExport(vendors);
        const data = input.format === 'csv' ? exportToCSV(formatted) : exportToExcel(formatted, 'Vendors');
        return { data, format: input.format, filename: `vendors_export.${input.format === 'csv' ? 'csv' : 'xlsx'}` };
      }),
  }),

  vendorIntelligence: router({
    compute: managerOrAdminProcedure
      .input(
        z.object({
          vendorId: z.number().int().positive().optional(),
        }).optional(),
      )
      .mutation(async ({ ctx, input }) => {
        const queued = await enqueueVendorRiskScoringJob({
          tenantId: resolveTenantIdFromContext(ctx),
          requestedBy: ctx.user.id,
          vendorId: input?.vendorId,
        });
        return { queued: true, ...queued };
      }),

    riskScores: protectedOrgProcedure
      .input(
        z.object({
          limit: z.number().int().min(1).max(200).optional(),
        }).optional(),
      )
      .query(async ({ ctx, input }) => {
        return db.listVendorRiskScores({
          tenantId: resolveTenantIdFromContext(ctx),
          limit: input?.limit ?? 50,
        });
      }),
  }),

  // ============= FINANCIAL TRANSACTIONS =============
  financial: router({
    list: protectedOrgProcedure
      .input(z.object({
        assetId: z.number().optional(),
        workOrderId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getFinancialTransactions(input);
      }),
    
    create: managerOrAdminProcedure
      .input(z.object({
        transactionType: z.enum(["acquisition", "maintenance", "repair", "disposal", "depreciation", "revenue", "other"]),
        assetId: z.number().optional(),
        workOrderId: z.number().optional(),
        amount: z.string(),
        currency: z.string().default("NGN"),
        description: z.string().optional(),
        transactionDate: z.string(),
        vendorId: z.number().optional(),
        receiptNumber: z.string().optional(),
        approvedBy: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.createFinancialTransaction({
          ...input,
          transactionDate: new Date(input.transactionDate),
          createdBy: ctx.user.id,
        });
      }),

    update: managerOrAdminProcedure
      .input(z.object({
        id: z.number(),
        transactionType: z.enum(["acquisition", "maintenance", "repair", "disposal", "depreciation", "revenue", "other"]).optional(),
        amount: z.string().optional(),
        description: z.string().optional(),
        transactionDate: z.string().optional(),
        receiptNumber: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: any = { ...data };
        if (data.transactionDate) {
          updateData.transactionDate = new Date(data.transactionDate);
        }
        return await db.updateFinancialTransaction(id, updateData);
      }),

    // Lifecycle Cost Analysis
    getAssetLifecycleCost: protectedOrgProcedure
      .input(z.object({ assetId: z.number() }))
      .query(async ({ input }) => {
        const { calculateAssetLifecycleCost } = await import('./lifecycleCost');
        return await calculateAssetLifecycleCost(input.assetId);
      }),

    getCategoryCostSummary: protectedOrgProcedure
      .query(async () => {
        const { getCategoryCostSummary } = await import('./lifecycleCost');
        return await getCategoryCostSummary();
      }),

    getCostOptimizationRecommendations: protectedOrgProcedure
      .query(async () => {
        const { getCostOptimizationRecommendations } = await import('./lifecycleCost');
        return await getCostOptimizationRecommendations();
      }),

    getCostAnalytics: protectedOrgProcedure
      .input(z.object({ days: z.number().default(30) }))
      .query(async ({ input }) => {
        return await db.getCostAnalytics(input.days);
      }),
  }),

  // ============= COMPLIANCE =============
  compliance: router({
    list: protectedOrgProcedure
      .input(z.object({
        assetId: z.number().optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAllComplianceRecords(input);
      }),
    
    create: managerOrAdminProcedure
      .input(z.object({
        assetId: z.number().optional(),
        title: z.string().min(1),
        regulatoryBody: z.string().optional(),
        requirementType: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["compliant", "non_compliant", "pending", "expired"]).default("pending"),
        dueDate: z.date().optional(),
        completionDate: z.date().optional(),
        nextReviewDate: z.date().optional(),
        assignedTo: z.number().optional(),
        documentUrl: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createComplianceRecord(input);
      }),
    
    update: managerOrAdminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        regulatoryBody: z.string().optional(),
        requirementType: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["compliant", "non_compliant", "pending", "expired"]).optional(),
        dueDate: z.date().optional(),
        completionDate: z.date().optional(),
        nextReviewDate: z.date().optional(),
        assignedTo: z.number().optional(),
        documentUrl: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateComplianceRecord(id, data);
      }),
  }),

  // ============= DASHBOARD =============
  dashboard: router({
    stats: protectedOrgProcedure.query(async () => {
      return await db.getDashboardStats();
    }),
  }),

  // ============= USERS MANAGEMENT =============
  users: router({
    list: adminProcedure.query(async () => {
      return await db.getAllUsers();
    }),

    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getUserById(input.id);
      }),
    
    create: adminProcedure
      .input(z.object({
        openId: z.string(),
        name: z.string(),
        email: z.string().email(),
        role: z.enum(["admin", "manager", "technician", "user"]),
        siteId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.upsertUser({
          openId: input.openId,
          name: input.name,
          email: input.email,
          role: input.role,
          lastSignedIn: new Date(),
        });
        return { success: true };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        role: z.enum(["admin", "manager", "technician", "user"]).optional(),
        siteId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateUser(id, data);
      }),
    
    updateRole: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(["admin", "manager", "technician", "user"]),
      }))
      .mutation(async ({ input }) => {
        return await db.updateUserRole(input.userId, input.role);
      }),

    completeOnboarding: protectedOrgProcedure
      .mutation(async ({ ctx }) => {
        await db.updateUser(ctx.user.id, { hasCompletedOnboarding: true });
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteUser(input.id);
      }),
    
    getPendingUsers: adminProcedure
      .query(async () => {
        return await db.getPendingUsers();
      }),
    
    approveUser: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return await db.approveUser(input.userId, ctx.user.id);
      }),
    
    rejectUser: adminProcedure
      .input(z.object({ 
        userId: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.rejectUser(input.userId, input.reason);
      }),
    
    bulkApproveUsers: adminProcedure
      .input(z.object({ userIds: z.array(z.number()) }))
      .mutation(async ({ input, ctx }) => {
        return await db.bulkApproveUsers(input.userIds, ctx.user.id);
      }),
    
    bulkRejectUsers: adminProcedure
      .input(z.object({ 
        userIds: z.array(z.number()),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.bulkRejectUsers(input.userIds, input.reason);
      }),
  }),

  // ============= NOTIFICATIONS =============
  notifications: router({
    list: protectedOrgProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return await db.getUserNotifications(ctx.user.id, input.limit);
      }),
    
    unreadCount: protectedOrgProcedure
      .query(async ({ ctx }) => {
        return await db.getUnreadNotificationCount(ctx.user.id);
      }),
    
    markAsRead: protectedOrgProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.markNotificationAsRead(input.id);
      }),
    
    markAllAsRead: protectedOrgProcedure
      .mutation(async ({ ctx }) => {
        return await db.markAllNotificationsAsRead(ctx.user.id);
      }),
    
    delete: protectedOrgProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteNotification(input.id);
      }),
    
    getPreferences: protectedOrgProcedure
      .query(async ({ ctx }) => {
        return await db.getUserNotificationPreferences(ctx.user.id);
      }),
    
    updatePreferences: protectedOrgProcedure
      .input(z.object({
        maintenanceDue: z.boolean().optional(),
        lowStock: z.boolean().optional(),
        workOrderAssigned: z.boolean().optional(),
        workOrderCompleted: z.boolean().optional(),
        assetStatusChange: z.boolean().optional(),
        complianceDue: z.boolean().optional(),
        systemAlert: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.upsertNotificationPreferences(ctx.user.id, input);
      }),
  }),

  // ============= BACKGROUND JOBS =============
  backgroundJobs: router({
    enqueuePmEvaluation: managerOrAdminProcedure
      .input(z.object({
        actorUserId: z.number().optional(),
      }).optional())
      .mutation(async ({ ctx, input }) => {
        const queued = await enqueuePmEvaluationJob({
          tenantId: resolveTenantIdFromContext(ctx),
          requestedBy: ctx.user.id,
          actorUserId: input?.actorUserId ?? ctx.user.id,
        });
        return { queued: true, ...queued };
      }),

    enqueuePredictiveScoring: managerOrAdminProcedure
      .input(z.object({
        assetId: z.number().optional(),
      }).optional())
      .mutation(async ({ ctx, input }) => {
        const queued = await enqueuePredictiveScoringJob({
          tenantId: resolveTenantIdFromContext(ctx),
          requestedBy: ctx.user.id,
          assetId: input?.assetId,
        });
        return { queued: true, ...queued };
      }),

    enqueueReportGeneration: managerOrAdminProcedure
      .input(z.object({
        reportType: z.enum([
          "lifecycle-cost",
          "maintenance-backlog",
          "downtime-analytics",
          "asset-utilization",
        ]),
      }))
      .mutation(async ({ ctx, input }) => {
        const queued = await enqueueReportGenerationJob({
          tenantId: resolveTenantIdFromContext(ctx),
          requestedBy: ctx.user.id,
          reportType: input.reportType,
        });
        return { queued: true, ...queued };
      }),

    enqueueTelemetryAggregation: managerOrAdminProcedure
      .input(z.object({
        assetId: z.number().optional(),
        hour: z.string().optional(),
      }).optional())
      .mutation(async ({ ctx, input }) => {
        const queued = await enqueueTelemetryAggregationJob({
          tenantId: resolveTenantIdFromContext(ctx),
          requestedBy: ctx.user.id,
          assetId: input?.assetId,
          hour: input?.hour,
        });
        return { queued: true, ...queued };
      }),

    getRunById: protectedOrgProcedure
      .input(z.object({
        runId: z.number().int().positive(),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = resolveTenantIdFromContext(ctx);
        return getJobRunById(input.runId, tenantId);
      }),

    listRecent: protectedOrgProcedure
      .input(z.object({
        limit: z.number().int().min(1).max(100).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const tenantId = resolveTenantIdFromContext(ctx);
        return listRecentJobRuns(tenantId, input?.limit ?? 20);
      }),
  }),

  // Reports
  reports: router({
    // Asset Reports
    assetInventory: protectedOrgProcedure
      .input(z.object({
        format: z.enum(['pdf', 'excel']),
        siteId: z.number().optional(),
        categoryId: z.number().optional(),
        status: z.enum(['operational', 'maintenance', 'retired', 'disposed']).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        resolveTenantIdFromContext(ctx);
        const assets = await db.getAllAssets();

        const columns = [
          { header: 'Asset Tag', key: 'assetTag', width: 15 },
          { header: 'Name', key: 'name', width: 25 },
          { header: 'Category', key: 'categoryName', width: 15 },
          { header: 'Site', key: 'siteName', width: 20 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Condition', key: 'condition', width: 12 },
          { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
        ];

        const title = 'Asset Inventory Report';
        const subtitle = `Generated for ${input.siteId ? 'Site ' + input.siteId : 'All Sites'}`;

        if (input.format === 'pdf') {
          const buffer = await generatePDFReport(title, assets, columns, { subtitle });
          return {
            data: buffer.toString('base64'),
            filename: `asset-inventory-${Date.now()}.pdf`,
            mimeType: 'application/pdf',
          };
        } else {
          const buffer = await generateExcelReport(title, assets, columns, { sheetName: 'Assets' });
          return {
            data: buffer.toString('base64'),
            filename: `asset-inventory-${Date.now()}.xlsx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          };
        }
      }),

    // Maintenance Reports
    maintenanceSchedule: protectedOrgProcedure
      .input(z.object({
        format: z.enum(['pdf', 'excel']),
        siteId: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        resolveTenantIdFromContext(ctx);
        const schedules = await db.getAllMaintenanceSchedules();

        const columns = [
          { header: 'Schedule Name', key: 'scheduleName', width: 25 },
          { header: 'Asset', key: 'assetName', width: 20 },
          { header: 'Type', key: 'maintenanceType', width: 15 },
          { header: 'Frequency', key: 'frequency', width: 12 },
          { header: 'Last Performed', key: 'lastPerformed', width: 15 },
          { header: 'Next Due', key: 'nextDue', width: 15 },
          { header: 'Status', key: 'status', width: 12 },
        ];

        const title = 'Maintenance Schedule Report';
        const subtitle = `Period: ${input.startDate || 'All'} to ${input.endDate || 'All'}`;

        if (input.format === 'pdf') {
          const buffer = await generatePDFReport(title, schedules, columns, { subtitle });
          return {
            data: buffer.toString('base64'),
            filename: `maintenance-schedule-${Date.now()}.pdf`,
            mimeType: 'application/pdf',
          };
        } else {
          const buffer = await generateExcelReport(title, schedules, columns, { sheetName: 'Maintenance' });
          return {
            data: buffer.toString('base64'),
            filename: `maintenance-schedule-${Date.now()}.xlsx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          };
        }
      }),

    // Work Order Reports
    workOrders: protectedOrgProcedure
      .input(z.object({
        format: z.enum(['pdf', 'excel']),
        siteId: z.number().optional(),
        status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        resolveTenantIdFromContext(ctx);
        const workOrders = await db.getAllWorkOrders();

        const columns = [
          { header: 'WO Number', key: 'workOrderNumber', width: 15 },
          { header: 'Title', key: 'title', width: 25 },
          { header: 'Asset', key: 'assetName', width: 20 },
          { header: 'Type', key: 'type', width: 12 },
          { header: 'Priority', key: 'priority', width: 10 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Created', key: 'createdAt', width: 15 },
          { header: 'Completed', key: 'completedAt', width: 15 },
        ];

        const title = 'Work Orders Report';
        const subtitle = `Status: ${input.status || 'All'}`;

        if (input.format === 'pdf') {
          const buffer = await generatePDFReport(title, workOrders, columns, { subtitle });
          return {
            data: buffer.toString('base64'),
            filename: `work-orders-${Date.now()}.pdf`,
            mimeType: 'application/pdf',
          };
        } else {
          const buffer = await generateExcelReport(title, workOrders, columns, { sheetName: 'Work Orders' });
          return {
            data: buffer.toString('base64'),
            filename: `work-orders-${Date.now()}.xlsx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          };
        }
      }),

    // Financial Reports
    financial: protectedOrgProcedure
      .input(z.object({
        format: z.enum(['pdf', 'excel']),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        resolveTenantIdFromContext(ctx);
        const transactions = await db.getFinancialTransactions();

        const columns = [
          { header: 'Date', key: 'transactionDate', width: 15 },
          { header: 'Asset', key: 'assetName', width: 20 },
          { header: 'Type', key: 'transactionType', width: 15 },
          { header: 'Category', key: 'category', width: 15 },
          { header: 'Amount', key: 'amount', width: 12 },
          { header: 'Description', key: 'description', width: 30 },
        ];

        const title = 'Financial Summary Report';
        const subtitle = `Period: ${input.startDate || 'All'} to ${input.endDate || 'All'}`;

        if (input.format === 'pdf') {
          const buffer = await generatePDFReport(title, transactions, columns, { subtitle });
          return {
            data: buffer.toString('base64'),
            filename: `financial-report-${Date.now()}.pdf`,
            mimeType: 'application/pdf',
          };
        } else {
          const buffer = await generateExcelReport(title, transactions, columns, { sheetName: 'Financial' });
          return {
            data: buffer.toString('base64'),
            filename: `financial-report-${Date.now()}.xlsx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          };
        }
      }),

    // Compliance Reports
    compliance: protectedOrgProcedure
      .input(z.object({
        format: z.enum(['pdf', 'excel']),
        siteId: z.number().optional(),
        status: z.enum(['compliant', 'non_compliant', 'pending']).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        resolveTenantIdFromContext(ctx);
        const records = await db.getAllComplianceRecords();

        const columns = [
          { header: 'Asset', key: 'assetName', width: 20 },
          { header: 'Requirement', key: 'requirementName', width: 25 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Last Inspection', key: 'lastInspectionDate', width: 15 },
          { header: 'Next Due', key: 'nextDueDate', width: 15 },
          { header: 'Inspector', key: 'inspectorName', width: 15 },
        ];

        const title = 'Compliance Audit Report';
        const subtitle = `Status: ${input.status || 'All'}`;

        if (input.format === 'pdf') {
          const buffer = await generatePDFReport(title, records, columns, { subtitle });
          return {
            data: buffer.toString('base64'),
            filename: `compliance-report-${Date.now()}.pdf`,
            mimeType: 'application/pdf',
          };
        } else {
          const buffer = await generateExcelReport(title, records, columns, { sheetName: 'Compliance' });
          return {
            data: buffer.toString('base64'),
            filename: `compliance-report-${Date.now()}.xlsx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          };
        }
      }),
  }),

  // Asset Photos Management
  photos: router({
    create: protectedOrgProcedure
      .input(z.object({
        assetId: z.number().optional(),
        workOrderId: z.number().optional(),
        photoUrl: z.string(),
        photoKey: z.string(),
        caption: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const photoId = await db.createAssetPhoto({
          ...input,
          uploadedBy: ctx.user.id,
        });
        return { id: photoId };
      }),

    listByAsset: protectedOrgProcedure
      .input(z.object({ assetId: z.number() }))
      .query(async ({ input }) => {
        return await db.getAssetPhotos(input.assetId);
      }),

    listByWorkOrder: protectedOrgProcedure
      .input(z.object({ workOrderId: z.number() }))
      .query(async ({ input }) => {
        return await db.getWorkOrderPhotos(input.workOrderId);
      }),

    delete: protectedOrgProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteAssetPhoto(input.id);
        return { success: true };
      }),
  }),

  // Scheduled Reports Management
  scheduledReports: router({
    list: protectedOrgProcedure.query(async () => {
      return await db.getScheduledReports();
    }),

    create: protectedOrgProcedure
      .input(z.object({
        name: z.string(),
        reportType: z.enum(['assetInventory', 'maintenanceSchedule', 'workOrders', 'financial', 'compliance']),
        format: z.enum(['pdf', 'excel']),
        schedule: z.enum(['daily', 'weekly', 'monthly']),
        dayOfWeek: z.number().optional(),
        dayOfMonth: z.number().optional(),
        time: z.string(),
        recipients: z.string(),
        filters: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const reportId = await db.createScheduledReport({
          ...input,
          createdBy: ctx.user.id,
        });
        return { id: reportId };
      }),

    update: protectedOrgProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        reportType: z.enum(['assetInventory', 'maintenanceSchedule', 'workOrders', 'financial', 'compliance']).optional(),
        format: z.enum(['pdf', 'excel']).optional(),
        schedule: z.enum(['daily', 'weekly', 'monthly']).optional(),
        dayOfWeek: z.number().optional(),
        dayOfMonth: z.number().optional(),
        time: z.string().optional(),
        recipients: z.string().optional(),
        filters: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateScheduledReport(id, data);
        return { success: true };
      }),

    delete: protectedOrgProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteScheduledReport(input.id);
        return { success: true };
       }),
  }),

  // ============= BULK IMPORT/EXPORT =============
  bulkOperations: router({
    exportAssets: protectedOrgProcedure
      .query(async ({ ctx }) => {
        resolveTenantIdFromContext(ctx);
        const { exportAssets } = await import('./bulkImportExport');
        const buffer = await exportAssets();
        return {
          data: buffer.toString('base64'),
          filename: `assets_export_${Date.now()}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),

    exportWorkOrders: protectedOrgProcedure
      .query(async ({ ctx }) => {
        resolveTenantIdFromContext(ctx);
        const { exportWorkOrders } = await import('./bulkImportExport');
        const buffer = await exportWorkOrders();
        return {
          data: buffer.toString('base64'),
          filename: `work_orders_export_${Date.now()}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),

    exportInventory: protectedOrgProcedure
      .query(async ({ ctx }) => {
        resolveTenantIdFromContext(ctx);
        const { exportInventory } = await import('./bulkImportExport');
        const buffer = await exportInventory();
        return {
          data: buffer.toString('base64'),
          filename: `inventory_export_${Date.now()}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),

    getImportTemplate: protectedOrgProcedure
      .input(z.object({ entity: z.enum(['assets', 'workOrders', 'inventory']) }))
      .query(async ({ input, ctx }) => {
        resolveTenantIdFromContext(ctx);
        const { generateImportTemplate } = await import('./bulkImportExport');
        const buffer = await generateImportTemplate(input.entity);
        return {
          data: buffer.toString('base64'),
          filename: `${input.entity}_import_template.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),

    importAssets: managerOrAdminProcedure
      .input(z.object({ fileData: z.string() })) // base64 encoded
      .mutation(async ({ input, ctx }) => {
        resolveTenantIdFromContext(ctx);
        const { importAssets } = await import('./bulkImportExport');
        const buffer = Buffer.from(input.fileData, 'base64');
        return await importAssets(buffer, ctx.user.id);
      }),

    exportSites: protectedOrgProcedure
      .query(async ({ ctx }) => {
        resolveTenantIdFromContext(ctx);
        const { exportSites } = await import('./bulkImportExport');
        const buffer = await exportSites();
        return {
          data: buffer.toString('base64'),
          filename: `sites_export_${Date.now()}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),

    importSites: managerOrAdminProcedure
      .input(z.object({ fileData: z.string() })) // base64 encoded
      .mutation(async ({ input, ctx }) => {
        resolveTenantIdFromContext(ctx);
        const { importSites } = await import('./bulkImportExport');
        const buffer = Buffer.from(input.fileData, 'base64');
        return await importSites(buffer);
      }),

    downloadSiteTemplate: protectedOrgProcedure
      .query(async ({ ctx }) => {
        resolveTenantIdFromContext(ctx);
        const { generateSiteTemplate } = await import('./bulkImportExport');
        const buffer = await generateSiteTemplate();
        return {
          data: buffer.toString('base64'),
          filename: 'NRCS_Sites_Import_Template.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),
  }),

  // ============= ASSET TRANSFERS =============
  transfers: router({
    list: protectedOrgProcedure
      .input(z.object({
        status: z.string().optional(),
        assetId: z.number().optional(),
        siteId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAllAssetTransfers(input);
      }),

    getById: protectedOrgProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getAssetTransferById(input.id);
      }),

    create: protectedOrgProcedure
      .input(z.object({
        assetId: z.number(),
        fromSiteId: z.number(),
        toSiteId: z.number(),
        reason: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.createAssetTransfer({
          ...input,
          requestedBy: ctx.user.id,
        });
      }),

    approve: managerOrAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return await db.updateAssetTransfer(input.id, {
          status: 'approved',
          approvedBy: ctx.user.id,
          approvalDate: new Date(),
        });
      }),

    reject: managerOrAdminProcedure
      .input(z.object({ id: z.number(), notes: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        return await db.updateAssetTransfer(input.id, {
          status: 'rejected',
          approvedBy: ctx.user.id,
          approvalDate: new Date(),
          notes: input.notes,
        });
      }),

    startTransfer: protectedOrgProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.updateAssetTransfer(input.id, {
          status: 'in_transit',
          transferDate: new Date(),
        });
      }),

    complete: protectedOrgProcedure
      .input(z.object({ 
        id: z.number(),
        handoverChecklist: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const transfer = await db.getAssetTransferById(input.id);
        if (!transfer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Transfer not found' });
        
        // Update asset location
        await db.updateAsset(transfer.assetId, {
          siteId: transfer.toSiteId,
        });
        
        return await db.updateAssetTransfer(input.id, {
          status: 'completed',
          completionDate: new Date(),
          handoverChecklist: input.handoverChecklist,
        });
      }),

    getPending: managerOrAdminProcedure
      .query(async () => {
        return await db.getPendingTransferRequests();
      }),
  }),

  // ============= QUICKBOOKS INTEGRATION =============
  quickbooks: router({
    getConfig: protectedOrgProcedure.query(async () => {
      return await db.getQuickBooksConfig();
    }),
    
    saveConfig: protectedOrgProcedure
      .input(z.object({
        clientId: z.string(),
        clientSecret: z.string(),
        redirectUri: z.string(),
        realmId: z.string(),
      }))
      .mutation(async ({ input }) => {
        return await db.saveQuickBooksConfig({
          ...input,
          isActive: 1,
          autoSync: 1,
        });
      }),
    
    getAuthUrl: protectedOrgProcedure
      .input(z.object({
        clientId: z.string(),
        redirectUri: z.string(),
      }))
      .query(({ input }) => {
        const { getQuickBooksAuthUrl } = require('./quickbooksIntegration');
        return { url: getQuickBooksAuthUrl(input) };
      }),
    
    exchangeCode: protectedOrgProcedure
      .input(z.object({
        code: z.string(),
        realmId: z.string(),
      }))
      .mutation(async ({ input }) => {
        const config = await db.getQuickBooksConfig();
        if (!config) throw new Error('QuickBooks not configured');
        
        const { exchangeCodeForToken } = require('./quickbooksIntegration');
        const tokens = await exchangeCodeForToken(input.code, {
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          redirectUri: config.redirectUri,
        });
        
        // Update config with tokens
        const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
        await db.updateQuickBooksTokens(config.id, tokens.accessToken, tokens.refreshToken, expiresAt);
        
        // Update realm ID if provided
        if (input.realmId) {
          await db.saveQuickBooksConfig({
            ...config,
            realmId: input.realmId,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            tokenExpiresAt: expiresAt,
          });
        }
        
        return { success: true };
      }),
    
    syncTransactions: protectedOrgProcedure.mutation(async () => {
      const config = await db.getQuickBooksConfig();
      if (!config || !config.accessToken) {
        throw new Error('QuickBooks not authenticated');
      }
      
      const { syncAllTransactions } = require('./quickbooksIntegration');
      const result = await syncAllTransactions({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
        realmId: config.realmId,
        accessToken: config.accessToken,
        refreshToken: config.refreshToken || undefined,
      });
      
      await db.updateQuickBooksLastSync(config.id);
      
      return result;
    }),
    
    testConnection: protectedOrgProcedure.query(async () => {
      const config = await db.getQuickBooksConfig();
      if (!config || !config.accessToken) {
        return { connected: false, error: 'Not authenticated' };
      }
      
      const { testConnection } = require('./quickbooksIntegration');
      const connected = await testConnection({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
        realmId: config.realmId,
        accessToken: config.accessToken,
        refreshToken: config.refreshToken || undefined,
      });
      
      return { connected };
    }),
  }),

  // ============= USER PREFERENCES =============
  userPreferences: router({
    get: protectedOrgProcedure.query(async ({ ctx }) => {
      return await db.getUserPreferences(ctx.user.id);
    }),
    
    update: protectedOrgProcedure
      .input(z.object({
        sidebarWidth: z.number().optional(),
        sidebarCollapsed: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.upsertUserPreferences({
          userId: ctx.user.id,
          ...input,
        });
      }),

    updateDashboardWidgets: protectedOrgProcedure
      .input(z.object({
        widgets: z.record(z.string(), z.boolean()),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.upsertUserPreferences({
          userId: ctx.user.id,
          dashboardWidgets: JSON.stringify(input.widgets),
        });
      }),
  }),

  // ============= EMAIL NOTIFICATIONS =============
  emailNotifications: router({
    send: adminProcedure
      .input(z.object({
        subject: z.string().min(1),
        body: z.string().min(1),
        recipientType: z.enum(['all', 'individual', 'role']),
        recipientIds: z.array(z.number()).optional(),
        recipientRole: z.enum(['admin', 'manager', 'user']).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { sendBulkEmails, generateEmailTemplate } = require('./emailService');
        
        // Get recipient emails based on type
        let recipients: string[] = [];
        
        if (input.recipientType === 'all') {
          const allUsers = await db.getAllUsers();
          recipients = allUsers.filter(u => u.email).map(u => u.email!);
        } else if (input.recipientType === 'individual' && input.recipientIds) {
          const users = await Promise.all(
            input.recipientIds.map(id => db.getUserById(id))
          );
          recipients = users.filter(u => u && u.email).map(u => u!.email!);
        } else if (input.recipientType === 'role' && input.recipientRole) {
          const allUsers = await db.getAllUsers();
          recipients = allUsers
            .filter(u => u.role === input.recipientRole && u.email)
            .map(u => u.email!);
        }
        
        // Send emails
        const htmlBody = generateEmailTemplate(input.body, input.subject);
        const { sent, failed } = await sendBulkEmails(recipients, input.subject, htmlBody);
        
        // Save to history
        await db.createEmailNotification({
          subject: input.subject,
          body: input.body,
          recipientType: input.recipientType,
          recipientIds: input.recipientIds ? JSON.stringify(input.recipientIds) : null,
          recipientRole: input.recipientRole || null,
          sentBy: ctx.user.id,
          status: failed > 0 ? 'failed' : 'sent',
          recipientCount: sent,
        });
        
        return { sent, failed, total: recipients.length };
      }),
    
    history: adminProcedure.query(async () => {
      return await db.getEmailNotificationHistory(100);
    }),
    
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getEmailNotificationById(input.id);
      }),
  }),

  // ============= DEPRECIATION =============
  depreciation: router({
    calculate: protectedOrgProcedure
      .input(z.object({
        assetId: z.number(),
      }))
      .query(async ({ input }) => {
        const { calculateDepreciation } = require('./depreciation');
        const asset = await db.getAssetById(input.assetId);
        
        if (!asset || !asset.depreciationMethod || asset.depreciationMethod === 'none') {
          return null;
        }
        
        if (!asset.acquisitionCost || !asset.depreciationStartDate) {
          return null;
        }
        
        return calculateDepreciation({
          acquisitionCost: Number(asset.acquisitionCost),
          residualValue: Number(asset.residualValue || 0),
          usefulLifeYears: asset.usefulLifeYears || 5,
          depreciationStartDate: new Date(asset.depreciationStartDate),
          method: asset.depreciationMethod as 'straight-line' | 'declining-balance',
          decliningBalanceRate: 2, // Double-declining balance
        });
      }),
    
    summary: protectedOrgProcedure.query(async () => {
      const { calculateDepreciation } = require('./depreciation');
      const assets = await db.getAllAssets();
      
      let totalAcquisitionCost = 0;
      let totalCurrentValue = 0;
      let totalAccumulatedDepreciation = 0;
      let assetsWithDepreciation = 0;
      
      for (const asset of assets) {
        if (asset.acquisitionCost) {
          totalAcquisitionCost += Number(asset.acquisitionCost);
        }
        
        if (asset.depreciationMethod && asset.depreciationMethod !== 'none' && asset.depreciationStartDate && asset.acquisitionCost) {
          assetsWithDepreciation++;
          const result = calculateDepreciation({
            acquisitionCost: Number(asset.acquisitionCost),
            residualValue: Number(asset.residualValue || 0),
            usefulLifeYears: asset.usefulLifeYears || 5,
            depreciationStartDate: new Date(asset.depreciationStartDate),
            method: asset.depreciationMethod as 'straight-line' | 'declining-balance',
            decliningBalanceRate: 2,
          });
          
          if (result) {
            totalCurrentValue += result.currentBookValue;
            totalAccumulatedDepreciation += result.accumulatedDepreciation;
          }
        } else if (asset.currentValue) {
          totalCurrentValue += Number(asset.currentValue);
        } else if (asset.acquisitionCost) {
          totalCurrentValue += Number(asset.acquisitionCost);
        }
      }
      
      return {
        totalAcquisitionCost: Math.round(totalAcquisitionCost * 100) / 100,
        totalCurrentValue: Math.round(totalCurrentValue * 100) / 100,
        totalAccumulatedDepreciation: Math.round(totalAccumulatedDepreciation * 100) / 100,
        totalDepreciationPercentage: totalAcquisitionCost > 0 
          ? Math.round((totalAccumulatedDepreciation / totalAcquisitionCost) * 10000) / 100 
          : 0,
        assetsWithDepreciation,
        totalAssets: assets.length,
      };
    }),
  }),

  // ============= PENDING USERS (Admin Approval) =============
  pendingUsers: router({
    list: adminProcedure.query(async () => {
      const database = await db.getDb();
      if (!database) return [];
      const { pendingUsers } = await import("../drizzle/schema");
      return await database.select().from(pendingUsers);
    }),
    
    approve: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const { approvePendingUser } = await import("./magicLinkAuth");
        return await approvePendingUser(input.id, ctx.user.id);
      }),
    
    reject: adminProcedure
      .input(z.object({
        id: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { rejectPendingUser } = await import("./magicLinkAuth");
        return await rejectPendingUser(input.id, ctx.user.id, input.reason);
      }),
  }),

  // ============= WORK ORDER TEMPLATES =============
  workOrderTemplates: router({
    list: protectedOrgProcedure
      .input(z.object({
        isActive: z.boolean().optional(),
        type: z.enum(['corrective', 'preventive', 'inspection', 'emergency']).optional(),
        categoryId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getWorkOrderTemplates(input || {});
      }),

    getById: protectedOrgProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getWorkOrderTemplateById(input.id);
      }),

    create: managerOrAdminProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        type: z.enum(['corrective', 'preventive', 'inspection', 'emergency']),
        priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
        estimatedDuration: z.number().optional(),
        checklistItems: z.string().optional(), // JSON string
        instructions: z.string().optional(),
        categoryId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.createWorkOrderTemplate({
          ...input,
          createdBy: ctx.user.id,
          isActive: true,
        });
      }),

    update: managerOrAdminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        type: z.enum(['corrective', 'preventive', 'inspection', 'emergency']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        estimatedDuration: z.number().optional(),
        checklistItems: z.string().optional(),
        instructions: z.string().optional(),
        categoryId: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateWorkOrderTemplate(id, data);
        return { success: true };
      }),

    delete: managerOrAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteWorkOrderTemplate(input.id);
        return { success: true };
      }),
  }),

  // ============= AUDIT LOGS =============
  auditLogs: router({
    list: protectedOrgProcedure
      .input(z.object({
        entityType: z.string().optional(),
        entityId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAuditLogs(input || {});
      }),
  }),

  // ============= NRCS EXCEL TEMPLATES =============
  nrcsTemplates: router({
    downloadTemplate: protectedOrgProcedure
      .query(async () => {
        const { generateNRCSAssetTemplate } = await import('./nrcsExcelTemplate');
        const buffer = await generateNRCSAssetTemplate();
        return {
          data: buffer.toString('base64'),
          filename: 'NRCS_Asset_Register_Template.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),
    
    exportAssets: protectedOrgProcedure
      .query(async () => {
        const assets = await db.getAllAssets();
        const { exportAssetsToNRCSFormat } = await import('./nrcsExcelTemplate');
        const buffer = await exportAssetsToNRCSFormat(assets);
        return {
          data: buffer.toString('base64'),
          filename: `NRCS_Asset_Register_${new Date().toISOString().split('T')[0]}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),
    
    importAssets: protectedOrgProcedure
      .input(z.object({
        fileData: z.string(), // base64 encoded Excel file
      }))
      .mutation(async ({ input, ctx }) => {
        const { parseAndValidateNRCSExcel } = await import('./nrcsExcelImporter');
        const buffer = Buffer.from(input.fileData, 'base64');
        const result = await parseAndValidateNRCSExcel(buffer, ctx.user.id);
        return result;
      }),
  }),
});

export type AppRouter = typeof appRouter;

