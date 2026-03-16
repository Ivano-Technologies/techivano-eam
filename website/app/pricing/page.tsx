import type { Metadata } from "next";
import { PricingTable } from "@/components/PricingTable";
import { CTASection } from "@/components/CTASection";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Techivano EAM pricing: core platform, intelligence modules, and pilot engagement model. Transparent pricing for government and infrastructure.",
};

const tiers = [
  {
    name: "Core platform",
    description: "Asset lifecycle, work orders, inspections, inventory, operational analytics.",
    price: "₦40,000 – ₦96,000",
    period: "per user/month",
    features: [
      "Asset registry and hierarchy",
      "Work order management",
      "Inspection workflows",
      "Inventory and spare parts",
      "Operational dashboards",
      "Multi-tenant, role-based access",
    ],
    ctaLabel: "Request Pilot",
    ctaHref: "/pilot#request",
    highlighted: true,
  },
  {
    name: "Predictive maintenance",
    description: "Failure prediction, maintenance optimization, asset health forecasting.",
    price: "₦16,000 – ₦48,000",
    period: "per asset/month",
    features: [
      "Predictive maintenance engine",
      "Failure probability and RUL",
      "Recommended maintenance windows",
      "Asset risk scoring",
    ],
    ctaLabel: "Request Pilot",
    ctaHref: "/pilot#request",
  },
  {
    name: "Inventory intelligence",
    description: "Demand forecasting, stock optimization, shortage alerts.",
    price: "₦8,000 – ₦24,000",
    period: "per asset/month",
    features: [
      "Spare parts demand forecasting",
      "Stock optimization",
      "Reorder and shortage alerts",
      "Procurement recommendations",
    ],
    ctaLabel: "Request Pilot",
    ctaHref: "/pilot#request",
  },
  {
    name: "Fleet intelligence",
    description: "Technician routing, vehicle tracking, productivity analytics.",
    price: "₦16,000 – ₦40,000",
    period: "per technician/month",
    features: [
      "Technician routing and dispatch",
      "Vehicle and resource tracking",
      "Productivity analytics",
      "Utilization reporting",
    ],
    ctaLabel: "Request Pilot",
    ctaHref: "/pilot#request",
  },
  {
    name: "Executive dashboard",
    description: "Strategic dashboards for leadership and planning.",
    price: "₦4.8M – ₦32M",
    period: "annually",
    features: [
      "Asset health index",
      "Infrastructure risk score",
      "Maintenance backlog metrics",
      "Spending and reliability trends",
    ],
    ctaLabel: "Request Pilot",
    ctaHref: "/pilot#request",
  },
  {
    name: "Pilot engagement",
    description: "Structured pilot with assessment, configuration, and evaluation.",
    price: "₦50M – ₦200M",
    period: "pilot phase",
    features: [
      "Discovery and setup (4–6 weeks)",
      "Asset migration and config (6–8 weeks)",
      "Pilot operations (3–4 months)",
      "Evaluation and scale plan",
    ],
    ctaLabel: "Request Pilot",
    ctaHref: "/pilot#request",
    highlighted: true,
  },
];

export default function PricingPage() {
  return (
    <>
      <section className="py-16 md:py-24 border-b border-border">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-primary">
            Pricing
          </h1>
          <p className="mt-6 text-lg text-muted max-w-2xl mx-auto">
            Core platform and intelligence module pricing. Pilot engagement
            model for government and infrastructure deployments.
          </p>
        </div>
      </section>

      <PricingTable tiers={tiers} />

      <section className="py-16 md:py-24 bg-slate-50 dark:bg-slate-900/50">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-primary text-center mb-12">
            Contract structure
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="rounded-card border border-border bg-background p-6 text-center">
              <div className="text-lg font-semibold text-primary">Pilot phase</div>
              <div className="mt-2 text-2xl font-bold text-accent">₦50M – ₦200M</div>
              <p className="mt-2 text-sm text-muted">Structured pilot with clear success criteria</p>
            </div>
            <div className="rounded-card border border-border bg-background p-6 text-center">
              <div className="text-lg font-semibold text-primary">Operational rollout</div>
              <div className="mt-2 text-2xl font-bold text-accent">₦200M – ₦500M</div>
              <p className="mt-2 text-sm text-muted">Agency or state-wide deployment</p>
            </div>
            <div className="rounded-card border border-border bg-background p-6 text-center">
              <div className="text-lg font-semibold text-primary">Full platform</div>
              <div className="mt-2 text-2xl font-bold text-accent">₦750M – ₦2B</div>
              <p className="mt-2 text-sm text-muted">National or multi-agency deployment</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 border-b border-border">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <h2 className="text-2xl font-bold text-primary mb-6">ROI examples</h2>
          <ul className="space-y-4 text-muted">
            <li className="flex gap-2">
              <span className="text-accent font-medium">•</span>
              <span><strong className="text-foreground">Predictive maintenance:</strong> Reduce unplanned downtime and extend asset life; typical savings on reactive repair and replacement.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent font-medium">•</span>
              <span><strong className="text-foreground">Inventory optimization:</strong> Lower carrying costs and shortage-related delays through demand forecasting and reorder logic.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent font-medium">•</span>
              <span><strong className="text-foreground">Operational efficiency:</strong> Clear backlog, faster inspections, and better visibility reduce admin overhead and improve decision speed.</span>
            </li>
          </ul>
        </div>
      </section>

      <CTASection
        title="Request a custom proposal"
        description="Share your scale and requirements. We'll provide a tailored proposal and pilot plan."
        primaryHref="/pilot#request"
      />
    </>
  );
}
