// @ts-nocheck — ctx.user nullable, db/schema result types, pg vs mysql schema
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions, getAuthSessionCookieOptions } from "./_core/cookies";
import { invalidateUserCache } from "./_core/userCache";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { adminProcedure, managerOrAdminProcedure, viewerProcedure } from "./routers/_shared";
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
import { authRouter } from "./routers/auth";
import { adminImpersonationRouter } from "./routers/adminImpersonation";
import { sessionsRouter } from "./routers/sessions";
import { sitesRouter } from "./routers/sites";
import { assetsRouter } from "./routers/assets";
import { workOrdersRouter } from "./routers/workOrders";
import { usersRouter } from "./routers/users";
import { assetCategoriesRouter } from "./routers/assetCategories";
import { nrcsRouter } from "./routers/nrcs";
import { dashboardRouter } from "./routers/dashboard";
import { maintenanceRouter } from "./routers/maintenance";
import { inventoryRouter } from "./routers/inventory";

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
  auth: authRouter,
  impersonation: adminImpersonationRouter,
  sessions: sessionsRouter,

  // ============= SITES MANAGEMENT =============
  sites: sitesRouter,

  // ============= ASSET CATEGORIES =============
  assetCategories: assetCategoriesRouter,

  // ============= NRCS REFERENCE DATA =============
  nrcs: nrcsRouter,

  // ============= ASSETS MANAGEMENT =============
  assets: assetsRouter,

  workOrders: workOrdersRouter,

  // ============= MAINTENANCE SCHEDULES =============
  maintenance: maintenanceRouter,

  // ============= INVENTORY =============
  inventory: inventoryRouter,

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

    recommendations: viewerProcedure
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

    recommendations: viewerProcedure
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

    risk: viewerProcedure
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

    assignments: viewerProcedure
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

    metrics: viewerProcedure.query(async ({ ctx }) => {
      return db.getLatestExecutiveMetricsSnapshot(resolveTenantIdFromContext(ctx));
    }),

    kpiTrends: viewerProcedure
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

  // ============= TELEMETRY =============
  telemetry: router({
    ingest: viewerProcedure
      .input(z.object({
        assetId: z.number(),
        metric: z.string().min(1).max(64),
        value: z.number(),
        timestamp: z.string().datetime().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const tenantId = resolveTenantIdFromContext(ctx);
        const asset = await db.getAssetById(input.assetId);
        if (!asset) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
        }
        const normalizedOrg = ctx.organizationId ? db.normalizeOrganizationId(ctx.organizationId) : null;
        const assetOrg = (asset as { organizationId?: string | null }).organizationId;
        if (normalizedOrg && assetOrg != null && assetOrg !== normalizedOrg) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Asset does not belong to your organization" });
        }
        const id = await db.createTelemetryPoint({
          tenantId,
          assetId: input.assetId,
          metric: input.metric,
          value: input.value,
          timestamp: input.timestamp ? new Date(input.timestamp) : undefined,
        });
        return { id: id ?? 0, success: true };
      }),

    ingestBatch: viewerProcedure
      .input(z.object({
        points: z.array(z.object({
          assetId: z.number(),
          metric: z.string().min(1).max(64),
          value: z.number(),
          timestamp: z.string().datetime().optional(),
        })).min(1).max(100),
      }))
      .mutation(async ({ input, ctx }) => {
        const tenantId = resolveTenantIdFromContext(ctx);
        const normalizedOrg = ctx.organizationId ? db.normalizeOrganizationId(ctx.organizationId) : null;
        const created: number[] = [];
        for (const p of input.points) {
          const asset = await db.getAssetById(p.assetId);
          if (!asset) continue;
          const assetOrg = (asset as { organizationId?: string | null }).organizationId;
          if (normalizedOrg && assetOrg != null && assetOrg !== normalizedOrg) continue;
          const id = await db.createTelemetryPoint({
            tenantId,
            assetId: p.assetId,
            metric: p.metric,
            value: p.value,
            timestamp: p.timestamp ? new Date(p.timestamp) : undefined,
          });
          if (id != null) created.push(id);
        }
        return { created: created.length, ids: created };
      }),
  }),

  // ============= VENDORS =============
  vendors: router({
    list: viewerProcedure.query(async ({ ctx }) => {
      return await db.getAllVendors(ctx.organizationId ?? undefined);
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
      .mutation(async ({ input, ctx }) => {
        return await db.createVendor({ ...input, organizationId: ctx.organizationId ?? undefined });
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
        return await bulkImportVendors(data, ctx.user.id, input.fileName, input.fileType, ctx.organizationId ?? undefined);
      }),

    downloadTemplate: viewerProcedure
      .input(z.object({ format: z.enum(['csv', 'excel']) }))
      .query(({ input }) => {
        const template = generateVendorsTemplate(input.format);
        return { template, format: input.format };
      }),

    export: viewerProcedure
      .input(z.object({ format: z.enum(['csv', 'excel']) }))
      .query(async ({ input, ctx }) => {
        const vendors = await db.getAllVendors(ctx.organizationId ?? undefined);
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

    riskScores: viewerProcedure
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
    list: viewerProcedure
      .input(z.object({
        assetId: z.number().optional(),
        workOrderId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        const [transactions, summary] = await Promise.all([
          db.getFinancialTransactions(input),
          db.getFinancialSummary(input),
        ]);
        return { transactions, summary };
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
    getAssetLifecycleCost: viewerProcedure
      .input(z.object({ assetId: z.number() }))
      .query(async ({ input }) => {
        const { calculateAssetLifecycleCost } = await import('./lifecycleCost');
        return await calculateAssetLifecycleCost(input.assetId);
      }),

    getCategoryCostSummary: viewerProcedure
      .query(async () => {
        const { getCategoryCostSummary } = await import('./lifecycleCost');
        return await getCategoryCostSummary();
      }),

    getCostOptimizationRecommendations: viewerProcedure
      .query(async () => {
        const { getCostOptimizationRecommendations } = await import('./lifecycleCost');
        return await getCostOptimizationRecommendations();
      }),

    getCostAnalytics: viewerProcedure
      .input(z.object({ days: z.number().default(30) }))
      .query(async ({ input }) => {
        return await db.getCostAnalytics(input.days);
      }),
  }),

  // ============= COMPLIANCE =============
  compliance: router({
    list: viewerProcedure
      .input(z.object({
        assetId: z.number().optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getAllComplianceRecords({ ...input, organizationId: ctx.organizationId ?? undefined });
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
      .mutation(async ({ input, ctx }) => {
        return await db.createComplianceRecord({ ...input, organizationId: ctx.organizationId ?? undefined });
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
  dashboard: dashboardRouter,

  // ============= USERS MANAGEMENT =============
  users: usersRouter,

  // ============= NOTIFICATIONS =============
  notifications: router({
    list: viewerProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return await db.getUserNotifications(ctx.user.id, input.limit);
      }),
    
    unreadCount: viewerProcedure
      .query(async ({ ctx }) => {
        return await db.getUnreadNotificationCount(ctx.user.id);
      }),
    
    markAsRead: viewerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.markNotificationAsRead(input.id);
      }),
    
    markAllAsRead: viewerProcedure
      .mutation(async ({ ctx }) => {
        return await db.markAllNotificationsAsRead(ctx.user.id);
      }),
    
    delete: viewerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteNotification(input.id);
      }),
    
    getPreferences: viewerProcedure
      .query(async ({ ctx }) => {
        return await db.getUserNotificationPreferences(ctx.user.id);
      }),
    
    updatePreferences: viewerProcedure
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

    getRunById: viewerProcedure
      .input(z.object({
        runId: z.number().int().positive(),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = resolveTenantIdFromContext(ctx);
        return getJobRunById(input.runId, tenantId);
      }),

    listRecent: viewerProcedure
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
    assetInventory: viewerProcedure
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
        const assets = await db.getAllAssets({ organizationId: ctx.organizationId ?? undefined });

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
    maintenanceSchedule: viewerProcedure
      .input(z.object({
        format: z.enum(['pdf', 'excel']),
        siteId: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        resolveTenantIdFromContext(ctx);
        const schedules = await db.getAllMaintenanceSchedules({ organizationId: ctx.organizationId ?? undefined });

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
    workOrders: viewerProcedure
      .input(z.object({
        format: z.enum(['pdf', 'excel']),
        siteId: z.number().optional(),
        status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        resolveTenantIdFromContext(ctx);
        const workOrders = await db.getAllWorkOrders({ organizationId: ctx.organizationId ?? undefined });

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
    financial: viewerProcedure
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
    compliance: viewerProcedure
      .input(z.object({
        format: z.enum(['pdf', 'excel']),
        siteId: z.number().optional(),
        status: z.enum(['compliant', 'non_compliant', 'pending']).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        resolveTenantIdFromContext(ctx);
        const records = await db.getAllComplianceRecords({ organizationId: ctx.organizationId ?? undefined });

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
    create: viewerProcedure
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
          organizationId: ctx.organizationId ?? undefined,
        });
        return { id: photoId };
      }),

    listByAsset: viewerProcedure
      .input(z.object({ assetId: z.number() }))
      .query(async ({ input }) => {
        return await db.getAssetPhotos(input.assetId);
      }),

    listByWorkOrder: viewerProcedure
      .input(z.object({ workOrderId: z.number() }))
      .query(async ({ input }) => {
        return await db.getWorkOrderPhotos(input.workOrderId);
      }),

    delete: viewerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteAssetPhoto(input.id);
        return { success: true };
      }),
  }),

  // Scheduled Reports Management
  scheduledReports: router({
    list: viewerProcedure.query(async () => {
      return await db.getScheduledReports();
    }),

    create: viewerProcedure
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

    update: viewerProcedure
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

    delete: viewerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteScheduledReport(input.id);
        return { success: true };
       }),
  }),

  // ============= BULK IMPORT/EXPORT =============
  bulkOperations: router({
    exportAssets: viewerProcedure
      .query(async ({ ctx }) => {
        resolveTenantIdFromContext(ctx);
        const { exportAssets } = await import('./bulkImportExport');
        const buffer = await exportAssets({ format: 'excel', includeHeaders: true, organizationId: ctx.organizationId ?? undefined });
        return {
          data: buffer.toString('base64'),
          filename: `assets_export_${Date.now()}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),

    exportWorkOrders: viewerProcedure
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

    exportInventory: viewerProcedure
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

    getImportTemplate: viewerProcedure
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

    exportSites: viewerProcedure
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

    downloadSiteTemplate: viewerProcedure
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
    list: viewerProcedure
      .input(z.object({
        status: z.string().optional(),
        assetId: z.number().optional(),
        siteId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAllAssetTransfers(input);
      }),

    getById: viewerProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getAssetTransferById(input.id);
      }),

    create: viewerProcedure
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

    startTransfer: viewerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.updateAssetTransfer(input.id, {
          status: 'in_transit',
          transferDate: new Date(),
        });
      }),

    complete: viewerProcedure
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
    getConfig: viewerProcedure.query(async () => {
      return await db.getQuickBooksConfig();
    }),
    
    saveConfig: viewerProcedure
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
    
    getAuthUrl: viewerProcedure
      .input(z.object({
        clientId: z.string(),
        redirectUri: z.string(),
      }))
      .query(({ input }) => {
        const { getQuickBooksAuthUrl } = require('./quickbooksIntegration');
        return { url: getQuickBooksAuthUrl(input) };
      }),
    
    exchangeCode: viewerProcedure
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
    
    syncTransactions: viewerProcedure.mutation(async () => {
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
    
    testConnection: viewerProcedure.query(async () => {
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
    get: viewerProcedure.query(async ({ ctx }) => {
      return await db.getUserPreferences(ctx.user.id);
    }),
    
    update: viewerProcedure
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

    updateDashboardWidgets: viewerProcedure
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
    calculate: viewerProcedure
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
    
    summary: viewerProcedure.query(async ({ ctx }) => {
      const { calculateDepreciation } = require('./depreciation');
      const assets = await db.getAllAssets({ organizationId: ctx.organizationId ?? undefined });
      
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
    list: viewerProcedure
      .input(z.object({
        isActive: z.boolean().optional(),
        type: z.enum(['corrective', 'preventive', 'inspection', 'emergency']).optional(),
        categoryId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getWorkOrderTemplates(input || {});
      }),

    getById: viewerProcedure
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
    list: viewerProcedure
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
    downloadTemplate: viewerProcedure
      .query(async () => {
        const { generateNRCSAssetTemplate } = await import('./nrcsExcelTemplate');
        const buffer = await generateNRCSAssetTemplate();
        return {
          data: buffer.toString('base64'),
          filename: 'NRCS_Asset_Register_Template.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),
    
    exportAssets: viewerProcedure
      .query(async ({ ctx }) => {
        const assets = await db.getAllAssets({ organizationId: ctx.organizationId ?? undefined });
        const { exportAssetsToNRCSFormat } = await import('./nrcsExcelTemplate');
        const buffer = await exportAssetsToNRCSFormat(assets);
        return {
          data: buffer.toString('base64'),
          filename: `NRCS_Asset_Register_${new Date().toISOString().split('T')[0]}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),
    
    importAssets: viewerProcedure
      .input(z.object({
        fileData: z.string(), // base64 encoded Excel file
      }))
      .mutation(async ({ input, ctx }) => {
        const { parseAndValidateNRCSExcel } = await import('./nrcsExcelImporter');
        const buffer = Buffer.from(input.fileData, 'base64');
        const result = await parseAndValidateNRCSExcel(buffer, ctx.user.id, ctx.organizationId ?? undefined);
        return result;
      }),
  }),
});

export type AppRouter = typeof appRouter;

