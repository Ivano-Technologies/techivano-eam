import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const NRCS_RED = "#DC2626";

type CheckboxProps = React.ComponentProps<typeof CheckboxPrimitive.Root> & {
  /** Optional class for the check icon (e.g. size). */
  iconClassName?: string;
  /** Optional custom indicator (e.g. red brush-style check). When set, iconClassName is applied to it. */
  indicator?: React.ReactNode;
};

function Checkbox({ className, iconClassName, indicator, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center relative",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="absolute inset-0 flex items-center justify-center text-current transition-none pointer-events-none"
      >
        {indicator != null ? (
          <span className={cn("inline-flex items-center justify-center", iconClassName)}>{indicator}</span>
        ) : (
          <CheckIcon className={cn("size-3.5", iconClassName)} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

/** Red, brush-style check icon for auth (NRCS). Use as checkbox indicator. */
export function RedCheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke={NRCS_RED}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12.5l4 4 10-11" />
    </svg>
  );
}

export { Checkbox };
