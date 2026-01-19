import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Mail, Phone } from "lucide-react";
import { toast } from "sonner";

export default function Vendors() {
  const { data: vendors, isLoading } = trpc.vendors.list.useQuery();

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Vendor Management</h1><p className="text-muted-foreground mt-2">Manage suppliers and contractors</p></div>
        <Button onClick={() => toast.info("Feature coming soon")}><Plus className="mr-2 h-4 w-4" />Add Vendor</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {vendors?.map((vendor) => (
          <Card key={vendor.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <div><CardTitle className="text-lg">{vendor.name}</CardTitle>{vendor.vendorCode && <p className="text-xs text-muted-foreground">{vendor.vendorCode}</p>}</div>
                </div>
                <Badge variant={vendor.isActive ? "default" : "secondary"}>{vendor.isActive ? "Active" : "Inactive"}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {vendor.contactPerson && <p className="text-muted-foreground"><span className="font-medium">Contact:</span> {vendor.contactPerson}</p>}
                {vendor.email && <div className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" /><span>{vendor.email}</span></div>}
                {vendor.phone && <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" /><span>{vendor.phone}</span></div>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
