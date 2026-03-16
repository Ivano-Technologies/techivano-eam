import type { Metadata } from "next";
import { CTASection } from "@/components/CTASection";

export const metadata: Metadata = {
  title: "About Techivano",
  description:
    "Techivano mission, vision, infrastructure modernization strategy, and GovTech positioning. Building the infrastructure operations intelligence platform for government.",
};

export default function AboutPage() {
  return (
    <>
      <section className="py-16 md:py-24 border-b border-border">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-primary">
            About Techivano
          </h1>
          <p className="mt-6 text-lg text-muted max-w-2xl mx-auto">
            We're building the infrastructure operations intelligence platform
            for government—digitizing asset management, maintenance, and
            analytics at scale.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24 border-b border-border">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-bold text-primary">
            Mission
          </h2>
          <p className="mt-4 text-muted">
            To become the national infrastructure operations intelligence
            platform—enabling governments and infrastructure operators to
            centralize asset data, optimize maintenance, and improve
            infrastructure reliability through predictive analytics and
            operational intelligence.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24 border-b border-border bg-slate-50 dark:bg-slate-900/50">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-bold text-primary">
            Vision
          </h2>
          <p className="mt-4 text-muted">
            Techivano integrates asset lifecycle management, predictive
            maintenance, supply chain intelligence, and infrastructure
            analytics into one platform. We evolve from enterprise asset
            management (Phase 1) to a full infrastructure intelligence
            platform (Phase 2) and ultimately a national infrastructure
            operations platform (Phase 3)—supporting roads, rail, airports,
            ports, and power infrastructure with a single operational view.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24 border-b border-border">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-bold text-primary">
            Infrastructure modernization strategy
          </h2>
          <p className="mt-4 text-muted">
            Governments and agencies face limited visibility into assets,
            maintenance backlogs, spare parts mismanagement, and inefficient
            inspection and vendor tracking. Techivano addresses these with a
            multi-tenant, government-grade platform that supports large
            asset datasets, predictive analytics, and secure deployment—so
            infrastructure modernization is data-driven and scalable.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24 border-b border-border bg-slate-50 dark:bg-slate-900/50">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-bold text-primary">
            GovTech positioning
          </h2>
          <p className="mt-4 text-muted">
            Techivano is positioned as a government-grade infrastructure
            technology platform. We serve federal agencies (Ministry of Works,
            Railway Corporation, Ports Authority, NNPC, FAAN), state
            governments (Lagos, Rivers, Kaduna, Ogun, FCT Abuja), and
            regulators (SON, NAFDAC, NIMASA) with a deployment model and
            security posture built for public sector requirements. Our goal
            is to generate government pilot deployments and enterprise
            inquiries—and to support the long-term digitization of national
            infrastructure operations.
          </p>
        </div>
      </section>

      <CTASection
        title="Start a conversation"
        description="Whether you're exploring a pilot or want to learn more about the platform, we're here to help."
        primaryHref="/pilot#request"
        secondaryLabel="View Platform"
        secondaryHref="/platform"
      />
    </>
  );
}
