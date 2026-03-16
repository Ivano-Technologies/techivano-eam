import { cn } from "@/lib/utils";

export interface StatItem {
  value: string;
  label: string;
}

interface StatsSectionProps {
  title?: string;
  stats: StatItem[];
  className?: string;
}

export function StatsSection({ title, stats, className }: StatsSectionProps) {
  return (
    <section className={cn("py-16 md:py-24 bg-slate-50 dark:bg-slate-900/50", className)}>
      <div className="container mx-auto px-4 md:px-6">
        {title && (
          <h2 className="text-3xl md:text-4xl font-bold text-primary text-center mb-12">
            {title}
          </h2>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-accent">
                {stat.value}
              </div>
              <div className="mt-1 text-sm text-muted">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
