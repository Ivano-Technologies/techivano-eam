import Link from "next/link";
import { cta } from "@/content/site";
import { cn } from "@/lib/utils";

export interface PricingTier {
  name: string;
  description: string;
  price: string;
  period?: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  highlighted?: boolean;
}

interface PricingTableProps {
  tiers: PricingTier[];
  className?: string;
}

export function PricingTable({ tiers, className }: PricingTableProps) {
  return (
    <section className={cn("py-16 md:py-24", className)}>
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                "rounded-card border p-6 flex flex-col",
                tier.highlighted
                  ? "border-accent bg-accent/5 shadow-lg"
                  : "border-border bg-background"
              )}
            >
              <h3 className="text-lg font-semibold text-primary">{tier.name}</h3>
              <p className="mt-2 text-sm text-muted">{tier.description}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-primary">
                  {tier.price}
                </span>
                {tier.period && (
                  <span className="text-muted text-sm">{tier.period}</span>
                )}
              </div>
              <ul className="mt-6 space-y-3 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted">
                    <span className="text-accent shrink-0">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={tier.ctaHref}
                className={cn(
                  "mt-6 inline-flex items-center justify-center rounded-pill px-4 py-2.5 text-sm font-medium transition-colors",
                  tier.highlighted
                    ? "bg-accent text-white hover:bg-accent-hover"
                    : "border border-border text-foreground hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
              >
                {tier.ctaLabel}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
