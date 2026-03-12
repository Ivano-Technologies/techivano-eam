/**
 * Password strength indicator for signup/registration.
 * Shows level (Weak / Fair / Good / Strong) and optional requirement checklist.
 */
import { useMemo } from "react";
import { cn } from "@/lib/utils";

export type StrengthLevel = "empty" | "weak" | "fair" | "good" | "strong";

function getStrength(password: string): StrengthLevel {
  if (!password.length) return "empty";
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (score <= 1) return "weak";
  if (score <= 2) return "fair";
  if (score <= 4) return "good";
  return "strong";
}

const labels: Record<StrengthLevel, string> = {
  empty: "",
  weak: "Weak",
  fair: "Fair",
  good: "Good",
  strong: "Strong",
};

const barColors: Record<Exclude<StrengthLevel, "empty">, string> = {
  weak: "bg-red-500",
  fair: "bg-amber-500",
  good: "bg-lime-500",
  strong: "bg-emerald-600",
};

const barCount: Record<Exclude<StrengthLevel, "empty">, number> = {
  weak: 1,
  fair: 2,
  good: 3,
  strong: 4,
};

export function PasswordStrength({ password, className }: { password: string; className?: string }) {
  const strength = useMemo(() => getStrength(password), [password]);
  if (strength === "empty") return null;

  const count = barCount[strength];
  const color = barColors[strength];
  const label = labels[strength];

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i <= count ? color : "bg-muted"
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Strength: <span className="font-medium text-foreground">{label}</span>
      </p>
    </div>
  );
}

/** Requirements for display under the password field (e.g. min length, upper, lower, number). */
export function PasswordRequirements({ password }: { password: string }) {
  const checks = useMemo(
    () => ({
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /\d/.test(password),
    }),
    [password]
  );
  if (!password.length) return null;
  return (
    <ul className="text-xs text-muted-foreground space-y-0.5 mt-1">
      <li className={checks.length ? "text-emerald-600" : ""}>
        {checks.length ? "✓" : "○"} At least 8 characters
      </li>
      <li className={checks.upper ? "text-emerald-600" : ""}>
        {checks.upper ? "✓" : "○"} One uppercase letter
      </li>
      <li className={checks.lower ? "text-emerald-600" : ""}>
        {checks.lower ? "✓" : "○"} One lowercase letter
      </li>
      <li className={checks.number ? "text-emerald-600" : ""}>
        {checks.number ? "✓" : "○"} One number
      </li>
    </ul>
  );
}
