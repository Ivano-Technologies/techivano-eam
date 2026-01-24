import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "success" | "danger";
  size?: "default" | "large";
  position?: "bottom-right" | "bottom-center";
  className?: string;
}

export function FloatingActionButton({
  icon,
  label,
  onClick,
  variant = "primary",
  size = "default",
  position = "bottom-right",
  className,
}: FloatingActionButtonProps) {
  const variantStyles = {
    primary: "bg-primary hover:bg-primary/90 text-primary-foreground",
    secondary: "bg-secondary hover:bg-secondary/90 text-secondary-foreground",
    success: "bg-green-600 hover:bg-green-700 text-white",
    danger: "bg-red-600 hover:bg-red-700 text-white",
  };

  const sizeStyles = {
    default: "h-14 w-14",
    large: "h-16 w-16",
  };

  const positionStyles = {
    "bottom-right": "right-6 bottom-20 md:bottom-6",
    "bottom-center": "left-1/2 -translate-x-1/2 bottom-20 md:bottom-6",
  };

  return (
    <Button
      onClick={onClick}
      className={cn(
        "fixed z-40 rounded-full shadow-2xl transition-all duration-200",
        "hover:scale-110 active:scale-95",
        "focus:outline-none focus:ring-4 focus:ring-offset-2",
        variantStyles[variant],
        sizeStyles[size],
        positionStyles[position],
        className
      )}
      aria-label={label}
    >
      {icon}
    </Button>
  );
}

interface FloatingActionGroup {
  children: ReactNode;
  position?: "bottom-right" | "bottom-center";
}

export function FloatingActionGroup({ children, position = "bottom-right" }: FloatingActionGroup) {
  const positionStyles = {
    "bottom-right": "right-6 bottom-20 md:bottom-6",
    "bottom-center": "left-1/2 -translate-x-1/2 bottom-20 md:bottom-6",
  };

  return (
    <div className={cn("fixed z-40 flex flex-col-reverse gap-3", positionStyles[position])}>
      {children}
    </div>
  );
}
