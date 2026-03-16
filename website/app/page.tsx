import { Hero } from "@/components/Hero";
import { FeatureGrid } from "@/components/FeatureGrid";
import { StatsSection } from "@/components/StatsSection";
import { GovernmentUseCases } from "@/components/GovernmentUseCases";
import { CTASection } from "@/components/CTASection";
import {
  LayoutGrid,
  Wrench,
  ClipboardCheck,
  BarChart3,
  Shield,
  Zap,
} from "lucide-react";
import { site } from "@/content/site";

const platformOverview = [
  {
    title: "Asset lifecycle",
    description:
      "From registry and hierarchy to health scoring and retirement. Full lifecycle tracking with QR/RFID tagging and digital twin readiness.",
    icon: LayoutGrid,
  },
  {
    title: "Maintenance intelligence",
    description:
      "Preventive schedules, condition-based triggers, work order management, and predictive maintenance to reduce backlog and extend asset life.",
    icon: Wrench,
  },
  {
    title: "Infrastructure analytics",
    description:
      "Operational dashboards, executive intelligence, and infrastructure risk scoring for data-driven planning and budget efficiency.",
    icon: BarChart3,
  },
];

const coreCapabilities = [
  {
    title: "Asset management",
    description:
      "Asset registry, hierarchy, tagging, lifecycle tracking, and health scoring for infrastructure at scale.",
    icon: LayoutGrid,
  },
  {
    title: "Inspection workflows",
    description:
      "Checklists, mobile inspection workflows, evidence capture, and compliance reporting.",
    icon: ClipboardCheck,
  },
  {
    title: "Predictive maintenance",
    description:
      "Failure prediction, maintenance optimization, and asset health forecasting powered by the intelligence layer.",
    icon: Zap,
  },
  {
    title: "Inventory intelligence",
    description:
      "Spare parts catalog, demand forecasting, stock optimization, and vendor management.",
    icon: BarChart3,
  },
];

const operationalBenefits = [
  {
    title: "Improved asset visibility",
    description: "Single source of truth for infrastructure assets across agencies and sites.",
    icon: Shield,
  },
  {
    title: "Reduced maintenance backlog",
    description: "Prioritized work orders and predictive scheduling to clear backlogs and prevent failures.",
    icon: Wrench,
  },
  {
    title: "Faster inspections",
    description: "Mobile-first inspection workflows with automated compliance and evidence capture.",
    icon: ClipboardCheck,
  },
  {
    title: "Optimized spare parts",
    description: "Inventory intelligence reduces overstock and shortages while improving procurement.",
    icon: BarChart3,
  },
];

const stats = [
  { value: "5M+", label: "Assets supported" },
  { value: "50M+", label: "Inspections scalable" },
  { value: "10M+", label: "Work orders" },
  { value: "<2s", label: "Dashboard load" },
  { value: "<200ms", label: "API response" },
  { value: "Gov-grade", label: "Security" },
];

export default function HomePage() {
  return (
    <>
      <Hero
        headline="Operational Intelligence for National Infrastructure"
        subheadline="Government-grade platform for asset management, predictive maintenance, and operations intelligence. Built for federal agencies, state governments, and regulators."
        primaryCta={{ label: "Request Pilot", href: "/pilot#request" }}
        secondaryCta={{ label: "View Platform", href: "/platform" }}
        size="large"
      />

      <section className="py-16 md:py-24 border-t border-border bg-slate-50 dark:bg-slate-900/50">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <p className="text-muted font-medium">
            Trusted for government and infrastructure operations
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-8 text-sm text-muted">
            <span>Federal Agencies</span>
            <span>State Governments</span>
            <span>Regulators</span>
          </div>
        </div>
      </section>

      <FeatureGrid
        title="Platform overview"
        subtitle="Unify asset data, maintenance, and analytics in one infrastructure operations platform."
        features={platformOverview}
        columns={3}
      />

      <FeatureGrid
        title="Core capabilities"
        subtitle="Everything you need to digitize infrastructure operations and scale with confidence."
        features={coreCapabilities}
        columns={2}
      />

      <GovernmentUseCases />

      <FeatureGrid
        title="Operational benefits"
        subtitle="Deliver visibility, efficiency, and risk reduction across your infrastructure portfolio."
        features={operationalBenefits}
        columns={2}
      />

      <StatsSection
        title="Built for scale"
        stats={stats}
      />

      <CTASection
        title="Ready to deploy a pilot?"
        description="Start with a structured pilot engagement. We'll assess your infrastructure, configure the platform, and run a time-boxed pilot with clear success criteria."
        primaryLabel="Request Pilot Deployment"
        primaryHref="/pilot#request"
        secondaryLabel="View Pilot Program"
        secondaryHref="/pilot"
      />
    </>
  );
}
