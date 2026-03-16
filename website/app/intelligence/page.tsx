import type { Metadata } from "next";
import { FeatureGrid } from "@/components/FeatureGrid";
import { ProductModule } from "@/components/ProductModule";
import { CTASection } from "@/components/CTASection";
import {
  Zap,
  Package,
  Truck,
  Gauge,
  LayoutDashboard,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Infrastructure Intelligence",
  description:
    "Advanced intelligence modules: predictive maintenance, inventory intelligence, vendor intelligence, fleet optimization, and executive dashboard for government infrastructure.",
};

const predictiveMaintenance = [
  "Failure probability and recommended maintenance windows",
  "Asset risk score and remaining useful life",
  "Analysis of maintenance history, inspection scores, and usage data",
];

const inventoryIntelligence = [
  "Spare parts demand forecasting",
  "Stock optimization and reorder points",
  "Shortage alerts and procurement recommendations",
];

const vendorIntelligence = [
  "Vendor performance tracking",
  "Delivery and quality metrics",
  "Supplier risk and consolidation insights",
];

const fleetOptimization = [
  "Technician routing and dispatch",
  "Vehicle and resource tracking",
  "Productivity and utilization analytics",
];

const executiveDashboard = [
  "Asset health index and infrastructure risk score",
  "Maintenance backlog and spending trends",
  "National or regional infrastructure reliability metrics",
];

const modules = [
  {
    title: "Predictive maintenance",
    description:
      "Analyze maintenance history, inspection scores, environmental and usage data to predict failures, recommend maintenance windows, and surface asset risk and remaining useful life.",
    icon: Zap,
  },
  {
    title: "Inventory intelligence",
    description:
      "Demand forecasting, stock optimization, and shortage alerts so you maintain the right spare parts without overstocking or critical gaps.",
    icon: Package,
  },
  {
    title: "Vendor intelligence",
    description:
      "Track vendor performance, delivery and quality metrics, and use data to optimize supplier relationships and reduce risk.",
    icon: Truck,
  },
  {
    title: "Fleet optimization",
    description:
      "Optimize technician routing and dispatch, track vehicles and resources, and measure productivity for field operations.",
    icon: Gauge,
  },
  {
    title: "Executive intelligence dashboard",
    description:
      "Strategic dashboards with asset health index, maintenance backlog, infrastructure risk score, and spending trends for leadership and planning.",
    icon: LayoutDashboard,
  },
];

export default function IntelligencePage() {
  return (
    <>
      <section className="py-16 md:py-24 border-b border-border">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-primary">
            Infrastructure intelligence
          </h1>
          <p className="mt-6 text-lg text-muted max-w-2xl mx-auto">
            Advanced modules that turn operational data into predictive
            maintenance, inventory optimization, vendor and fleet intelligence,
            and executive-level analytics.
          </p>
        </div>
      </section>

      <ProductModule
        title="Predictive maintenance engine"
        description="The predictive system analyzes maintenance history, inspection scores, environmental data, and usage to output failure probability, recommended maintenance windows, asset risk score, and remaining useful life."
        icon={Zap}
        features={predictiveMaintenance}
      />

      <ProductModule
        title="Inventory intelligence"
        description="Forecast spare parts demand, optimize stock levels, and trigger shortage alerts so procurement and maintenance stay aligned."
        icon={Package}
        features={inventoryIntelligence}
        reverse
      />

      <ProductModule
        title="Vendor intelligence"
        description="Track vendor performance and delivery metrics. Use intelligence to consolidate suppliers and reduce supply chain risk."
        icon={Truck}
        features={vendorIntelligence}
      />

      <ProductModule
        title="Fleet optimization"
        description="Optimize technician routing and dispatch, track vehicles and assets in the field, and analyze productivity for fleet and field operations."
        icon={Gauge}
        features={fleetOptimization}
        reverse
      />

      <ProductModule
        title="Executive intelligence dashboard"
        description="Strategic views: asset health index, maintenance backlog metrics, infrastructure risk score, and operational KPIs for leadership and national or regional planning."
        icon={LayoutDashboard}
        features={executiveDashboard}
      />

      <section className="py-16 md:py-24 bg-slate-50 dark:bg-slate-900/50">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-primary text-center mb-12">
            Architecture
          </h2>
          <div className="max-w-3xl mx-auto rounded-card border border-border bg-background p-6 font-mono text-sm text-muted">
            <pre className="overflow-x-auto whitespace-pre">
{`Intelligence Layer
├── Predictive Maintenance Engine
├── Inventory Optimization Engine
├── Fleet Optimization Engine
├── Vendor Intelligence
└── Executive Dashboard

    ↑ Events (AssetCreated, InspectionCompleted, MaintenanceScheduled, etc.)
    ↑

Application Services
├── Asset Service
├── Maintenance Service
├── Inspection Service
├── Inventory Service
└── Vendor Service

Data Layer: PostgreSQL · Analytics Warehouse · Event Store`}
            </pre>
          </div>
        </div>
      </section>

      <CTASection
        title="Add intelligence to your operations"
        description="Pilot the platform with predictive maintenance and executive dashboards tailored to your infrastructure."
        primaryHref="/pilot#request"
      />
    </>
  );
}
