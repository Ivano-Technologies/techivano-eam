import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileCheck, Plus, Calendar } from "lucide-react";
import { toast } from "sonner";

export default function Compliance() {
  const { data: records, isLoading } = trpc.compliance.list.useQuery();

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  const getStatusColor = (status: string) => {
    const colors = { compliant: "bg-green-100 text-green-800", non_compliant: "bg-red-100 text-red-800", pending: "bg-yellow-100 text-yellow-800", expired: "bg-gray-100 text-gray-800" };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Compliance Tracking</h1><p className="text-muted-foreground mt-2">Manage regulatory requirements</p></div>
        <Button onClick={() => toast.info("Feature coming soon")}><Plus className="mr-2 h-4 w-4" />Add Record</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {records?.map((record) => (
          <Card key={record.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-primary" />
                  <div><CardTitle className="text-lg">{record.title}</CardTitle>{record.regulatoryBody && <p className="text-xs text-muted-foreground">{record.regulatoryBody}</p>}</div>
                </div>
                <Badge className={getStatusColor(record.status)}>{record.status.replace("_", " ")}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {record.requirementType && <p className="text-muted-foreground"><span className="font-medium">Type:</span> {record.requirementType}</p>}
                {record.dueDate && <div className="flex items-center gap-1 text-muted-foreground"><Calendar className="h-3 w-3" /><span>Due: {new Date(record.dueDate).toLocaleDateString()}</span></div>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
