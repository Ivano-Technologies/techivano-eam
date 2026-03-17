import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { clearImpersonationToken } from "@/impersonation";
import { AlertTriangle } from "lucide-react";
import { Button } from "./ui/button";

export function ImpersonationBanner() {
  const { user, refresh } = useAuth();
  const utils = trpc.useUtils();
  const stopMutation = trpc.impersonation.stopImpersonation.useMutation({
    onSuccess: () => {
      clearImpersonationToken();
      utils.auth.me.invalidate();
      refresh();
    },
  });

  if (!user?.isImpersonating) return null;

  const displayName = (user as { name?: string | null; email?: string | null }).name
    || (user as { name?: string | null; email?: string | null }).email
    || "a user";

  return (
    <div
      className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-amber-950 shadow-sm"
      role="alert"
    >
      <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
      <span className="text-sm font-medium">
        You are impersonating {displayName}.
      </span>
      <Button
        size="sm"
        variant="secondary"
        className="shrink-0 bg-amber-100 text-amber-900 hover:bg-amber-200"
        onClick={() => stopMutation.mutate()}
        disabled={stopMutation.isPending}
      >
        {stopMutation.isPending ? "Stopping…" : "Stop impersonating"}
      </Button>
    </div>
  );
}
