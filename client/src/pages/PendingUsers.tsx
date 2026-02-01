import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { CheckCircle, XCircle, Clock, Loader2, User, Mail, Phone, Briefcase, MapPin, Target, Building2, Users, Download, Search, Filter, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

export default function PendingUsers() {
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showBulkRejectDialog, setShowBulkRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  const { data: users, isLoading, refetch } = trpc.users.getPendingUsers.useQuery();
  
  const approveMutation = trpc.users.approveUser.useMutation({
    onSuccess: () => {
      alert("User approved successfully! They can now access the system.");
      refetch();
    },
    onError: (error: any) => {
      alert(`Approval failed: ${error.message}`);
    },
  });
  
  const rejectMutation = trpc.users.rejectUser.useMutation({
    onSuccess: () => {
      alert("User registration rejected.");
      setShowRejectDialog(false);
      setSelectedUser(null);
      setRejectionReason("");
      refetch();
    },
    onError: (error: any) => {
      alert(`Rejection failed: ${error.message}`);
    },
  });

  const bulkApproveMutation = trpc.users.bulkApproveUsers.useMutation({
    onSuccess: (data) => {
      alert(`Successfully approved ${data.count} user(s)!`);
      setSelectedUserIds([]);
      refetch();
    },
    onError: (error: any) => {
      alert(`Bulk approval failed: ${error.message}`);
    },
  });

  const bulkRejectMutation = trpc.users.bulkRejectUsers.useMutation({
    onSuccess: (data) => {
      alert(`Successfully rejected ${data.count} user(s).`);
      setShowBulkRejectDialog(false);
      setSelectedUserIds([]);
      setRejectionReason("");
      refetch();
    },
    onError: (error: any) => {
      alert(`Bulk rejection failed: ${error.message}`);
    },
  });

  const handleApprove = (user: any) => {
    approveMutation.mutate({ userId: user.id });
  };

  const handleReject = () => {
    if (!selectedUser) return;
    rejectMutation.mutate({ 
      userId: selectedUser.id, 
      reason: rejectionReason || "Registration not approved"
    });
  };

  const handleBulkApprove = () => {
    if (selectedUserIds.length === 0) {
      alert("Please select users to approve");
      return;
    }
    if (confirm(`Approve ${selectedUserIds.length} selected user(s)?`)) {
      bulkApproveMutation.mutate({ userIds: selectedUserIds });
    }
  };

  const handleBulkReject = () => {
    if (selectedUserIds.length === 0) {
      alert("Please select users to reject");
      return;
    }
    setShowBulkRejectDialog(true);
  };

  const confirmBulkReject = () => {
    bulkRejectMutation.mutate({ 
      userIds: selectedUserIds,
      reason: rejectionReason || "Registration not approved"
    });
  };

  const openRejectDialog = (user: any) => {
    setSelectedUser(user);
    setShowRejectDialog(true);
  };

  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.length === pending.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(pending.map(u => u.id));
    }
  };

  const exportToCSV = () => {
    if (!pending || pending.length === 0) {
      alert("No pending users to export");
      return;
    }

    const headers = [
      "Name", "Email", "Job Title", "Phone", "Agency", 
      "Location", "Purpose", "Employee ID", "Department", 
      "Supervisor", "Registered Date"
    ];

    const rows = pending.map(user => [
      user.name || "",
      user.email || "",
      user.jobTitle || "",
      `${user.phoneCountryCode || ""} ${user.phoneNumber || ""}`.trim(),
      user.agency || "",
      user.geographicalArea || "",
      user.registrationPurpose || "",
      user.employeeId || "",
      user.department || "",
      user.supervisorName || "",
      new Date(user.createdAt).toLocaleString()
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pending-users-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
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

  // Apply filters and search
  const filteredUsers = users?.filter((u: any) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        u.name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query) ||
        u.agency?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }
    
    // Status filter
    if (statusFilter !== "all" && u.status !== statusFilter) {
      return false;
    }
    
    // Date range filter
    if (dateFrom) {
      const userDate = new Date(u.createdAt);
      const fromDate = new Date(dateFrom);
      if (userDate < fromDate) return false;
    }
    
    if (dateTo) {
      const userDate = new Date(u.createdAt);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // Include entire day
      if (userDate > toDate) return false;
    }
    
    return true;
  }) || [];
  
  const pending = filteredUsers.filter((u: any) => u.status === "pending");
  const approved = filteredUsers.filter((u: any) => u.status === "approved");
  const rejected = filteredUsers.filter((u: any) => u.status === "rejected");
  
  // Count active filters
  const activeFilterCount = [
    searchQuery ? 1 : 0,
    statusFilter !== "all" ? 1 : 0,
    dateFrom ? 1 : 0,
    dateTo ? 1 : 0
  ].reduce((a, b) => a + b, 0);
  
  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Access Management</h1>
            <p className="text-gray-600 mt-2">Review and manage user registration requests</p>
          </div>
          <Button
            onClick={exportToCSV}
            variant="outline"
            className="flex items-center gap-2"
            disabled={pending.length === 0}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search Input */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, email, or agency..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                
                {/* Date From */}
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-gray-600 whitespace-nowrap">From:</Label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                {/* Date To */}
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-gray-600 whitespace-nowrap">To:</Label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              {/* Active Filters Display */}
              {activeFilterCount > 0 && (
                <div className="flex items-center justify-between bg-blue-50 p-3 rounded-md">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-blue-900 font-medium">
                      {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
                    </span>
                    <span className="text-sm text-blue-700">
                      • Showing {filteredUsers.length} of {users?.length || 0} users
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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

        {/* Bulk Actions Bar */}
        {selectedUserIds.length > 0 && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="font-medium text-blue-900">
                    {selectedUserIds.length} user(s) selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedUserIds([])}
                  >
                    Clear Selection
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleBulkApprove}
                    disabled={bulkApproveMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {bulkApproveMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Approving...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve Selected
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleBulkReject}
                    disabled={bulkRejectMutation.isPending}
                    variant="destructive"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject Selected
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Requests */}
        {pending.length === 0 && (
          <Alert>
            <AlertDescription>No pending user requests at this time.</AlertDescription>
          </Alert>
        )}

        {pending.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Pending Requests ({pending.length})</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
              >
                {selectedUserIds.length === pending.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            {pending.map((user: any) => (
              <Card key={user.id} className="border-l-4 border-l-yellow-500">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedUserIds.includes(user.id)}
                        onCheckedChange={() => toggleUserSelection(user.id)}
                        className="mt-1"
                      />
                      <div>
                        <CardTitle className="text-lg">{user.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="flex items-center gap-1 bg-yellow-50 text-yellow-700 border-yellow-300">
                      <Clock className="h-3 w-3" />
                      Pending
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* User Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {user.jobTitle && (
                        <div className="flex items-start gap-2">
                          <Briefcase className="h-4 w-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="font-medium text-gray-700">Job Title</p>
                            <p className="text-gray-600">{user.jobTitle}</p>
                          </div>
                        </div>
                      )}
                      
                      {user.phoneNumber && (
                        <div className="flex items-start gap-2">
                          <Phone className="h-4 w-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="font-medium text-gray-700">Phone</p>
                            <p className="text-gray-600">{user.phoneCountryCode} {user.phoneNumber}</p>
                          </div>
                        </div>
                      )}
                      
                      {user.agency && (
                        <div className="flex items-start gap-2">
                          <Building2 className="h-4 w-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="font-medium text-gray-700">Agency</p>
                            <p className="text-gray-600">{user.agency}</p>
                          </div>
                        </div>
                      )}
                      
                      {user.geographicalArea && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="font-medium text-gray-700">Location</p>
                            <p className="text-gray-600">{user.geographicalArea}</p>
                          </div>
                        </div>
                      )}
                      
                      {user.registrationPurpose && (
                        <div className="flex items-start gap-2">
                          <Target className="h-4 w-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="font-medium text-gray-700">Purpose</p>
                            <p className="text-gray-600">{user.registrationPurpose}</p>
                          </div>
                        </div>
                      )}
                      
                      {user.employeeId && (
                        <div className="flex items-start gap-2">
                          <User className="h-4 w-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="font-medium text-gray-700">Employee ID</p>
                            <p className="text-gray-600">{user.employeeId}</p>
                          </div>
                        </div>
                      )}
                      
                      {user.department && (
                        <div className="flex items-start gap-2">
                          <Users className="h-4 w-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="font-medium text-gray-700">Department</p>
                            <p className="text-gray-600">{user.department}</p>
                          </div>
                        </div>
                      )}
                      
                      {user.supervisorName && (
                        <div className="flex items-start gap-2">
                          <User className="h-4 w-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="font-medium text-gray-700">Supervisor</p>
                            <p className="text-gray-600">{user.supervisorName}</p>
                            {user.supervisorEmail && (
                              <p className="text-xs text-gray-500">{user.supervisorEmail}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-gray-500 pt-2 border-t">
                      Registered: {new Date(user.createdAt).toLocaleString()}
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={() => handleApprove(user)}
                        disabled={approveMutation.isPending}
                        className="bg-green-600 hover:bg-green-700 flex-1"
                      >
                        {approveMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Approving...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => openRejectDialog(user)}
                        disabled={rejectMutation.isPending}
                        variant="destructive"
                        className="flex-1"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Recently Processed */}
        {(approved.length > 0 || rejected.length > 0) && (
          <div className="space-y-4 pt-6">
            <h2 className="text-xl font-semibold text-gray-900">Recently Processed</h2>
            
            {approved.slice(0, 5).map((user: any) => (
              <Card key={user.id} className="border-l-4 border-l-green-500">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{user.name}</CardTitle>
                      <CardDescription>{user.email}</CardDescription>
                    </div>
                    <Badge className="bg-green-100 text-green-700 border-green-300">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Approved
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-gray-500">
                    Approved: {user.approvedAt ? new Date(user.approvedAt).toLocaleString() : "N/A"}
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {rejected.slice(0, 3).map((user: any) => (
              <Card key={user.id} className="border-l-4 border-l-red-500">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{user.name}</CardTitle>
                      <CardDescription>{user.email}</CardDescription>
                    </div>
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 mr-1" />
                      Rejected
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {user.rejectionReason && (
                    <div className="text-sm text-gray-600 mb-2">
                      <strong>Reason:</strong> {user.rejectionReason}
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    Rejected: {new Date(user.updatedAt).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Single User Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject User Registration</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject {selectedUser?.name}'s registration?
              You can optionally provide a reason that will be sent to the user.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="e.g., Incomplete information, unauthorized access request..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
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

      {/* Bulk Reject Dialog */}
      <Dialog open={showBulkRejectDialog} onOpenChange={setShowBulkRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Multiple Users</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject {selectedUserIds.length} selected user(s)?
              You can optionally provide a reason that will be sent to all rejected users.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulkReason">Rejection Reason (Optional)</Label>
              <Textarea
                id="bulkReason"
                placeholder="e.g., Incomplete information, unauthorized access request..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowBulkRejectDialog(false);
                setRejectionReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmBulkReject}
              disabled={bulkRejectMutation.isPending}
            >
              {bulkRejectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                `Reject ${selectedUserIds.length} User(s)`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
