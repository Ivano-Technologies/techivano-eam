import type { Metadata } from "next";
import { FeatureGrid } from "@/components/FeatureGrid";
import { ProductModule } from "@/components/ProductModule";
import { CTASection } from "@/components/CTASection";
import {
  LayoutGrid,
  Wrench,
  ClipboardCheck,
  Package,
  BarChart3,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Platform",
  description:
    "Techivano EAM platform: asset lifecycle management, maintenance operations, inspection workflows, inventory management, and operational analytics for government infrastructure.",
};

const assetLifecycle = [
  "Asset registry and hierarchy",
  "Asset tagging (QR/RFID)",
  "Lifecycle tracking",
  "Health scoring",
  "Digital twin readiness",
];

const maintenanceOps = [
  "Maintenance work orders",
  "Technician scheduling and task assignments",
  "Approval flows",
  "Preventive and condition-based schedules",
  "Maintenance history",
];

const inspectionWorkflows = [
  "Inspection checklists",
  "Mobile inspection workflows",
  "Evidence and photo capture",
  "Compliance reporting",
];

const inventoryManagement = [
  "Spare parts catalog",
  "Inventory tracking",
  "Procurement workflows",
  "Vendor management",
];

const operationalAnalytics = [
  "Real-time operational dashboards",
  "Maintenance backlog and completion rates",
  "Asset uptime and health distribution",
  "Budget and efficiency metrics",
];

export default function PlatformPage() {
  return (
    <>
      <section className="py-16 md:py-24 border-b border-border">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-primary">
            Infrastructure operations platform
          </h1>
          <p className="mt-6 text-lg text-muted max-w-2xl mx-auto">
            Core EAM modules for asset lifecycle, maintenance, inspections,
            inventory, and analytics—designed for government and infrastructure
            at scale.
          </p>
        </div>
      </section>

      <ProductModule
        title="Asset lifecycle management"
        description="Centralize infrastructure assets in a single registry with hierarchy, tagging, and full lifecycle tracking. Support QR/RFID, health scoring, and prepare for digital twin integration."
        icon={LayoutGrid}
        features={assetLifecycle}
      />

      <ProductModule
        title="Maintenance operations"
        description="Manage work orders, technician scheduling, and approval flows. Combine preventive schedules with condition-based triggers and a complete maintenance history."
        icon={Wrench}
        features={maintenanceOps}
        reverse
      />

      <ProductModule
        title="Inspection workflows"
        description="Run standardized inspection checklists on mobile devices, capture evidence and photos, and generate compliance reports for regulators and auditors."
        icon={ClipboardCheck}
        features={inspectionWorkflows}
      />

      <ProductModule
        title="Inventory management"
        description="Maintain spare parts catalogs, track stock levels, and manage procurement and vendor relationships to reduce downtime and optimize spend."
        icon={Package}
        features={inventoryManagement}
        reverse
      />

      <ProductModule
        title="Operational analytics"
        description="Real-time dashboards for maintenance backlog, inspection completion, asset uptime, and operational KPIs so teams and leaders act on live data."
        icon={BarChart3}
        features={operationalAnalytics}
      />

      <CTASection
        title="See the platform in action"
        description="Request a pilot deployment to evaluate the platform against your infrastructure and workflows."
        primaryHref="/pilot#request"
      />
    </>
  );
}
