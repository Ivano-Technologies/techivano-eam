import Link from "next/link";
import { cta } from "@/content/site";
import { cn } from "@/lib/utils";

interface HeroProps {
  headline: string;
  subheadline: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  className?: string;
  size?: "default" | "large";
}

export function Hero({
  headline,
  subheadline,
  primaryCta = { label: cta.pilot, href: cta.pilotHref },
  secondaryCta,
  className,
  size = "default",
}: HeroProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden py-16 md:py-24 lg:py-32",
        className
      )}
    >
      <div className="container mx-auto px-4 md:px-6 text-center">
        <h1
          className={cn(
            "font-bold tracking-tight text-primary",
            size === "large"
              ? "text-4xl md:text-5xl lg:text-6xl max-w-4xl mx-auto leading-tight"
              : "text-3xl md:text-4xl lg:text-5xl max-w-3xl mx-auto"
          )}
        >
          {headline}
        </h1>
        <p className="mt-6 text-lg md:text-xl text-muted max-w-2xl mx-auto">
          {subheadline}
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={primaryCta.href}
            className="inline-flex items-center justify-center rounded-pill bg-accent px-6 py-3 text-base font-medium text-white hover:bg-accent-hover transition-colors"
          >
            {primaryCta.label}
          </Link>
          {secondaryCta && (
            <Link
              href={secondaryCta.href}
              className="inline-flex items-center justify-center rounded-pill border border-border px-6 py-3 text-base font-medium text-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {secondaryCta.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
