import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { User, Mail, Shield, Calendar, LogOut, Settings, Fingerprint } from 'lucide-react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';

export default function Profile() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      toast.success('Logged out successfully');
      window.location.href = '/login';
    },
  });

  if (!user) {
    return (
      <div className="container max-w-2xl py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Please log in to view your profile</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'default';
      case 'manager':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="container max-w-2xl py-8 pb-24 md:pb-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-2">Manage your account settings</p>
      </div>

      {/* User Info Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle>{user.name || 'User'}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Mail className="w-4 h-4" />
                {user.email}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4" />
                <span>Role</span>
              </div>
              <Badge variant={getRoleBadgeVariant(user.role)}>
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Member since</span>
              </div>
              <span className="text-sm">
                {new Date(user.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Manage your preferences and security</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setLocation('/notification-preferences')}
          >
            <Settings className="mr-2 h-4 w-4" />
            Notification Preferences
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setLocation('/biometric-setup')}
          >
            <Fingerprint className="mr-2 h-4 w-4" />
            Biometric Authentication
          </Button>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="pt-6">
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {logoutMutation.isPending ? 'Logging out...' : 'Log Out'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
