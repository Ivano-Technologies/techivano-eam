import { forwardRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NairaCurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: number | string;
  onChange?: (value: number) => void;
}

export const NairaCurrencyInput = forwardRef<HTMLInputElement, NairaCurrencyInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState("");

    useEffect(() => {
      if (value === undefined || value === null || value === "") {
        setDisplayValue("");
        return;
      }
      
      const numValue = typeof value === "string" ? parseFloat(value) : value;
      if (isNaN(numValue)) {
        setDisplayValue("");
        return;
      }

      // Format with thousand separators
      setDisplayValue(numValue.toLocaleString("en-NG"));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      
      // Remove all non-digit characters except decimal point
      const cleaned = input.replace(/[^\d.]/g, "");
      
      // Prevent multiple decimal points
      const parts = cleaned.split(".");
      const formatted = parts.length > 2 
        ? parts[0] + "." + parts.slice(1).join("")
        : cleaned;

      // Parse to number
      const numValue = parseFloat(formatted || "0");
      
      if (!isNaN(numValue)) {
        onChange?.(numValue);
        // Format for display with thousand separators
        setDisplayValue(numValue.toLocaleString("en-NG"));
      } else {
        onChange?.(0);
        setDisplayValue("");
      }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // On focus, show raw number without formatting for easier editing
      if (value) {
        const numValue = typeof value === "string" ? parseFloat(value) : value;
        if (!isNaN(numValue)) {
          setDisplayValue(numValue.toString());
        }
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // On blur, reformat with thousand separators
      if (value) {
        const numValue = typeof value === "string" ? parseFloat(value) : value;
        if (!isNaN(numValue)) {
          setDisplayValue(numValue.toLocaleString("en-NG"));
        }
      }
    };

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">
          ₦
        </span>
        <Input
          {...props}
          ref={ref}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn("pl-8 font-mono tabular-nums", className)}
        />
      </div>
    );
  }
);

NairaCurrencyInput.displayName = "NairaCurrencyInput";
