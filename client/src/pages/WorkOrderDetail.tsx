import { useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNaira } from "@/lib/formatNaira";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, CheckCircle, Camera } from "lucide-react";
import { FloatingActionGroup, FloatingActionButton } from "@/components/FloatingActionButton";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckAnimation } from "@/components/CheckAnimation";
import { uploadPhotoFile } from "@/lib/photoUploads";

export default function WorkOrderDetail() {
  const [, params] = useRoute("/work-orders/:id");
  const [, setLocation] = useLocation();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const workOrderId = params?.id ? Number(params.id) : 0;
  const { data: rawWorkOrder, isLoading, refetch } = trpc.workOrders.getById.useQuery({ id: workOrderId });
  type WorkOrderDetailShape = { id: number; title?: string; workOrderNumber?: string; status?: string; priority?: string; type?: string; description?: string; estimatedCost?: string | number; actualCost?: string | number; completionNotes?: string };
  const workOrder = rawWorkOrder as WorkOrderDetailShape | undefined;
  const isMobile = useIsMobile();

  const [showSuccess, setShowSuccess] = useState(false);

  const updateMutation = trpc.workOrders.update.useMutation({
    onSuccess: () => {
      setShowSuccess(true);
      toast.success("Work order updated");
      setIsEditDialogOpen(false);
      refetch();
    },
  });
  const createPhotoMutation = trpc.photos.create.useMutation();

  const [editForm, setEditForm] = useState({ status: "", completionNotes: "" });

  const handleWorkOrderPhotoUpload = async (file: File) => {
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

  const handleEdit = () => {
    if (workOrder) {
      setEditForm({ status: workOrder.status ?? "", completionNotes: workOrder.completionNotes ?? "" });
      setIsEditDialogOpen(true);
    }
  };

  if (isLoading || !workOrder) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <>
      <CheckAnimation show={showSuccess} message="Work Order Updated!" onComplete={() => setShowSuccess(false)} />
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setLocation("/work-orders")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-3xl font-bold">{workOrder.title}</h1>
            <p className="text-muted-foreground">{workOrder.workOrderNumber}</p>
          </div>
        </div>
        <Button onClick={handleEdit}><Edit className="mr-2 h-4 w-4" />Edit</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Work Order Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><p className="text-sm font-medium text-muted-foreground">Status</p><Badge>{workOrder.status ?? ""}</Badge></div>
          <div><p className="text-sm font-medium text-muted-foreground">Priority</p><Badge>{workOrder.priority ?? ""}</Badge></div>
          <div><p className="text-sm font-medium text-muted-foreground">Type</p><p>{workOrder.type ?? ""}</p></div>
          {workOrder.description && <div><p className="text-sm font-medium text-muted-foreground">Description</p><p>{workOrder.description}</p></div>}
          {workOrder.estimatedCost != null && <div><p className="text-sm font-medium text-muted-foreground">Estimated Cost</p><p className="font-mono tabular-nums">{formatNaira(Number(workOrder.estimatedCost))}</p></div>}
          {workOrder.actualCost != null && <div><p className="text-sm font-medium text-muted-foreground">Actual Cost</p><p className="font-mono tabular-nums">{formatNaira(Number(workOrder.actualCost))}</p></div>}
        </CardContent>
      </Card>
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Work Order</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({...editForm, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Completion Notes</Label><Textarea value={editForm.completionNotes} onChange={(e) => setEditForm({...editForm, completionNotes: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate({ id: workOrderId, status: editForm.status as any, completionNotes: editForm.completionNotes })}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Action Buttons - Mobile Only */}
      {isMobile && (workOrder.status ?? "") !== "completed" && (
        <FloatingActionGroup position="bottom-right">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleWorkOrderPhotoUpload(file);
              e.currentTarget.value = "";
            }}
          />
          <FloatingActionButton
            icon={<Camera className="h-6 w-6" />}
            label={uploadingPhoto ? "Uploading..." : "Add Photo"}
            onClick={() => photoInputRef.current?.click()}
            variant="secondary"
            size="default"
          />
          <FloatingActionButton
            icon={<CheckCircle className="h-7 w-7" />}
            label="Complete Work Order"
            onClick={() => {
              updateMutation.mutate({
                id: workOrderId,
                status: 'completed',
                completionNotes: 'Completed via mobile quick action',
              });
            }}
            variant="success"
            size="large"
          />
        </FloatingActionGroup>
      )}
      </div>
    </>
  );
}
