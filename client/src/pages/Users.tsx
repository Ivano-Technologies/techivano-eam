import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Mail } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Users() {
  const { user } = useAuth();
  const { data: users, isLoading } = trpc.users.list.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-xl text-muted-foreground">Admin access required</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  const getRoleBadgeColor = (role: string) => {
    const colors = { admin: "bg-red-100 text-red-800", manager: "bg-blue-100 text-blue-800", technician: "bg-green-100 text-green-800", user: "bg-gray-100 text-gray-800" };
    return colors[role as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">User Management</h1><p className="text-muted-foreground mt-2">Manage system users and roles</p></div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {users?.map((u) => (
          <Card key={u.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  <div><CardTitle className="text-lg">{u.name || "No Name"}</CardTitle></div>
                </div>
                <Badge className={getRoleBadgeColor(u.role)}>{u.role}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {u.email && <div className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" /><span>{u.email}</span></div>}
                {u.loginMethod && <p className="text-muted-foreground"><span className="font-medium">Login:</span> {u.loginMethod}</p>}
                <p className="text-muted-foreground"><span className="font-medium">Last Sign In:</span> {new Date(u.lastSignedIn).toLocaleDateString()}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
