import type { Metadata } from "next";
import { Hero } from "@/components/Hero";
import { CTASection } from "@/components/CTASection";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pilot Program",
  description:
    "Techivano pilot program: phases, deployment timeline, implementation process, and expected outcomes. Request a pilot deployment for government infrastructure.",
};

const phases = [
  {
    phase: "Phase 1",
    title: "Discovery & setup",
    duration: "4–6 weeks",
    description: "Infrastructure assessment, requirements gathering, and platform configuration. Define success criteria and pilot scope.",
  },
  {
    phase: "Phase 2",
    title: "Asset migration",
    duration: "6–8 weeks",
    description: "Asset data migration, hierarchy and workflow configuration, and integration with existing systems where needed.",
  },
  {
    phase: "Phase 3",
    title: "Pilot operations",
    duration: "3–4 months",
    description: "Training, go-live, and hands-on pilot execution. Monitor adoption, performance, and outcomes against defined criteria.",
  },
  {
    phase: "Phase 4",
    title: "Evaluation & scale",
    duration: "Ongoing",
    description: "Pilot evaluation, lessons learned, and scaling plan. Decide on operational rollout and full platform deployment.",
  },
];

const outcomes = [
  "Validated fit for your infrastructure and workflows",
  "Clear ROI and benefit metrics from pilot data",
  "Stakeholder alignment and change management insights",
  "Documented scaling path and contract structure",
];

export default function PilotPage() {
  return (
    <>
      <Hero
        headline="Pilot program"
        subheadline="Structured pilot deployment to evaluate Techivano against your infrastructure. Clear phases, timeline, and success criteria."
        primaryCta={{ label: "Request Pilot Deployment", href: "#request" }}
        size="default"
      />

      <section id="phases" className="py-16 md:py-24 border-t border-border">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-primary text-center mb-12">
            Pilot phases
          </h2>
          <div className="space-y-12 max-w-3xl mx-auto">
            {phases.map((p, i) => (
              <div
                key={p.phase}
                className="flex gap-6 rounded-card border border-border p-6"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent font-bold">
                  {i + 1}
                </div>
                <div>
                  <div className="text-sm font-medium text-accent">
                    {p.phase} · {p.duration}
                  </div>
                  <h3 className="mt-1 text-xl font-semibold text-primary">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-muted">{p.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-slate-50 dark:bg-slate-900/50">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-primary text-center mb-12">
            Deployment timeline
          </h2>
          <div className="max-w-2xl mx-auto text-center text-muted">
            <p className="text-lg">
              End-to-end pilot typically runs <strong className="text-foreground">6–9 months</strong> from
              kickoff to evaluation: 4–6 weeks discovery and setup, 6–8 weeks
              migration and configuration, 3–4 months live pilot operations, then
              evaluation and scale planning.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 border-t border-border">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-primary text-center mb-12">
            Implementation process
          </h2>
          <ul className="max-w-2xl mx-auto space-y-4 text-muted">
            <li className="flex gap-2">
              <span className="text-accent">1.</span>
              <span><strong className="text-foreground">Kickoff and discovery:</strong> Stakeholder alignment, infrastructure inventory, and pilot scope.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent">2.</span>
              <span><strong className="text-foreground">Configuration:</strong> Tenant setup, asset hierarchy, workflows, and integrations.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent">3.</span>
              <span><strong className="text-foreground">Data migration:</strong> Asset and historical data load, validation, and cutover.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent">4.</span>
              <span><strong className="text-foreground">Training and go-live:</strong> User training, support, and pilot launch.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent">5.</span>
              <span><strong className="text-foreground">Evaluation:</strong> Metrics review, lessons learned, and scaling recommendation.</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-slate-50 dark:bg-slate-900/50">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-primary text-center mb-12">
            Expected outcomes
          </h2>
          <ul className="max-w-2xl mx-auto space-y-3">
            {outcomes.map((o) => (
              <li key={o} className="flex items-center gap-2 text-muted">
                <span className="text-accent">✓</span>
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="request" className="py-16 md:py-24 border-t border-border scroll-mt-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-xl mx-auto rounded-card border border-border bg-background p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-primary">
              Request pilot deployment
            </h2>
            <p className="mt-2 text-muted">
              Share your agency or organization, infrastructure scope, and
              timeline. We'll respond with a pilot proposal and next steps.
            </p>
            <form
              className="mt-6 space-y-4"
              action="#"
              method="post"
              onSubmit={(e) => e.preventDefault()}
            >
              <div>
                <label htmlFor="org" className="block text-sm font-medium text-foreground">
                  Organization / Agency
                </label>
                <input
                  id="org"
                  name="org"
                  type="text"
                  required
                  className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="e.g. Ministry of Works"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="you@agency.gov"
                />
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-foreground">
                  Message / Scope
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="Brief description of your infrastructure and pilot goals..."
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-pill bg-accent py-3 font-medium text-white hover:bg-accent-hover transition-colors"
              >
                Submit request
              </button>
            </form>
            <p className="mt-4 text-xs text-muted">
              By submitting, you agree to be contacted about the Techivano pilot
              program. We do not share your information with third parties.
            </p>
          </div>
        </div>
      </section>

      <CTASection
        title="Ready to start your pilot?"
        description="Our team will review your request and send a tailored pilot proposal and timeline."
        primaryLabel="Request Pilot Deployment"
        primaryHref="#request"
      />
    </>
  );
}
