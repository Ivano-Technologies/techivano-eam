import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CheckCircle, XCircle, Clock, Loader2, Mail, Phone, Briefcase, MapPin, Building2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

export default function PendingUsers() {
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  
  const { data: users, isLoading, refetch } = trpc.users.getPendingUsers.useQuery();
  
  const approveMutation = trpc.users.approveUser.useMutation({
    onSuccess: () => {
      alert("User approved successfully!");
      refetch();
    },
    onError: (error: any) => {
      alert(`Approval failed: ${error.message}`);
    },
  });
  
  const rejectMutation = trpc.users.rejectUser.useMutation({
    onSuccess: () => {
      alert("User rejected.");
      setShowRejectDialog(false);
      setSelectedUser(null);
      setRejectionReason("");
      refetch();
    },
    onError: (error: any) => {
      alert(`Rejection failed: ${error.message}`);
    },
  });

  const handleApprove = (user: any) => {
    if (confirm(`Approve ${user.name}?`)) {
      approveMutation.mutate({ userId: user.id });
    }
  };

  const handleReject = () => {
    if (!selectedUser) return;
    rejectMutation.mutate({ 
      userId: selectedUser.id, 
      reason: rejectionReason || "Registration not approved"
    });
  };

  const openRejectDialog = (user: any) => {
    setSelectedUser(user);
    setShowRejectDialog(true);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    );
  }

  const pending = users?.filter((u: any) => u.status === "pending") || [];
  const approved = users?.filter((u: any) => u.status === "approved") || [];
  const rejected = users?.filter((u: any) => u.status === "rejected") || [];

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Access Management</h1>
          <p className="text-gray-600 mt-2">Review and manage user registration requests</p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pending.length}</div>
              <p className="text-xs text-gray-500">Awaiting review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved Users</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{approved.length}</div>
              <p className="text-xs text-gray-500">Active users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rejected.length}</div>
              <p className="text-xs text-gray-500">Not approved</p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Users List */}
        {pending.length === 0 && (
          <Alert>
            <AlertDescription>No pending user requests at this time.</AlertDescription>
          </Alert>
        )}

        {pending.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Pending Requests</h2>
            
            <div className="bg-white rounded-lg border">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pending.map((user: any) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{user.name}</div>
                          {user.jobTitle && (
                            <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                              <Briefcase className="h-3 w-3" />
                              {user.jobTitle}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="text-sm text-gray-900 flex items-center gap-1">
                            <Mail className="h-3 w-3 text-gray-400" />
                            {user.email}
                          </div>
                          {user.phoneNumber && (
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                              <Phone className="h-3 w-3 text-gray-400" />
                              {user.phoneCountryCode} {user.phoneNumber}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {user.agency && (
                            <div className="text-sm text-gray-900 flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-gray-400" />
                              {user.agency}
                            </div>
                          )}
                          {user.geographicalArea && (
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-gray-400" />
                              {user.geographicalArea}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(user)}
                            disabled={approveMutation.isPending}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openRejectDialog(user)}
                            disabled={rejectMutation.isPending}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recently Processed */}
        {(approved.length > 0 || rejected.length > 0) && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Recently Processed</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {approved.slice(0, 3).map((user: any) => (
                <Card key={user.id} className="border-l-4 border-l-green-500">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                        <div className="text-xs text-gray-400 mt-2">
                          Approved: {user.approvedAt ? new Date(user.approvedAt).toLocaleDateString() : "N/A"}
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-700 border-green-300">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Approved
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {rejected.slice(0, 3).map((user: any) => (
                <Card key={user.id} className="border-l-4 border-l-red-500">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                        {user.rejectionReason && (
                          <div className="text-xs text-gray-600 mt-2">
                            Reason: {user.rejectionReason}
                          </div>
                        )}
                      </div>
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        Rejected
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject User Registration</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject {selectedUser?.name}'s registration?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="e.g., Incomplete information..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectionReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                "Reject User"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
