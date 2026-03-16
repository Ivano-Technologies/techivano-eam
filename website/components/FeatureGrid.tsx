import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface FeatureItem {
  title: string;
  description: string;
  icon?: LucideIcon;
}

interface FeatureGridProps {
  title: string;
  subtitle?: string;
  features: FeatureItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

export function FeatureGrid({
  title,
  subtitle,
  features,
  columns = 3,
  className,
}: FeatureGridProps) {
  return (
    <section className={cn("py-16 md:py-24", className)}>
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-primary">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-4 text-lg text-muted">{subtitle}</p>
          )}
        </div>
        <div
          className={cn(
            "grid gap-8",
            columns === 2 && "md:grid-cols-2",
            columns === 3 && "md:grid-cols-3",
            columns === 4 && "md:grid-cols-2 lg:grid-cols-4"
          )}
        >
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-card border border-border bg-background p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              {feature.icon && (
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <feature.icon className="h-5 w-5" />
                </div>
              )}
              <h3 className="text-lg font-semibold text-primary">
                {feature.title}
              </h3>
              <p className="mt-2 text-muted">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
