import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingOverlayProps {
  message?: string;
  className?: string;
}

export function LoadingOverlay({ message = "Loading...", className }: LoadingOverlayProps) {
  return (
    <div className={cn(
      "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm",
      className
    )}>
      <div className="flex flex-col items-center gap-4 rounded-lg bg-card p-8 shadow-lg border-2 border-[#DC2626] glass dark:glass-dark">
        <Loader2 className="h-12 w-12 animate-spin text-[#DC2626]" />
        <p className="text-sm font-medium text-foreground">{message}</p>
      </div>
    </div>
  );
}
