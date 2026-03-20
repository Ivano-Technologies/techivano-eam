import { useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, Camera, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { uploadPhotoFile } from "@/lib/photoUploads";

export default function MobileWorkOrderDetail() {
  const [, params] = useRoute("/mobile-work-order/:id");
  const [, setLocation] = useLocation();
  const [notes, setNotes] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const workOrderId = params?.id ? Number(params.id) : 0;
  const { data: rawWorkOrder, isLoading, refetch } = trpc.workOrders.getById.useQuery({ id: workOrderId });
  type WorkOrderDetail = { id: number; title?: string; status?: string; priority?: string; description?: string; completionNotes?: string; createdAt?: string | Date };
  const workOrder = rawWorkOrder as WorkOrderDetail | undefined;

  const updateMutation = trpc.workOrders.update.useMutation({
    onSuccess: () => {
      toast.success("Work order updated");
      refetch();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });
  const createPhotoMutation = trpc.photos.create.useMutation();

  const handleStatusUpdate = (newStatus: string) => {
    updateMutation.mutate({
      id: workOrderId,
      status: newStatus as any,
      completionNotes: notes || undefined,
    });
  };

  const handleAddNotes = () => {
    if (!notes.trim()) {
      toast.error("Please enter notes");
      return;
    }
    updateMutation.mutate({
      id: workOrderId,
      completionNotes: notes,
    });
    setNotes("");
  };

  const handleUploadPhoto = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setUploadingPhoto(true);
    try {
      const uploaded = await uploadPhotoFile(file, "inspection-images");
      await createPhotoMutation.mutateAsync({
        workOrderId,
        photoUrl: uploaded.fileUrl,
        photoKey: uploaded.fileKey,
      });
      toast.success("Photo uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Photo upload failed");
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="text-center py-8">Loading...</div>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="text-center py-8">Work order not found</div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-300";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "low":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="p-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/mobile-work-orders")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Work Order #{workOrder.id}</h1>
            <p className="text-sm text-muted-foreground">{workOrder.title}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUploadPhoto(file);
            e.currentTarget.value = "";
          }}
        />
        {/* Status and Priority */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2 mb-4">
              <Badge className={getStatusColor(workOrder.status ?? "")}>
                {(workOrder.status ?? "").replace("_", " ")}
              </Badge>
              <Badge className={getPriorityColor(workOrder.priority ?? "")} variant="outline">
                {workOrder.priority ?? ""}
              </Badge>
            </div>

            {/* Quick Actions */}
            {workOrder.status === "pending" && (
              <Button
                className="w-full"
                onClick={() => handleStatusUpdate("in_progress")}
                disabled={updateMutation.isPending}
              >
                Start Work
              </Button>
            )}

            {workOrder.status === "in_progress" && (
              <div className="space-y-2">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => photoInputRef.current?.click()}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  {uploadingPhoto ? "Uploading..." : "Take Photo"}
                </Button>
                <Button
                  className="w-full"
                  onClick={() => handleStatusUpdate("completed")}
                  disabled={updateMutation.isPending}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Mark Complete
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {workOrder.description || "No description provided"}
            </p>
          </CardContent>
        </Card>

        {/* Asset Info */}
        {(workOrder as any).assetName && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Asset</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{(workOrder as any).assetName}</p>
              {(workOrder as any).assetTag && (
                <p className="text-sm text-muted-foreground">Tag: {(workOrder as any).assetTag}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Add Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter work notes, findings, or updates..."
              rows={4}
              className="text-base"
            />
            <Button
              className="w-full"
              variant="outline"
              onClick={handleAddNotes}
              disabled={!notes.trim() || updateMutation.isPending}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Save Notes
            </Button>
          </CardContent>
        </Card>

        {/* Existing Notes */}
        {workOrder.completionNotes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Previous Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{workOrder.completionNotes}</p>
            </CardContent>
          </Card>
        )}

        {/* Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created:</span>
              <span>{workOrder.createdAt != null ? new Date(workOrder.createdAt).toLocaleDateString() : "—"}</span>
            </div>
            {(workOrder as any).dueDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due:</span>
                <span>{new Date((workOrder as any).dueDate).toLocaleDateString()}</span>
              </div>
            )}
            {(workOrder as any).completionDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completed:</span>
                <span>{new Date((workOrder as any).completionDate).toLocaleDateString()}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
