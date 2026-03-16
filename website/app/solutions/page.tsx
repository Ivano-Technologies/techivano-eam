import type { Metadata } from "next";
import { FeatureGrid } from "@/components/FeatureGrid";
import { CTASection } from "@/components/CTASection";

export const metadata: Metadata = {
  title: "Solutions",
  description:
    "Techivano solutions for federal infrastructure agencies, state governments, and infrastructure regulators. Typical deployment scenarios and use cases.",
};

const federalAgencies = {
  title: "Federal infrastructure agencies",
  description:
    "Ministry of Works, Nigerian Railway Corporation, Nigerian Ports Authority, NNPC, FAAN. Centralize national infrastructure asset data, maintenance workflows, and compliance reporting across agencies with multi-tenant, role-based access.",
  scenarios: [
    "National asset registry and hierarchy (roads, rail, ports, aviation, energy)",
    "Cross-agency maintenance and inspection standards",
    "Executive dashboards for infrastructure risk and spending",
    "Secure, government-grade deployment with SSO and audit trails",
  ],
};

const stateGovernments = {
  title: "State governments",
  description:
    "Lagos, Rivers, Kaduna, Ogun, FCT Abuja. Deploy multi-tenant EAM with state-level dashboards, department and facility hierarchies, and predictive maintenance for roads, buildings, water, and utilities.",
  scenarios: [
    "State-wide asset and site hierarchy (departments, facilities, assets)",
    "Preventive and predictive maintenance for critical infrastructure",
    "Inspection and compliance workflows for regulators",
    "Inventory and vendor management across sites",
  ],
};

const regulators = {
  title: "Infrastructure regulators",
  description:
    "SON, NAFDAC, NIMASA. Monitor regulated infrastructure, run inspection workflows, and maintain audit trails for compliance and safety oversight across the value chain.",
  scenarios: [
    "Inspection checklists and evidence capture for compliance",
    "Audit trails and reporting for regulated entities",
    "Risk and condition scoring for oversight",
    "Integration with agency asset data where permitted",
  ],
};

export default function SolutionsPage() {
  return (
    <>
      <section className="py-16 md:py-24 border-b border-border">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-primary">
            Solutions for government infrastructure
          </h1>
          <p className="mt-6 text-lg text-muted max-w-2xl mx-auto">
            Tailored deployments for federal agencies, state governments, and
            regulators. Multi-tenant, secure, and built for scale.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24 border-b border-border">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-bold text-primary">
              {federalAgencies.title}
            </h2>
            <p className="mt-4 text-muted">{federalAgencies.description}</p>
            <h3 className="mt-8 text-lg font-semibold text-primary">
              Typical deployment scenarios
            </h3>
            <ul className="mt-4 space-y-2 text-muted">
              {federalAgencies.scenarios.map((s) => (
                <li key={s} className="flex gap-2">
                  <span className="text-accent">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 border-b border-border bg-slate-50 dark:bg-slate-900/50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-bold text-primary">
              {stateGovernments.title}
            </h2>
            <p className="mt-4 text-muted">{stateGovernments.description}</p>
            <h3 className="mt-8 text-lg font-semibold text-primary">
              Typical deployment scenarios
            </h3>
            <ul className="mt-4 space-y-2 text-muted">
              {stateGovernments.scenarios.map((s) => (
                <li key={s} className="flex gap-2">
                  <span className="text-accent">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 border-b border-border">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-bold text-primary">
              {regulators.title}
            </h2>
            <p className="mt-4 text-muted">{regulators.description}</p>
            <h3 className="mt-8 text-lg font-semibold text-primary">
              Typical deployment scenarios
            </h3>
            <ul className="mt-4 space-y-2 text-muted">
              {regulators.scenarios.map((s) => (
                <li key={s} className="flex gap-2">
                  <span className="text-accent">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <CTASection
        title="Discuss your deployment"
        description="Tell us about your agency, state, or regulatory use case. We'll outline a pilot and deployment path."
        primaryHref="/pilot#request"
      />
    </>
  );
}
