// @ts-nocheck
import {
  pgTable,
  integer,
  text,
  timestamp as pgTimestamp,
  uuid,
  varchar,
  numeric,
  boolean,
  bigint,
  index,
  uniqueIndex,
  serial,
} from "drizzle-orm/pg-core";

function mysqlTable(name: string, columns: any, extraConfig?: any) {
  return pgTable(name, columns, extraConfig);
}

function mysqlEnum(name: string, _values: readonly string[]) {
  // Compatibility shim for existing schema shape during MySQL->Postgres migration.
  return text(name) as any;
}

function int(name: string) {
  const col = integer(name) as any;
  col.autoincrement = () => serial(name);
  return col;
}

const decimal = numeric;

function timestamp(name: string) {
  const col = pgTimestamp(name) as any;
  col.onUpdateNow = () => col.$onUpdateFn(() => new Date());
  return col;
}

/**
 * Core user table backing auth flow with extended roles for EAM system
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "manager", "technician", "user"]).default("user").notNull(),
  siteId: int("siteId"),
  // User verification fields
  status: mysqlEnum("status", ["pending", "approved", "rejected", "active", "inactive"]).default("pending").notNull(),
  jobTitle: varchar("jobTitle", { length: 255 }),
  phoneNumber: varchar("phoneNumber", { length: 50 }),
  phoneCountryCode: varchar("phoneCountryCode", { length: 10 }).default("+234"),
  agency: varchar("agency", { length: 255 }),
  geographicalArea: varchar("geographicalArea", { length: 255 }),
  registrationPurpose: text("registrationPurpose"),
  employeeId: varchar("employeeId", { length: 100 }),
  department: varchar("department", { length: 255 }),
  supervisorName: varchar("supervisorName", { length: 255 }),
  supervisorEmail: varchar("supervisorEmail", { length: 320 }),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  rejectionReason: text("rejectionReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  hasCompletedOnboarding: boolean("has_completed_onboarding").default(false).notNull(),
});

/**
 * Sites/Locations for multi-site management
 */
export const sites = mysqlTable("sites", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }).default("Nigeria"),
  contactPerson: varchar("contactPerson", { length: 255 }),
  contactPhone: varchar("contactPhone", { length: 50 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  isActive: boolean("isActive").default(true).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),

  /** Canonical tenant (Phase 3). DB column: organization_id. */
  organizationId: uuid("organization_id"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  organizationIdIdx: index("idx_sites_organization_id").on(table.organizationId),
}));

/**
 * Asset Categories (e.g., Machinery, Buildings, Vehicles, Equipment)
 */
export const assetCategories = mysqlTable("assetCategories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * NRCS Branch Codes - All Nigerian states and HQ
 */
export const branchCodes = mysqlTable("branchCodes", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 10 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  state: varchar("state", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * NRCS Category Codes - Asset categories with depreciation rates
 */
export const categoryCodes = mysqlTable("categoryCodes", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 10 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  usefulLifeYears: int("usefulLifeYears"),
  depreciationRate: decimal("depreciationRate", { precision: 5, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * NRCS Sub-Categories - Specific item types (Laptop, Generator, etc.)
 */
export const subCategories = mysqlTable("subCategories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  categoryType: varchar("categoryType", { length: 20 }), // Asset or Inventory
  parentCategory: varchar("parentCategory", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Assets - Core asset inventory
 */
export const assets = mysqlTable("assets", {
  id: int("id").autoincrement().primaryKey(),
  assetTag: varchar("assetTag", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  categoryId: int("categoryId").notNull(),
  siteId: int("siteId").notNull(),
  status: varchar("status", { length: 100 }).default("In Use").notNull(),
  manufacturer: varchar("manufacturer", { length: 255 }),
  model: varchar("model", { length: 255 }),
  serialNumber: varchar("serialNumber", { length: 255 }),
  acquisitionDate: timestamp("acquisitionDate"),
  acquisitionCost: decimal("acquisitionCost", { precision: 15, scale: 2 }),
  currentValue: decimal("currentValue", { precision: 15, scale: 2 }),
  depreciationRate: decimal("depreciationRate", { precision: 5, scale: 2 }),
  warrantyExpiry: timestamp("warrantyExpiry"),
  location: varchar("location", { length: 255 }),
  assignedTo: int("assignedTo"),
  imageUrl: text("imageUrl"),
  notes: text("notes"),
  qrCode: text("qrCode"),
  barcode: varchar("barcode", { length: 255 }),
  barcodeFormat: varchar("barcodeFormat", { length: 50 }),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  
  // Depreciation fields
  depreciationMethod: varchar("depreciationMethod", { length: 50 }), // 'straight-line', 'declining-balance', 'none'
  usefulLifeYears: int("usefulLifeYears"), // Expected useful life in years
  residualValue: decimal("residualValue", { precision: 12, scale: 2 }), // Salvage value at end of life
  depreciationStartDate: timestamp("depreciationStartDate"), // When depreciation starts
  
  // NRCS Asset Register fields
  itemType: varchar("itemType", { length: 20 }).default("Asset"), // Asset or Inventory
  subCategory: varchar("subCategory", { length: 100 }), // Laptop, Generator, Vehicle, etc.
  branchCode: varchar("branchCode", { length: 10 }), // _NHQ, ABI, ADA, etc.
  itemCategoryCode: varchar("itemCategoryCode", { length: 10 }), // CO, FF, GE, LA, etc.
  assetNumber: int("assetNumber"), // Sequential number for asset code
  productNumber: varchar("productNumber", { length: 255 }), // Serial/Product number from manufacturer
  methodOfAcquisition: varchar("methodOfAcquisition", { length: 100 }), // Donated, Purchased, etc.
  acquisitionDetails: text("acquisitionDetails"), // Details if method is Other
  projectReference: varchar("projectReference", { length: 255 }), // Project name if applicable
  yearAcquired: int("yearAcquired"), // Year of acquisition
  acquiredCondition: varchar("acquiredCondition", { length: 20 }), // New or Used
  currentDepreciatedValue: decimal("currentDepreciatedValue", { precision: 15, scale: 2 }), // Current value after depreciation
  assignedToName: varchar("assignedToName", { length: 255 }), // Full name of assigned person
  department: varchar("department", { length: 255 }), // Department of assigned person
  condition: varchar("condition", { length: 100 }), // Good, Fair, Damaged, etc.
  lastPhysicalCheckDate: timestamp("lastPhysicalCheckDate"), // Date of last verification
  checkConductedBy: varchar("checkConductedBy", { length: 255 }), // Name and designation
  remarks: text("remarks"), // Additional notes

  /** Canonical tenant (Phase 3). DB column: organization_id. Do not remove legacy tenantId until Phase 4. */
  organizationId: uuid("organization_id"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  organizationIdIdx: index("idx_assets_organization_id").on(table.organizationId),
}));

/**
 * Asset Edit History - Tracks all changes to assets for audit trail
 */
export const assetEditHistory = mysqlTable("asset_edit_history", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("asset_id").notNull(),
  userId: int("user_id").notNull(),
  fieldName: varchar("field_name", { length: 100 }).notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
}, (table) => ({
  assetIdIdx: index("idx_asset_id").on(table.assetId),
  userIdIdx: index("idx_user_id").on(table.userId),
  changedAtIdx: index("idx_changed_at").on(table.changedAt),
}));

/**
 * Work Orders
 */
export const workOrders = mysqlTable("workOrders", {
  id: int("id").autoincrement().primaryKey(),
  workOrderNumber: varchar("workOrderNumber", { length: 100 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  assetId: int("assetId").notNull(),
  siteId: int("siteId").notNull(),
  type: mysqlEnum("type", ["corrective", "preventive", "inspection", "emergency"]).notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  status: mysqlEnum("status", ["pending", "assigned", "in_progress", "on_hold", "completed", "cancelled"]).default("pending").notNull(),
  assignedTo: int("assignedTo"),
  requestedBy: int("requestedBy").notNull(),
  scheduledStart: timestamp("scheduledStart"),
  scheduledEnd: timestamp("scheduledEnd"),
  actualStart: timestamp("actualStart"),
  actualEnd: timestamp("actualEnd"),
  estimatedCost: decimal("estimatedCost", { precision: 15, scale: 2 }),
  actualCost: decimal("actualCost", { precision: 15, scale: 2 }),
  completionNotes: text("completionNotes"),

  /** Canonical tenant (Phase 3). DB column: organization_id. */
  organizationId: uuid("organization_id"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  organizationIdIdx: index("idx_workOrders_organization_id").on(table.organizationId),
}));

/**
 * Preventive Maintenance Schedules
 */
export const maintenanceSchedules = mysqlTable("maintenanceSchedules", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  assetId: int("assetId").notNull(),
  frequency: mysqlEnum("frequency", ["daily", "weekly", "monthly", "quarterly", "semi_annual", "annual"]).notNull(),
  frequencyValue: int("frequencyValue").default(1).notNull(),
  lastPerformed: timestamp("lastPerformed"),
  nextDue: timestamp("nextDue").notNull(),
  assignedTo: int("assignedTo"),
  isActive: boolean("isActive").default(true).notNull(),
  taskTemplate: text("taskTemplate"),
  estimatedDuration: int("estimatedDuration"),

  /** Canonical tenant (Phase 3). DB column: organization_id. */
  organizationId: uuid("organization_id"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  organizationIdIdx: index("idx_maintenanceSchedules_organization_id").on(table.organizationId),
}));

/**
 * Inventory Items (spare parts and supplies)
 */
export const inventoryItems = mysqlTable("inventoryItems", {
  id: int("id").autoincrement().primaryKey(),
  itemCode: varchar("itemCode", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  siteId: int("siteId").notNull(),
  currentStock: int("currentStock").default(0).notNull(),
  minStockLevel: int("minStockLevel").default(0).notNull(),
  reorderPoint: int("reorderPoint").default(0).notNull(),
  maxStockLevel: int("maxStockLevel"),
  unitOfMeasure: varchar("unitOfMeasure", { length: 50 }),
  unitCost: decimal("unitCost", { precision: 15, scale: 2 }),
  vendorId: int("vendorId"),
  location: varchar("location", { length: 255 }),

  /** Canonical tenant (Phase 3). DB column: organization_id. */
  organizationId: uuid("organization_id"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  organizationIdIdx: index("idx_inventoryItems_organization_id").on(table.organizationId),
}));

/**
 * Inventory Transactions
 */
export const inventoryTransactions = mysqlTable("inventoryTransactions", {
  id: int("id").autoincrement().primaryKey(),
  itemId: int("itemId").notNull(),
  type: mysqlEnum("type", ["in", "out", "adjustment", "transfer"]).notNull(),
  quantity: int("quantity").notNull(),
  workOrderId: int("workOrderId"),
  fromSiteId: int("fromSiteId"),
  toSiteId: int("toSiteId"),
  unitCost: decimal("unitCost", { precision: 15, scale: 2 }),
  totalCost: decimal("totalCost", { precision: 15, scale: 2 }),
  performedBy: int("performedBy").notNull(),
  notes: text("notes"),
  transactionDate: timestamp("transactionDate").defaultNow().notNull(),

  /** Canonical tenant (Phase 3). DB column: organization_id. */
  organizationId: uuid("organization_id"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  organizationIdIdx: index("idx_inventoryTransactions_organization_id").on(table.organizationId),
}));

/**
 * Warehouse transfer recommendations generated by intelligence worker.
 */
export const warehouseTransferRecommendations = mysqlTable(
  "warehouse_transfer_recommendations",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull(),
    stockItemId: int("stock_item_id").notNull(),
    sourceWarehouseId: int("source_warehouse_id").notNull(),
    targetWarehouseId: int("target_warehouse_id").notNull(),
    transferQuantity: int("transfer_quantity").notNull(),
    transferPriority: mysqlEnum("transfer_priority", [
      "balanced",
      "moderate",
      "urgent",
      "critical",
    ]).notNull(),
    pressureScore: decimal("pressure_score", { precision: 6, scale: 4 }).notNull(),
    agentExecutionId: varchar("agent_execution_id", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("idx_warehouse_transfer_recos_tenant").on(table.tenantId),
    stockItemIdx: index("idx_warehouse_transfer_recos_stock_item").on(table.stockItemId),
    createdAtIdx: index("idx_warehouse_transfer_recos_created_at").on(table.createdAt),
    dedupeExecutionIdx: uniqueIndex("uq_warehouse_transfer_recos_execution").on(
      table.tenantId,
      table.stockItemId,
      table.sourceWarehouseId,
      table.targetWarehouseId,
      table.agentExecutionId,
    ),
  }),
);

/**
 * Vendor performance metrics snapshot per execution.
 */
export const vendorPerformanceMetrics = mysqlTable(
  "vendor_performance_metrics",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull(),
    vendorId: int("vendor_id").notNull(),
    deliveryReliability: decimal("delivery_reliability", { precision: 6, scale: 4 }).notNull(),
    costVariance: decimal("cost_variance", { precision: 6, scale: 4 }).notNull(),
    leadTimeStability: decimal("lead_time_stability", { precision: 6, scale: 4 }).notNull(),
    defectRate: decimal("defect_rate", { precision: 6, scale: 4 }).notNull(),
    vendorScore: decimal("vendor_score", { precision: 6, scale: 4 }).notNull(),
    agentExecutionId: varchar("agent_execution_id", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("idx_vendor_perf_metrics_tenant").on(table.tenantId),
    vendorIdx: index("idx_vendor_perf_metrics_vendor").on(table.vendorId),
    createdAtIdx: index("idx_vendor_perf_metrics_created_at").on(table.createdAt),
    dedupeExecutionIdx: uniqueIndex("uq_vendor_perf_metrics_execution").on(
      table.tenantId,
      table.vendorId,
      table.agentExecutionId,
    ),
  }),
);

/**
 * Vendor risk scoring output for procurement decisions.
 */
export const vendorRiskScores = mysqlTable(
  "vendor_risk_scores",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull(),
    vendorId: int("vendor_id").notNull(),
    vendorScore: decimal("vendor_score", { precision: 6, scale: 4 }).notNull(),
    riskScore: decimal("risk_score", { precision: 6, scale: 4 }).notNull(),
    riskBand: mysqlEnum("risk_band", ["low", "medium", "high"]).notNull(),
    agentExecutionId: varchar("agent_execution_id", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("idx_vendor_risk_scores_tenant").on(table.tenantId),
    vendorIdx: index("idx_vendor_risk_scores_vendor").on(table.vendorId),
    createdAtIdx: index("idx_vendor_risk_scores_created_at").on(table.createdAt),
    dedupeExecutionIdx: uniqueIndex("uq_vendor_risk_scores_execution").on(
      table.tenantId,
      table.vendorId,
      table.agentExecutionId,
    ),
  }),
);

/**
 * Procurement recommendations generated from deterministic scoring.
 */
export const procurementRecommendations = mysqlTable(
  "procurement_recommendations",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull(),
    stockItemId: int("stock_item_id").notNull(),
    recommendedVendorId: int("recommended_vendor_id").notNull(),
    recommendedQuantity: int("recommended_quantity").notNull(),
    demandScore: decimal("demand_score", { precision: 6, scale: 4 }).notNull(),
    vendorRiskScore: decimal("vendor_risk_score", { precision: 6, scale: 4 }).notNull(),
    procurementPriority: mysqlEnum("procurement_priority", [
      "monitor",
      "prepare_procurement",
      "reorder",
      "immediate_procurement",
    ]).notNull(),
    agentExecutionId: varchar("agent_execution_id", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("idx_procurement_recos_tenant").on(table.tenantId),
    stockItemIdx: index("idx_procurement_recos_stock_item").on(table.stockItemId),
    createdAtIdx: index("idx_procurement_recos_created_at").on(table.createdAt),
    dedupeExecutionIdx: uniqueIndex("uq_procurement_recos_execution").on(
      table.tenantId,
      table.stockItemId,
      table.recommendedVendorId,
      table.agentExecutionId,
    ),
  }),
);

/**
 * Purchase orders created from procurement recommendations.
 */
export const purchaseOrders = mysqlTable(
  "purchase_orders",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull(),
    vendorId: int("vendor_id").notNull(),
    status: mysqlEnum("status", ["draft", "submitted", "approved", "rejected", "closed"])
      .notNull()
      .default("draft"),
    totalValue: decimal("total_value", { precision: 15, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("idx_purchase_orders_tenant").on(table.tenantId),
    vendorIdx: index("idx_purchase_orders_vendor").on(table.vendorId),
    createdAtIdx: index("idx_purchase_orders_created_at").on(table.createdAt),
  }),
);

/**
 * Supply chain risk snapshots per stock item/vendor combination.
 */
export const supplyChainRiskScores = mysqlTable(
  "supply_chain_risk_scores",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull(),
    stockItemId: int("stock_item_id").notNull(),
    vendorId: int("vendor_id").notNull(),
    demandVolatility: decimal("demand_volatility", { precision: 6, scale: 4 }).notNull(),
    leadTimeRisk: decimal("lead_time_risk", { precision: 6, scale: 4 }).notNull(),
    vendorRisk: decimal("vendor_risk", { precision: 6, scale: 4 }).notNull(),
    transportRisk: decimal("transport_risk", { precision: 6, scale: 4 }).notNull(),
    inventoryPressure: decimal("inventory_pressure", { precision: 6, scale: 4 }).notNull(),
    supplyChainRiskIndex: decimal("supply_chain_risk_index", { precision: 6, scale: 4 }).notNull(),
    riskBand: mysqlEnum("risk_band", ["low", "moderate", "elevated", "high", "critical"]).notNull(),
    agentExecutionId: varchar("agent_execution_id", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("idx_supply_chain_risk_scores_tenant").on(table.tenantId),
    stockItemIdx: index("idx_supply_chain_risk_scores_stock_item").on(table.stockItemId),
    vendorIdx: index("idx_supply_chain_risk_scores_vendor").on(table.vendorId),
    createdAtIdx: index("idx_supply_chain_risk_scores_created_at").on(table.createdAt),
    dedupeExecutionIdx: uniqueIndex("uq_supply_chain_risk_scores_execution").on(
      table.tenantId,
      table.stockItemId,
      table.vendorId,
      table.agentExecutionId,
    ),
  }),
);

/**
 * Risk spike events emitted when risk band is high/critical.
 */
export const supplyChainRiskEvents = mysqlTable(
  "supply_chain_risk_events",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull(),
    stockItemId: int("stock_item_id").notNull(),
    vendorId: int("vendor_id").notNull(),
    riskType: varchar("risk_type", { length: 64 }).notNull(),
    riskScore: decimal("risk_score", { precision: 6, scale: 4 }).notNull(),
    riskBand: mysqlEnum("risk_band", ["low", "moderate", "elevated", "high", "critical"]).notNull(),
    description: text("description"),
    agentExecutionId: varchar("agent_execution_id", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("idx_supply_chain_risk_events_tenant").on(table.tenantId),
    stockItemIdx: index("idx_supply_chain_risk_events_stock_item").on(table.stockItemId),
    vendorIdx: index("idx_supply_chain_risk_events_vendor").on(table.vendorId),
    createdAtIdx: index("idx_supply_chain_risk_events_created_at").on(table.createdAt),
    dedupeExecutionIdx: uniqueIndex("uq_supply_chain_risk_events_execution").on(
      table.tenantId,
      table.stockItemId,
      table.vendorId,
      table.riskType,
      table.agentExecutionId,
    ),
  }),
);

/**
 * Fleet units used for field operations dispatch.
 */
export const fleetUnits = mysqlTable(
  "fleet_units",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull(),
    unitName: varchar("unit_name", { length: 255 }).notNull(),
    vehicleType: varchar("vehicle_type", { length: 100 }).notNull(),
    capacity: int("capacity").notNull().default(1),
    currentLocation: varchar("current_location", { length: 255 }),
    status: mysqlEnum("status", ["available", "assigned", "maintenance", "offline"])
      .notNull()
      .default("available"),
    assignedTechnicianId: int("assigned_technician_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("idx_fleet_units_tenant").on(table.tenantId),
    statusIdx: index("idx_fleet_units_status").on(table.status),
    locationIdx: index("idx_fleet_units_current_location").on(table.currentLocation),
  }),
);

/**
 * Technician registry for dispatch optimization.
 */
export const technicians = mysqlTable(
  "technicians",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    skillProfile: varchar("skill_profile", { length: 100 }).notNull(),
    currentLocation: varchar("current_location", { length: 255 }),
    availabilityStatus: mysqlEnum("availability_status", ["available", "busy", "off_shift"])
      .notNull()
      .default("available"),
    shiftStart: varchar("shift_start", { length: 8 }),
    shiftEnd: varchar("shift_end", { length: 8 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("idx_technicians_tenant").on(table.tenantId),
    statusIdx: index("idx_technicians_availability_status").on(table.availabilityStatus),
    locationIdx: index("idx_technicians_current_location").on(table.currentLocation),
  }),
);

/**
 * Dispatch assignments generated by optimization worker.
 */
export const dispatchAssignments = mysqlTable(
  "dispatch_assignments",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull(),
    workOrderId: int("work_order_id").notNull(),
    technicianId: int("technician_id").notNull(),
    fleetUnitId: int("fleet_unit_id").notNull(),
    dispatchPriority: mysqlEnum("dispatch_priority", [
      "routine",
      "prioritized",
      "urgent",
      "critical",
    ]).notNull(),
    estimatedTravelTime: decimal("estimated_travel_time", { precision: 8, scale: 2 }).notNull(),
    routeDistance: decimal("route_distance", { precision: 8, scale: 2 }).notNull(),
    dispatchScore: decimal("dispatch_score", { precision: 6, scale: 4 }).notNull(),
    status: mysqlEnum("status", ["created", "completed", "delayed"]).notNull().default("created"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    agentExecutionId: varchar("agent_execution_id", { length: 100 }).notNull(),
  },
  (table) => ({
    tenantIdx: index("idx_dispatch_assignments_tenant").on(table.tenantId),
    workOrderIdx: index("idx_dispatch_assignments_work_order").on(table.workOrderId),
    technicianIdx: index("idx_dispatch_assignments_technician").on(table.technicianId),
    createdAtIdx: index("idx_dispatch_assignments_created_at").on(table.createdAt),
    dedupeExecutionIdx: uniqueIndex("uq_dispatch_assignments_execution").on(
      table.tenantId,
      table.workOrderId,
      table.technicianId,
      table.fleetUnitId,
      table.agentExecutionId,
    ),
  }),
);

/**
 * Executive operational metrics snapshots.
 */
export const executiveMetricsSnapshots = mysqlTable(
  "executive_metrics_snapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull(),
    snapshotDate: timestamp("snapshot_date").notNull(),
    assetHealthIndex: decimal("asset_health_index", { precision: 6, scale: 4 }).notNull(),
    maintenanceCostProjection: decimal("maintenance_cost_projection", { precision: 6, scale: 4 }).notNull(),
    inventoryPressureIndex: decimal("inventory_pressure_index", { precision: 6, scale: 4 }).notNull(),
    vendorRiskIndex: decimal("vendor_risk_index", { precision: 6, scale: 4 }).notNull(),
    supplyChainRiskIndex: decimal("supply_chain_risk_index", { precision: 6, scale: 4 }).notNull(),
    fleetUtilizationRate: decimal("fleet_utilization_rate", { precision: 6, scale: 4 }).notNull(),
    technicianProductivityScore: decimal("technician_productivity_score", { precision: 6, scale: 4 }).notNull(),
    overallOperationsIndex: decimal("overall_operations_index", { precision: 8, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    agentExecutionId: varchar("agent_execution_id", { length: 100 }).notNull(),
  },
  (table) => ({
    tenantIdx: index("idx_executive_metrics_snapshots_tenant").on(table.tenantId),
    snapshotDateIdx: index("idx_executive_metrics_snapshots_snapshot_date").on(table.snapshotDate),
    createdAtIdx: index("idx_executive_metrics_snapshots_created_at").on(table.createdAt),
    dedupeExecutionIdx: uniqueIndex("uq_executive_metrics_snapshots_execution").on(
      table.tenantId,
      table.snapshotDate,
      table.agentExecutionId,
    ),
  }),
);

/**
 * KPI trend records for executive layer.
 */
export const operationalKpiTrends = mysqlTable(
  "operational_kpi_trends",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull(),
    metricName: varchar("metric_name", { length: 100 }).notNull(),
    metricValue: decimal("metric_value", { precision: 8, scale: 4 }).notNull(),
    metricDate: timestamp("metric_date").notNull(),
    trendDirection: mysqlEnum("trend_direction", ["up", "down", "stable"]).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    agentExecutionId: varchar("agent_execution_id", { length: 100 }).notNull(),
  },
  (table) => ({
    tenantIdx: index("idx_operational_kpi_trends_tenant").on(table.tenantId),
    metricNameIdx: index("idx_operational_kpi_trends_metric_name").on(table.metricName),
    metricDateIdx: index("idx_operational_kpi_trends_metric_date").on(table.metricDate),
    createdAtIdx: index("idx_operational_kpi_trends_created_at").on(table.createdAt),
    dedupeExecutionIdx: uniqueIndex("uq_operational_kpi_trends_execution").on(
      table.tenantId,
      table.metricName,
      table.metricDate,
      table.agentExecutionId,
    ),
  }),
);

/**
 * Vendors
 */
export const vendors = mysqlTable("vendors", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  vendorCode: varchar("vendorCode", { length: 100 }).unique(),
  contactPerson: varchar("contactPerson", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }),
  website: varchar("website", { length: 255 }),
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),

  /** Canonical tenant (Phase 3). DB column: organization_id. */
  organizationId: uuid("organization_id"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  organizationIdIdx: index("idx_vendors_organization_id").on(table.organizationId),
}));

/**
 * Financial Transactions
 */
export const financialTransactions = mysqlTable("financialTransactions", {
  id: int("id").autoincrement().primaryKey(),
  transactionType: mysqlEnum("transactionType", ["acquisition", "maintenance", "repair", "disposal", "depreciation", "revenue", "other"]).notNull(),
  assetId: int("assetId"),
  workOrderId: int("workOrderId"),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("NGN").notNull(),
  description: text("description"),
  transactionDate: timestamp("transactionDate").notNull(),
  vendorId: int("vendorId"),
  receiptNumber: varchar("receiptNumber", { length: 100 }),
  approvedBy: int("approvedBy"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Compliance Records
 */
export const complianceRecords = mysqlTable("complianceRecords", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId"),
  title: varchar("title", { length: 255 }).notNull(),
  regulatoryBody: varchar("regulatoryBody", { length: 255 }),
  requirementType: varchar("requirementType", { length: 100 }),
  description: text("description"),
  status: mysqlEnum("status", ["compliant", "non_compliant", "pending", "expired"]).default("pending").notNull(),
  dueDate: timestamp("dueDate"),
  completionDate: timestamp("completionDate"),
  nextReviewDate: timestamp("nextReviewDate"),
  assignedTo: int("assignedTo"),
  documentUrl: text("documentUrl"),
  notes: text("notes"),

  /** Canonical tenant (Phase 3). DB column: organization_id. */
  organizationId: uuid("organization_id"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  organizationIdIdx: index("idx_complianceRecords_organization_id").on(table.organizationId),
}));

/**
 * Audit Trail for compliance and tracking
 */
export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 100 }),
  entityId: int("entityId"),
  changes: text("changes"),
  ipAddress: varchar("ipAddress", { length: 50 }),
  userAgent: text("userAgent"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

/**
 * Documents and Attachments
 */
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileType: varchar("fileType", { length: 100 }),
  fileSize: bigint("fileSize", { mode: "number" }),
  entityType: varchar("entityType", { length: 100 }),
  entityId: int("entityId"),
  organizationId: uuid("organization_id"),
  encryptionAlgorithm: text("encryption_algorithm"),
  encryptionKeyVersion: integer("encryption_key_version"),
  encryptionIv: text("encryption_iv"),
  encryptionAuthTag: text("encryption_auth_tag"),
  encryptedAt: pgTimestamp("encrypted_at", { withTimezone: true }),
  isEncrypted: boolean("is_encrypted").default(false).notNull(),
  uploadedBy: int("uploadedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  organizationIdIdx: index("idx_documents_organization_id").on(table.organizationId),
  orgEncryptedCreatedIdx: index("idx_documents_org_encrypted_created")
    .on(table.organizationId, table.isEncrypted),
  encryptionKeyVersionIdx: index("idx_documents_encryption_key_version").on(table.encryptionKeyVersion),
}));

export const organizationEncryptionKeys = mysqlTable(
  "organization_encryption_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    keyVersion: integer("key_version").notNull().default(1),
    encryptedKey: text("encrypted_key").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: pgTimestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    retiredAt: pgTimestamp("retired_at", { withTimezone: true }),
  },
  (table) => ({
    organizationIdIdx: index("idx_org_encryption_keys_organization_id").on(table.organizationId),
    orgStatusCreatedIdx: index("idx_org_encryption_keys_org_status_created")
      .on(table.organizationId, table.status, table.createdAt),
    organizationVersionUniqueIdx: uniqueIndex("uq_org_encryption_keys_org_version")
      .on(table.organizationId, table.keyVersion),
  }),
);

/**
 * Canonical organizations table (Supabase migration 20260309133000).
 * Table name must be "organizations" (snake_case) to match existing DB.
 */
export const organizations = mysqlTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: pgTimestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: pgTimestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    isActiveIdx: index("idx_organizations_is_active").on(table.isActive),
  }),
);

/**
 * Organization membership (Supabase migration 20260309133000).
 * Table name must be "organization_members" (snake_case) to match existing DB.
 * user_id maps to auth.users(id); no FK in migration (cross-schema).
 */
export const organizationMembers = mysqlTable(
  "organization_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: text("role").notNull().default("member"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: pgTimestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: pgTimestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("idx_organization_members_user_id").on(table.userId),
    orgUserIdx: index("idx_organization_members_org_user").on(table.organizationId, table.userId),
    orgUserUnique: uniqueIndex("organization_members_organization_id_user_id_key").on(
      table.organizationId,
      table.userId,
    ),
  }),
);

/**
 * Optional mapping: integer tenantId (legacy) → organization_id (uuid).
 * Use when backfilling or resolving org for tables that only have tenantId (int).
 * See docs/PHASE2_TENANT_IDENTIFIER_AND_MIGRATION_PLAN.md.
 */
export const tenantOrganizationMap = mysqlTable(
  "tenant_organization_map",
  {
    tenantId: integer("tenant_id").notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdAt: pgTimestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdPk: uniqueIndex("tenant_organization_map_tenant_id_key").on(table.tenantId),
    organizationIdIdx: index("idx_tenant_organization_map_organization_id").on(table.organizationId),
  }),
);

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Site = typeof sites.$inferSelect;
export type InsertSite = typeof sites.$inferInsert;
export type AssetCategory = typeof assetCategories.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type InsertAsset = typeof assets.$inferInsert;
export type WorkOrder = typeof workOrders.$inferSelect;
export type InsertWorkOrder = typeof workOrders.$inferInsert;
export type MaintenanceSchedule = typeof maintenanceSchedules.$inferSelect;
export type InsertMaintenanceSchedule = typeof maintenanceSchedules.$inferInsert;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = typeof inventoryItems.$inferInsert;
export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type WarehouseTransferRecommendation =
  typeof warehouseTransferRecommendations.$inferSelect;
export type InsertWarehouseTransferRecommendation =
  typeof warehouseTransferRecommendations.$inferInsert;
export type VendorPerformanceMetric = typeof vendorPerformanceMetrics.$inferSelect;
export type InsertVendorPerformanceMetric = typeof vendorPerformanceMetrics.$inferInsert;
export type VendorRiskScore = typeof vendorRiskScores.$inferSelect;
export type InsertVendorRiskScore = typeof vendorRiskScores.$inferInsert;
export type ProcurementRecommendation = typeof procurementRecommendations.$inferSelect;
export type InsertProcurementRecommendation = typeof procurementRecommendations.$inferInsert;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = typeof purchaseOrders.$inferInsert;
export type SupplyChainRiskScore = typeof supplyChainRiskScores.$inferSelect;
export type InsertSupplyChainRiskScore = typeof supplyChainRiskScores.$inferInsert;
export type SupplyChainRiskEvent = typeof supplyChainRiskEvents.$inferSelect;
export type InsertSupplyChainRiskEvent = typeof supplyChainRiskEvents.$inferInsert;
export type FleetUnit = typeof fleetUnits.$inferSelect;
export type InsertFleetUnit = typeof fleetUnits.$inferInsert;
export type Technician = typeof technicians.$inferSelect;
export type InsertTechnician = typeof technicians.$inferInsert;
export type DispatchAssignment = typeof dispatchAssignments.$inferSelect;
export type InsertDispatchAssignment = typeof dispatchAssignments.$inferInsert;
export type ExecutiveMetricsSnapshot = typeof executiveMetricsSnapshots.$inferSelect;
export type InsertExecutiveMetricsSnapshot = typeof executiveMetricsSnapshots.$inferInsert;
export type OperationalKpiTrend = typeof operationalKpiTrends.$inferSelect;
export type InsertOperationalKpiTrend = typeof operationalKpiTrends.$inferInsert;
export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = typeof vendors.$inferInsert;
export type FinancialTransaction = typeof financialTransactions.$inferSelect;
export type ComplianceRecord = typeof complianceRecords.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type OrganizationEncryptionKey = typeof organizationEncryptionKeys.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type InsertOrganizationMember = typeof organizationMembers.$inferInsert;
export type TenantOrganizationMapEntry = typeof tenantOrganizationMap.$inferSelect;
export type InsertTenantOrganizationMapEntry = typeof tenantOrganizationMap.$inferInsert;

/**
 * Notifications - In-app notification system
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", [
    "maintenance_due",
    "low_stock",
    "work_order_assigned",
    "work_order_completed",
    "asset_status_change",
    "compliance_due",
    "system_alert"
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  relatedEntityType: varchar("relatedEntityType", { length: 50 }), // asset, workOrder, inventory, etc.
  relatedEntityId: int("relatedEntityId"),
  isRead: boolean("isRead").default(false).notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Notification Preferences - User notification settings
 */
export const notificationPreferences = mysqlTable("notificationPreferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  maintenanceDue: boolean("maintenanceDue").default(true).notNull(),
  lowStock: boolean("lowStock").default(true).notNull(),
  workOrderAssigned: boolean("workOrderAssigned").default(true).notNull(),
  workOrderCompleted: boolean("workOrderCompleted").default(true).notNull(),
  assetStatusChange: boolean("assetStatusChange").default(true).notNull(),
  complianceDue: boolean("complianceDue").default(true).notNull(),
  systemAlert: boolean("systemAlert").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences = typeof notificationPreferences.$inferInsert;

/**
 * Asset Photos - Store photos for assets and work orders
 */
export const assetPhotos = mysqlTable("assetPhotos", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId"),
  workOrderId: int("workOrderId"),
  photoUrl: text("photoUrl").notNull(),
  photoKey: varchar("photoKey", { length: 500 }).notNull(),
  caption: text("caption"),
  uploadedBy: int("uploadedBy").notNull(),

  /** Canonical tenant (Phase 3). DB column: organization_id. */
  organizationId: uuid("organization_id"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  organizationIdIdx: index("idx_assetPhotos_organization_id").on(table.organizationId),
}));

/**
 * Scheduled Reports - Email report scheduling
 */
export const scheduledReports = mysqlTable("scheduledReports", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  reportType: mysqlEnum("reportType", [
    "assetInventory",
    "maintenanceSchedule",
    "workOrders",
    "financial",
    "compliance"
  ]).notNull(),
  format: mysqlEnum("format", ["pdf", "excel"]).notNull(),
  schedule: mysqlEnum("schedule", ["daily", "weekly", "monthly"]).notNull(),
  dayOfWeek: int("dayOfWeek"), // 0-6 for weekly
  dayOfMonth: int("dayOfMonth"), // 1-31 for monthly
  time: varchar("time", { length: 5 }).notNull(), // HH:MM format
  recipients: text("recipients").notNull(), // Comma-separated email addresses
  filters: text("filters"), // JSON string of filter options
  isActive: boolean("isActive").default(true).notNull(),
  lastRun: timestamp("lastRun"),
  nextRun: timestamp("nextRun"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AssetPhoto = typeof assetPhotos.$inferSelect;
export type InsertAssetPhoto = typeof assetPhotos.$inferInsert;
export type ScheduledReport = typeof scheduledReports.$inferSelect;
export type InsertScheduledReport = typeof scheduledReports.$inferInsert;


/**
 * Asset Transfer Requests
 */
export const assetTransfers = mysqlTable("assetTransfers", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId").notNull(),
  fromSiteId: int("fromSiteId").notNull(),
  toSiteId: int("toSiteId").notNull(),
  requestedBy: int("requestedBy").notNull(),
  approvedBy: int("approvedBy"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "in_transit", "completed", "cancelled"]).default("pending").notNull(),
  requestDate: timestamp("requestDate").defaultNow().notNull(),
  approvalDate: timestamp("approvalDate"),
  transferDate: timestamp("transferDate"),
  completionDate: timestamp("completionDate"),
  reason: text("reason"),
  notes: text("notes"),
  handoverChecklist: text("handoverChecklist"), // JSON string
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AssetTransfer = typeof assetTransfers.$inferSelect;
export type InsertAssetTransfer = typeof assetTransfers.$inferInsert;


/**
 * Work Order Templates - Reusable templates for common maintenance tasks
 */
export const workOrderTemplates = mysqlTable("workOrderTemplates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["corrective", "preventive", "inspection", "emergency"]).notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  estimatedDuration: int("estimatedDuration"), // in minutes
  checklistItems: text("checklistItems"), // JSON string of checklist items
  instructions: text("instructions"),
  categoryId: int("categoryId"), // Optional: link to asset category
  createdBy: int("createdBy").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkOrderTemplate = typeof workOrderTemplates.$inferSelect;
export type InsertWorkOrderTemplate = typeof workOrderTemplates.$inferInsert;


/**
 * QuickBooks Integration Configuration
 */
export const quickbooksConfig = mysqlTable("quickbooksConfig", {
  id: int("id").autoincrement().primaryKey(),
  clientId: varchar("clientId", { length: 255 }).notNull(),
  clientSecret: varchar("clientSecret", { length: 255 }).notNull(),
  redirectUri: varchar("redirectUri", { length: 500 }).notNull(),
  realmId: varchar("realmId", { length: 255 }).notNull(), // Company ID
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  isActive: int("isActive").default(1).notNull(), // 1 = active, 0 = inactive
  lastSyncAt: timestamp("lastSyncAt"),
  autoSync: int("autoSync").default(1).notNull(), // 1 = enabled, 0 = disabled
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QuickBooksConfig = typeof quickbooksConfig.$inferSelect;
export type InsertQuickBooksConfig = typeof quickbooksConfig.$inferInsert;

/**
 * User Preferences for UI state
 */
export const passwordResetTokens = mysqlTable("passwordResetTokens", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type SelectPasswordResetToken = typeof passwordResetTokens.$inferSelect;

export const userPreferences = mysqlTable("userPreferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  sidebarWidth: int("sidebarWidth").default(280),
  sidebarCollapsed: int("sidebarCollapsed").default(0), // 0 = expanded, 1 = collapsed
  dashboardWidgets: text("dashboardWidgets"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InsertUserPreferences = typeof userPreferences.$inferInsert;

/**
 * Email Notification History
 */
// Magic Link Authentication
export const authTokens = mysqlTable("auth_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  type: mysqlEnum("type", ["magic_link", "signup_verification"]).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AuthToken = typeof authTokens.$inferSelect;
export type InsertAuthToken = typeof authTokens.$inferInsert;

export const pendingUsers = mysqlTable("pending_users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  requestedRole: mysqlEnum("requested_role", ["user", "manager"]).notNull().default("user"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).notNull().default("pending"),
  approvedBy: int("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type PendingUser = typeof pendingUsers.$inferSelect;
export type InsertPendingUser = typeof pendingUsers.$inferInsert;

export const emailTemplates = mysqlTable("email_templates", {
  id: int("id").autoincrement().primaryKey(),
  templateType: varchar("template_type", { length: 50 }).notNull(), // 'magic_link', 'welcome', 'approval'
  subject: varchar("subject", { length: 255 }).notNull(),
  htmlContent: text("html_content").notNull(),
  textContent: text("text_content"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export const emailNotifications = mysqlTable("emailNotifications", {
  id: int("id").autoincrement().primaryKey(),
  subject: varchar("subject", { length: 255 }).notNull(),
  body: text("body").notNull(),
  recipientType: varchar("recipientType", { length: 50 }).notNull(), // 'all', 'individual', 'role'
  recipientIds: text("recipientIds"), // JSON array of user IDs if individual
  recipientRole: varchar("recipientRole", { length: 50 }), // 'admin', 'manager', 'user' if by role
  sentBy: int("sentBy").notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  status: varchar("status", { length: 50 }).default("sent").notNull(), // 'sent', 'failed'
  recipientCount: int("recipientCount").default(0),
});

export type EmailNotification = typeof emailNotifications.$inferSelect;
export type InsertEmailNotification = typeof emailNotifications.$inferInsert;

/**
 * Import History - Track bulk import operations
 */
export const importHistory = mysqlTable("importHistory", {
  id: int("id").autoincrement().primaryKey(),
  entityType: mysqlEnum("entityType", ["assets", "sites", "vendors"]).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileType: mysqlEnum("fileType", ["csv", "excel"]).notNull(),
  importedBy: int("importedBy").notNull().references(() => users.id),
  totalRows: int("totalRows").notNull(),
  successCount: int("successCount").notNull(),
  failedCount: int("failedCount").notNull(),
  errors: text("errors"), // JSON array of error objects
  status: mysqlEnum("status", ["success", "partial", "failed"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ImportHistory = typeof importHistory.$inferSelect;
export type InsertImportHistory = typeof importHistory.$inferInsert;

/**
 * Raw telemetry ingestion points
 */
export const telemetryPoints = mysqlTable(
  "telemetry_points",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull(),
    assetId: int("assetId").notNull(),
    timestamp: timestamp("timestamp").notNull(),
    metric: varchar("metric", { length: 64 }).notNull(),
    value: decimal("value", { precision: 15, scale: 4 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    tenantAssetMetricTsIdx: index("idx_telemetry_points_tenant_asset_metric_ts").on(
      table.tenantId,
      table.assetId,
      table.metric,
      table.timestamp
    ),
  })
);

/**
 * Hourly telemetry aggregates
 */
export const telemetryAggregates = mysqlTable(
  "telemetry_aggregates",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull(),
    assetId: int("assetId").notNull(),
    metric: varchar("metric", { length: 64 }).notNull(),
    hourBucket: timestamp("hour_bucket").notNull(),
    avgValue: decimal("avg_value", { precision: 15, scale: 4 }).notNull(),
    maxValue: decimal("max_value", { precision: 15, scale: 4 }).notNull(),
    minValue: decimal("min_value", { precision: 15, scale: 4 }).notNull(),
    count: int("count").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    uniqueBucketIdx: uniqueIndex("uq_telemetry_aggregates_bucket").on(
      table.tenantId,
      table.assetId,
      table.metric,
      table.hourBucket
    ),
    tenantMetricHourIdx: index("idx_telemetry_aggregates_tenant_metric_hour").on(
      table.tenantId,
      table.metric,
      table.hourBucket
    ),
  })
);

/**
 * Cached analytics report snapshots
 */
export const reportSnapshots = mysqlTable(
  "report_snapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull(),
    reportType: varchar("report_type", { length: 100 }).notNull(),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
    payloadJson: text("payload_json").notNull(),
  },
  table => ({
    tenantReportGeneratedIdx: index("idx_report_snapshots_tenant_type_generated").on(
      table.tenantId,
      table.reportType,
      table.generatedAt
    ),
  })
);

/**
 * Predictive risk scores per asset
 */
export const predictiveScores = mysqlTable(
  "predictive_scores",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull(),
    assetId: int("assetId").notNull(),
    riskScore: int("riskScore").notNull(),
    factorsJson: text("factors_json"),
    scoredAt: timestamp("scored_at").defaultNow().notNull(),
  },
  table => ({
    tenantAssetScoredIdx: index("idx_predictive_scores_tenant_asset_scored").on(
      table.tenantId,
      table.assetId,
      table.scoredAt
    ),
  })
);

/**
 * Inspection templates for recurring checks
 */
export const inspectionTemplates = mysqlTable(
  "inspection_templates",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    checklistJson: text("checklist_json").notNull(),
    frequency: varchar("frequency", { length: 50 }).default("monthly").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    tenantIdx: index("idx_inspection_templates_tenant").on(table.tenantId),
    tenantActiveIdx: index("idx_inspection_templates_tenant_active").on(table.tenantId, table.isActive),
    tenantCreatedIdx: index("idx_inspection_templates_tenant_created").on(table.tenantId, table.createdAt),
  })
);

/**
 * Inspections execution records
 */
/** Inspections — canonical tenant: organization_id (Phase 4). Legacy tenantId removed. */
export const inspections = mysqlTable(
  "inspections",
  {
    id: int("id").autoincrement().primaryKey(),
    assetId: int("assetId").notNull(),
    templateId: int("templateId"),
    inspectionType: varchar("inspection_type", { length: 100 }).notNull(),
    status: varchar("status", { length: 50 }).default("scheduled").notNull(),
    inspectorId: int("inspector_id"),
    scheduledAt: timestamp("scheduled_at"),
    completedAt: timestamp("completed_at"),
    result: varchar("result", { length: 50 }),
    notes: text("notes"),

    organizationId: uuid("organization_id").notNull(),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    organizationIdIdx: index("idx_inspections_organization_id").on(table.organizationId),
    orgAssetIdx: index("idx_inspections_org_asset").on(table.organizationId, table.assetId),
    orgStatusIdx: index("idx_inspections_org_status").on(table.organizationId, table.status),
  })
);

/**
 * Compliance rules per tenant
 */
export const complianceRules = mysqlTable(
  "compliance_rules",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull(),
    ruleName: varchar("rule_name", { length: 255 }).notNull(),
    assetCategory: varchar("asset_category", { length: 100 }),
    inspectionRequired: boolean("inspection_required").default(true).notNull(),
    maintenanceIntervalDays: int("maintenance_interval_days"),
    severity: varchar("severity", { length: 30 }).default("medium").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    tenantIdx: index("idx_compliance_rules_tenant").on(table.tenantId),
    tenantSeverityIdx: index("idx_compliance_rules_tenant_severity").on(table.tenantId, table.severity),
    tenantActiveIdx: index("idx_compliance_rules_tenant_active").on(table.tenantId, table.isActive),
    tenantCreatedIdx: index("idx_compliance_rules_tenant_created").on(table.tenantId, table.createdAt),
  })
);

/**
 * Compliance events emitted by rules/inspections
 */
export const complianceEvents = mysqlTable(
  "compliance_events",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull(),
    assetId: int("assetId"),
    ruleId: int("rule_id"),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    status: varchar("status", { length: 50 }).default("open").notNull(),
    detectedAt: timestamp("detected_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
    detailsJson: text("details_json"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    tenantIdx: index("idx_compliance_events_tenant").on(table.tenantId),
    tenantAssetIdx: index("idx_compliance_events_tenant_asset").on(table.tenantId, table.assetId),
    tenantStatusIdx: index("idx_compliance_events_tenant_status").on(table.tenantId, table.status),
    tenantDetectedIdx: index("idx_compliance_events_tenant_detected").on(table.tenantId, table.detectedAt),
    tenantCreatedIdx: index("idx_compliance_events_tenant_created").on(table.tenantId, table.createdAt),
  })
);

/**
 * SLA metrics snapshots
 */
export const slaMetrics = mysqlTable(
  "sla_metrics",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull(),
    assetId: int("assetId"),
    metricType: varchar("metric_type", { length: 100 }).notNull(),
    targetValue: decimal("target_value", { precision: 12, scale: 2 }),
    actualValue: decimal("actual_value", { precision: 12, scale: 2 }),
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    tenantIdx: index("idx_sla_metrics_tenant").on(table.tenantId),
    tenantAssetIdx: index("idx_sla_metrics_tenant_asset").on(table.tenantId, table.assetId),
    tenantMetricIdx: index("idx_sla_metrics_tenant_metric").on(table.tenantId, table.metricType),
    tenantPeriodStartIdx: index("idx_sla_metrics_tenant_period_start").on(table.tenantId, table.periodStart),
    tenantCreatedIdx: index("idx_sla_metrics_tenant_created").on(table.tenantId, table.createdAt),
  })
);

/**
 * Tenant-scoped audit logs (Phase 3)
 */
export const auditLogsV1 = mysqlTable(
  "audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull(),
    userId: int("userId"),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: int("entity_id"),
    metadataJson: text("metadata_json"),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    tenantIdx: index("idx_audit_logs_tenant").on(table.tenantId),
    tenantEntityIdx: index("idx_audit_logs_tenant_entity").on(table.tenantId, table.entityType, table.entityId),
    tenantTimestampIdx: index("idx_audit_logs_tenant_timestamp").on(table.tenantId, table.timestamp),
    tenantCreatedIdx: index("idx_audit_logs_tenant_created").on(table.tenantId, table.createdAt),
  })
);

export type TelemetryPoint = typeof telemetryPoints.$inferSelect;
export type InsertTelemetryPoint = typeof telemetryPoints.$inferInsert;
export type TelemetryAggregate = typeof telemetryAggregates.$inferSelect;
export type InsertTelemetryAggregate = typeof telemetryAggregates.$inferInsert;
export type ReportSnapshot = typeof reportSnapshots.$inferSelect;
export type InsertReportSnapshot = typeof reportSnapshots.$inferInsert;
export type PredictiveScore = typeof predictiveScores.$inferSelect;
export type InsertPredictiveScore = typeof predictiveScores.$inferInsert;
export type InspectionTemplate = typeof inspectionTemplates.$inferSelect;
export type InsertInspectionTemplate = typeof inspectionTemplates.$inferInsert;
export type Inspection = typeof inspections.$inferSelect;
export type InsertInspection = typeof inspections.$inferInsert;
export type ComplianceRule = typeof complianceRules.$inferSelect;
export type InsertComplianceRule = typeof complianceRules.$inferInsert;
export type ComplianceEvent = typeof complianceEvents.$inferSelect;
export type InsertComplianceEvent = typeof complianceEvents.$inferInsert;
export type SlaMetric = typeof slaMetrics.$inferSelect;
export type InsertSlaMetric = typeof slaMetrics.$inferInsert;
export type AuditLogV1 = typeof auditLogsV1.$inferSelect;
export type InsertAuditLogV1 = typeof auditLogsV1.$inferInsert;

/**
 * Background Job Runs - Queue tracking and observability
 */
export const backgroundJobRuns = mysqlTable(
  "backgroundJobRuns",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull().default(1),
    jobName: varchar("jobName", { length: 100 }).notNull(),
    queueJobId: varchar("queueJobId", { length: 100 }),
    status: mysqlEnum("status", ["queued", "running", "completed", "failed", "dead"]).notNull().default("queued"),
    attempts: int("attempts").notNull().default(0),
    maxAttempts: int("maxAttempts").notNull().default(5),
    requestedBy: int("requestedBy"),
    payload: text("payload"),
    result: text("result"),
    error: text("error"),
    queuedAt: timestamp("queuedAt").defaultNow().notNull(),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    durationMs: int("durationMs"),
  },
  table => ({
    tenantIdx: index("idx_background_job_runs_tenant").on(table.tenantId),
    statusIdx: index("idx_background_job_runs_status").on(table.status),
    jobNameIdx: index("idx_background_job_runs_job_name").on(table.jobName),
  })
);

export type BackgroundJobRun = typeof backgroundJobRuns.$inferSelect;
export type InsertBackgroundJobRun = typeof backgroundJobRuns.$inferInsert;

/**
 * Deterministic vector memory store for intelligence layer
 */
export const ruvectorMemories = mysqlTable(
  "ruvector_memories",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull(),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: int("entity_id"),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    vectorJson: text("vector_json").notNull(),
    metadataJson: text("metadata_json"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    tenantIdx: index("idx_ruvector_memories_tenant").on(table.tenantId),
    tenantEventIdx: index("idx_ruvector_memories_tenant_event").on(table.tenantId, table.eventType),
    tenantEntityIdx: index("idx_ruvector_memories_tenant_entity").on(table.tenantId, table.entityType, table.entityId),
    tenantCreatedIdx: index("idx_ruvector_memories_tenant_created").on(table.tenantId, table.createdAt),
  })
);

/**
 * Prime Radiance deterministic agent execution traces
 */
export const primeAgentExecutions = mysqlTable(
  "prime_agent_executions",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenantId").notNull(),
    agentType: varchar("agent_type", { length: 100 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("completed"),
    inputPayload: text("input_payload").notNull(),
    outputPayload: text("output_payload"),
    reasonTrace: text("reason_trace"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    tenantIdx: index("idx_prime_agent_executions_tenant").on(table.tenantId),
    tenantAgentIdx: index("idx_prime_agent_executions_tenant_agent").on(table.tenantId, table.agentType),
    tenantStatusIdx: index("idx_prime_agent_executions_tenant_status").on(table.tenantId, table.status),
    tenantCreatedIdx: index("idx_prime_agent_executions_tenant_created").on(table.tenantId, table.createdAt),
  })
);

export type RuVectorMemory = typeof ruvectorMemories.$inferSelect;
export type InsertRuVectorMemory = typeof ruvectorMemories.$inferInsert;
export type PrimeAgentExecution = typeof primeAgentExecutions.$inferSelect;
export type InsertPrimeAgentExecution = typeof primeAgentExecutions.$inferInsert;

/**
 * Stock demand forecast records produced by deterministic agents
 */
export const stockForecasts = mysqlTable(
  "stock_forecasts",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull(),
    stockItemId: int("stock_item_id").notNull(),
    demandScore: decimal("demand_score", { precision: 6, scale: 4 }).notNull(),
    recommendedAction: varchar("recommended_action", { length: 50 }).notNull(),
    forecastTimestamp: timestamp("forecast_timestamp").defaultNow().notNull(),
    agentExecutionId: int("agent_execution_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  table => ({
    tenantIdx: index("idx_stock_forecasts_tenant").on(table.tenantId),
    tenantStockItemIdx: index("idx_stock_forecasts_tenant_stock_item").on(table.tenantId, table.stockItemId),
    tenantForecastTsIdx: index("idx_stock_forecasts_tenant_forecast_ts").on(table.tenantId, table.forecastTimestamp),
  })
);

export type StockForecast = typeof stockForecasts.$inferSelect;
export type InsertStockForecast = typeof stockForecasts.$inferInsert;
