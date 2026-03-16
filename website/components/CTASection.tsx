import Link from "next/link";
import { cta } from "@/content/site";
import { cn } from "@/lib/utils";

interface CTASectionProps {
  title: string;
  description?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  className?: string;
}

export function CTASection({
  title,
  description,
  primaryLabel = cta.pilot,
  primaryHref = cta.pilotHref,
  secondaryLabel,
  secondaryHref,
  className,
}: CTASectionProps) {
  return (
    <section
      className={cn(
        "py-16 md:py-24 bg-primary text-white",
        className
      )}
    >
      <div className="container mx-auto px-4 md:px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold">{title}</h2>
        {description && (
          <p className="mt-4 text-lg text-slate-300 max-w-2xl mx-auto">
            {description}
          </p>
        )}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={primaryHref}
            className="inline-flex items-center justify-center rounded-pill bg-white px-6 py-3 text-base font-medium text-primary hover:bg-slate-100 transition-colors"
          >
            {primaryLabel}
          </Link>
          {secondaryLabel && secondaryHref && (
            <Link
              href={secondaryHref}
              className="inline-flex items-center justify-center rounded-pill border border-slate-400 px-6 py-3 text-base font-medium text-white hover:bg-white/10 transition-colors"
            >
              {secondaryLabel}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
