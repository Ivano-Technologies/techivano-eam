import { cn } from "@/lib/utils";

interface ShimmerLoaderProps {
  className?: string;
  count?: number;
  type?: "text" | "card" | "table" | "avatar" | "form" | "grid";
}

export function ShimmerLoader({ className, count = 1, type = "text" }: ShimmerLoaderProps) {
  const renderShimmer = () => {
    switch (type) {
      case "avatar":
        return <div className="h-12 w-12 rounded-full shimmer" />;
      
      case "card":
        return (
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <div className="h-6 w-3/4 shimmer rounded" />
            <div className="space-y-2">
              <div className="h-4 w-full shimmer rounded" />
              <div className="h-4 w-5/6 shimmer rounded" />
              <div className="h-4 w-4/6 shimmer rounded" />
            </div>
            <div className="flex gap-2 pt-2">
              <div className="h-8 w-20 shimmer rounded" />
              <div className="h-8 w-20 shimmer rounded" />
            </div>
          </div>
        );
      
      case "table":
        return (
          <div className="space-y-3">
            <div className="flex gap-4">
              <div className="h-4 w-1/4 shimmer rounded" />
              <div className="h-4 w-1/4 shimmer rounded" />
              <div className="h-4 w-1/4 shimmer rounded" />
              <div className="h-4 w-1/4 shimmer rounded" />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-4 w-1/4 shimmer rounded" />
                <div className="h-4 w-1/4 shimmer rounded" />
                <div className="h-4 w-1/4 shimmer rounded" />
                <div className="h-4 w-1/4 shimmer rounded" />
              </div>
            ))}
          </div>
        );
      
      case "form":
        return (
          <div className="rounded-lg border bg-card p-6 space-y-6">
            <div className="space-y-2">
              <div className="h-4 w-24 shimmer rounded" />
              <div className="h-10 w-full shimmer rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-32 shimmer rounded" />
              <div className="h-10 w-full shimmer rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-28 shimmer rounded" />
              <div className="h-24 w-full shimmer rounded" />
            </div>
            <div className="flex gap-2 pt-2">
              <div className="h-10 w-24 shimmer rounded" />
              <div className="h-10 w-24 shimmer rounded" />
            </div>
          </div>
        );
      
      case "grid":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
                <div className="h-5 w-3/4 shimmer rounded" />
                <div className="h-4 w-full shimmer rounded" />
                <div className="h-4 w-5/6 shimmer rounded" />
                <div className="flex gap-2 pt-2">
                  <div className="h-6 w-16 shimmer rounded" />
                  <div className="h-6 w-16 shimmer rounded" />
                </div>
              </div>
            ))}
          </div>
        );
      
      case "text":
      default:
        return (
          <div className="space-y-2">
            <div className="h-4 w-full shimmer rounded" />
            <div className="h-4 w-5/6 shimmer rounded" />
          </div>
        );
    }
  };

  return (
    <div className={cn("animate-in fade-in duration-300", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={count > 1 ? "mb-4" : ""}>
          {renderShimmer()}
        </div>
      ))}
    </div>
  );
}
