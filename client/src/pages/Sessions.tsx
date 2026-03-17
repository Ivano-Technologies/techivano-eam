import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Monitor, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

function truncate(str: string | null | undefined, max: number): string {
  if (!str || typeof str !== "string") return "—";
  return str.length <= max ? str : str.slice(0, max) + "…";
}

export default function Sessions() {
  const { data: sessions, isLoading } = trpc.sessions.list.useQuery();
  const utils = trpc.useUtils();
  const revokeMutation = trpc.sessions.revoke.useMutation({
    onSuccess: () => {
      utils.sessions.list.invalidate();
      toast.success("Session revoked");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to revoke session");
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Active sessions</h1>
        <p className="text-muted-foreground mt-1">
          Devices where you are signed in. Revoke any session to sign out that device.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Devices</CardTitle>
          <CardDescription>
            Review and revoke sessions you no longer use.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!sessions?.length ? (
            <p className="text-sm text-muted-foreground">No sessions found.</p>
          ) : (
            <ul className="divide-y divide-border space-y-0">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      {(s.userAgent ?? "").toLowerCase().includes("mobile") ? (
                        <Smartphone className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Monitor className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {truncate(s.userAgent, 60) || "Unknown device"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.ip ?? "—"} · Last seen{" "}
                        {s.lastSeenAt
                          ? formatDistanceToNow(new Date(s.lastSeenAt), { addSuffix: true })
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.revoked && (
                      <Badge variant="secondary">Revoked</Badge>
                    )}
                    {!s.revoked && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => revokeMutation.mutate({ sessionId: s.id })}
                        disabled={revokeMutation.isPending && revokeMutation.variables?.sessionId === s.id}
                      >
                        {revokeMutation.isPending && revokeMutation.variables?.sessionId === s.id ? "Revoking…" : "Revoke"}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
