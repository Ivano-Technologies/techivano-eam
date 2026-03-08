import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  User, Mail, Shield, Bell, Palette, Fingerprint, 
  Activity, Package, Wrench, LogOut, Settings 
} from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const [, setLocation] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      setLocation("/login");
      toast.success("Logged out successfully");
    },
  });

  // Fetch user stats
  const { data: assets } = trpc.assets.list.useQuery({});
  const { data: workOrders } = trpc.workOrders.list.useQuery({});
  
  const myAssets = assets?.filter(a => a.assignedTo === user?.id) || [];
  const myWorkOrders = workOrders?.filter(wo => wo.assignedTo === user?.id) || [];
  const activeWorkOrders = myWorkOrders.filter(wo => wo.status === 'in_progress' || wo.status === 'assigned');

  if (!user) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const initials = (user.name || "")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const roleColors = {
    admin: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
    manager: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    technician: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Profile</h1>
        <Button variant="outline" onClick={() => setLocation("/dashboard-settings")} className="w-full sm:w-auto">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </div>

      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your personal details and role</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
            <Avatar className="h-20 w-20 flex-shrink-0">
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3 min-w-0 w-full">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <h2 className="text-2xl font-semibold break-words">{user.name}</h2>
                <Badge className={roleColors[user.role as keyof typeof roleColors]}>
                  {user.role}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span className="break-all text-sm sm:text-base">{user.email}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm sm:text-base">Member since {new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Stats */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned Assets</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{myAssets.length}</div>
            <p className="text-xs text-muted-foreground">Assets under your responsibility</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Work Orders</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{activeWorkOrders.length}</div>
            <p className="text-xs text-muted-foreground">Work orders in progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Work Orders</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{myWorkOrders.length}</div>
            <p className="text-xs text-muted-foreground">All time work orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Settings</CardTitle>
          <CardDescription>Manage your preferences and security</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setLocation("/notification-preferences")}
          >
            <Bell className="mr-2 h-4 w-4" />
            Notification Preferences
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setLocation("/settings/theme")}
          >
            <Palette className="mr-2 h-4 w-4" />
            Theme Settings
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setLocation("/biometric-setup")}
          >
            <Fingerprint className="mr-2 h-4 w-4" />
            Biometric Authentication
          </Button>
        </CardContent>
      </Card>

      {/* Logout */}
      <Card>
        <CardContent className="pt-6">
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {logoutMutation.isPending ? "Logging out..." : "Logout"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
