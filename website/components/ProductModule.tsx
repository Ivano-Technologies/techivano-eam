import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface ProductModuleProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  features?: string[];
  image?: React.ReactNode;
  reverse?: boolean;
  className?: string;
}

export function ProductModule({
  title,
  description,
  icon: Icon,
  features,
  image,
  reverse = false,
  className,
}: ProductModuleProps) {
  return (
    <section
      className={cn(
        "py-16 md:py-24 border-b border-border last:border-0",
        className
      )}
    >
      <div className="container mx-auto px-4 md:px-6">
        <div
          className="grid md:grid-cols-2 gap-12 items-center"
        >
          <div className={reverse ? "md:order-2" : ""}>
            {Icon && (
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Icon className="h-6 w-6" />
              </div>
            )}
            <h2 className="text-2xl md:text-3xl font-bold text-primary">
              {title}
            </h2>
            <p className="mt-4 text-muted">{description}</p>
            {features && features.length > 0 && (
              <ul className="mt-6 space-y-2">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-muted">
                    <span className="text-accent mt-0.5">•</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={reverse ? "md:order-1" : ""}>
            {image || (
              <div className="aspect-video rounded-card bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-muted">
                Module visual
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
