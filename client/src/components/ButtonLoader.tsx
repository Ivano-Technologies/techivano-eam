import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ButtonLoaderProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ButtonLoader({ className, size = "md" }: ButtonLoaderProps) {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <Loader2 
      className={cn("animate-spin", sizeClasses[size], className)} 
    />
  );
}
