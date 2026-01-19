import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus } from "lucide-react";
import { toast } from "sonner";

export default function Maintenance() {
  const { data: schedules, isLoading } = trpc.maintenance.list.useQuery();
  const { data: upcoming } = trpc.maintenance.upcoming.useQuery({ days: 30 });

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Preventive Maintenance</h1><p className="text-muted-foreground mt-2">Manage maintenance schedules</p></div>
        <Button onClick={() => toast.info("Feature coming soon")}><Plus className="mr-2 h-4 w-4" />Add Schedule</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Upcoming Maintenance (Next 30 Days)</CardTitle></CardHeader>
        <CardContent>
          {upcoming && upcoming.length > 0 ? (
            <div className="space-y-3">
              {upcoming.map((s) => (
                <div key={s.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div><p className="font-medium">{s.name}</p><p className="text-sm text-muted-foreground">Due: {new Date(s.nextDue).toLocaleDateString()}</p></div>
                  <Badge>{s.frequency}</Badge>
                </div>
              ))}
            </div>
          ) : <p className="text-muted-foreground">No upcoming maintenance</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>All Schedules</CardTitle></CardHeader>
        <CardContent>
          {schedules && schedules.length > 0 ? (
            <div className="space-y-3">
              {schedules.map((s) => (
                <div key={s.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div><p className="font-medium">{s.name}</p><p className="text-sm text-muted-foreground">{s.description}</p></div>
                  <div className="flex gap-2"><Badge>{s.frequency}</Badge><Badge variant={s.isActive ? "default" : "secondary"}>{s.isActive ? "Active" : "Inactive"}</Badge></div>
                </div>
              ))}
            </div>
          ) : <p className="text-muted-foreground">No schedules found</p>}
        </CardContent>
      </Card>
    </div>
  );
}
