import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Package, MapPin, Calendar, DollarSign, QrCode, Download, Upload, Image as ImageIcon, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import AssetDepreciation from "@/components/AssetDepreciation";
import { AssetMaintenanceTimeline } from "@/components/AssetMaintenanceTimeline";
import { MaintenanceHistory } from "@/components/MaintenanceHistory";
import { AssetEditHistoryTimeline } from "@/components/AssetEditHistoryTimeline";
import { ComprehensiveAssetEditDialog } from "@/components/ComprehensiveAssetEditDialog";
import { QuickActionsSheet } from "@/components/QuickActionsSheet";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { useIsMobile } from "@/hooks/useIsMobile";
import { RefreshCw } from "lucide-react";

const MULTIPART_THRESHOLD_BYTES = 10 * 1024 * 1024;
const MULTIPART_PART_SIZE_BYTES = 8 * 1024 * 1024;

export default function AssetDetail() {
  const [, params] = useRoute("/assets/:id");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [photoCaption, setPhotoCaption] = useState('');

  const assetId = params?.id ? Number(params.id) : 0;
  const { data: asset, isLoading, refetch } = trpc.assets.getById.useQuery({ id: assetId });
  const isMobile = useIsMobile();
  const [isQuickUpdateOpen, setIsQuickUpdateOpen] = useState(false);
  const { data: photos, refetch: refetchPhotos } = trpc.photos.listByAsset.useQuery({ assetId }, { enabled: !!assetId });

  const generateQRCodeMutation = trpc.assets.generateQRCode.useMutation({
    onSuccess: () => {
      toast.success("QR Code generated successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to generate QR code: ${error.message}`);
    },
  });

  const updateAssetMutation = trpc.assets.update.useMutation({
    onSuccess: () => {
      toast.success("Asset updated successfully");
      setIsEditDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to update asset: ${error.message}`);
    },
  });

  const createPhotoMutation = trpc.photos.create.useMutation({
    onSuccess: () => {
      toast.success("Photo uploaded successfully");
      refetchPhotos();
    },
    onError: (error) => {
      toast.error(`Failed to upload photo: ${error.message}`);
    },
  });

  const deletePhotoMutation = trpc.photos.delete.useMutation({
    onSuccess: () => {
      toast.success("Photo deleted successfully");
      refetchPhotos();
    },
    onError: (error) => {
      toast.error(`Failed to delete photo: ${error.message}`);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`);
        return false;
      }
      if (file.size > 2 * 1024 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 2GB limit`);
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      setPendingFiles(validFiles);
      setIsUploadDialogOpen(true);
    }
    e.target.value = '';
  };

  const handleUploadWithCaption = async () => {
    if (pendingFiles.length === 0) return;

    const getMultipartSessionKey = (file: File) =>
      `multipart:${file.name}:${file.size}:${file.lastModified}:${file.type}`;

    const uploadViaSignedUrl = (
      file: File,
      uploadUrl: string,
      onProgress: (progressPercent: number) => void
    ) =>
      new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onProgress((event.loaded / event.total) * 100);
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
            return;
          }
          reject(new Error(`Direct upload failed with status ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Direct upload failed"));
        xhr.send(file);
      });

    const uploadViaMultipart = async (
      file: File,
      onProgress: (progressPercent: number) => void
    ) => {
      const sessionKey = getMultipartSessionKey(file);
      const existingSessionRaw = localStorage.getItem(sessionKey);
      const existingSession = existingSessionRaw
        ? (JSON.parse(existingSessionRaw) as {
            uploadId: string;
            fileKey: string;
            parts: Array<{ partNumber: number; eTag: string }>;
          })
        : null;

      let uploadId = existingSession?.uploadId ?? "";
      let fileKey = existingSession?.fileKey ?? "";
      const uploadedPartMap = new Map<number, string>(
        (existingSession?.parts ?? []).map((part) => [part.partNumber, part.eTag])
      );

      if (!uploadId || !fileKey) {
        const startResponse = await fetch("/api/uploads/multipart/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            uploadType: "assets",
          }),
        });
        if (!startResponse.ok) {
          const message = await startResponse.text();
          throw new Error(`Failed to start multipart upload for ${file.name}: ${message}`);
        }
        const startPayload = await startResponse.json();
        uploadId = startPayload.uploadId;
        fileKey = startPayload.fileKey;
      }

      const totalParts = Math.ceil(file.size / MULTIPART_PART_SIZE_BYTES);
      const countUploadedBytes = () => {
        let uploadedBytes = 0;
        for (const partNumber of uploadedPartMap.keys()) {
          const isLastPart = partNumber === totalParts;
          const partBytes = isLastPart
            ? file.size - (totalParts - 1) * MULTIPART_PART_SIZE_BYTES
            : MULTIPART_PART_SIZE_BYTES;
          uploadedBytes += Math.max(0, partBytes);
        }
        return uploadedBytes;
      };

      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        if (uploadedPartMap.has(partNumber)) continue;

        const startByte = (partNumber - 1) * MULTIPART_PART_SIZE_BYTES;
        const endByte = Math.min(startByte + MULTIPART_PART_SIZE_BYTES, file.size);
        const chunk = file.slice(startByte, endByte);

        const urlResponse = await fetch("/api/uploads/multipart/url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uploadId,
            fileKey,
            partNumber,
            fileType: file.type,
          }),
        });
        if (!urlResponse.ok) {
          const message = await urlResponse.text();
          throw new Error(`Failed to get upload URL for part ${partNumber}: ${message}`);
        }
        const { uploadUrl } = await urlResponse.json();

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return;
            const uploadedBytes = countUploadedBytes() + event.loaded;
            onProgress((uploadedBytes / file.size) * 100);
          };
          xhr.onload = () => {
            if (xhr.status < 200 || xhr.status >= 300) {
              reject(new Error(`Failed uploading part ${partNumber}`));
              return;
            }
            const eTagHeader = xhr.getResponseHeader("ETag") || xhr.getResponseHeader("etag");
            const eTag = (eTagHeader ?? "").replaceAll('"', "");
            if (!eTag) {
              reject(new Error(`Missing ETag for part ${partNumber}`));
              return;
            }

            uploadedPartMap.set(partNumber, eTag);
            localStorage.setItem(
              sessionKey,
              JSON.stringify({
                uploadId,
                fileKey,
                parts: Array.from(uploadedPartMap.entries()).map(([partNo, tag]) => ({
                  partNumber: partNo,
                  eTag: tag,
                })),
              })
            );
            resolve();
          };
          xhr.onerror = () => reject(new Error(`Network error uploading part ${partNumber}`));
          xhr.send(chunk);
        });
      }

      const completeResponse = await fetch("/api/uploads/multipart/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uploadId,
          fileKey,
          fileType: file.type,
          fileSize: file.size,
          uploadType: "assets",
          parts: Array.from(uploadedPartMap.entries()).map(([partNumber, eTag]) => ({
            partNumber,
            eTag,
          })),
        }),
      });
      if (!completeResponse.ok) {
        const message = await completeResponse.text();
        throw new Error(`Failed to complete multipart upload for ${file.name}: ${message}`);
      }

      localStorage.removeItem(sessionKey);
      return (await completeResponse.json()) as { fileKey: string; fileUrl: string };
    };

    setUploadingPhoto(true);
    setUploadProgress(0);
    try {
      for (let index = 0; index < pendingFiles.length; index++) {
        const file = pendingFiles[index]!;
        let uploaded: { fileKey: string; fileUrl: string };
        if (file.size > MULTIPART_THRESHOLD_BYTES) {
          uploaded = await uploadViaMultipart(file, (singleFileProgress) => {
            const totalProgress =
              ((index + singleFileProgress / 100) / pendingFiles.length) * 100;
            setUploadProgress(Math.round(totalProgress));
          });
        } else {
          const signResponse = await fetch("/api/uploads/signed-url", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size,
              uploadType: "assets",
            }),
          });
          if (!signResponse.ok) {
            const message = await signResponse.text();
            throw new Error(`Failed to request signed URL for ${file.name}: ${message}`);
          }
          const { uploadUrl, fileKey } = await signResponse.json();

          await uploadViaSignedUrl(file, uploadUrl, (singleFileProgress) => {
            const totalProgress =
              ((index + singleFileProgress / 100) / pendingFiles.length) * 100;
            setUploadProgress(Math.round(totalProgress));
          });

          const completeResponse = await fetch("/api/uploads/complete", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fileKey,
              fileType: file.type,
              uploadType: "assets",
            }),
          });
          if (!completeResponse.ok) {
            const message = await completeResponse.text();
            throw new Error(`Upload completion failed for ${file.name}: ${message}`);
          }
          uploaded = await completeResponse.json();
        }
        const { fileUrl, fileKey } = uploaded;
        if (!fileUrl) {
          throw new Error(
            "Upload completed, but public asset URL is unavailable. Set R2_PUBLIC_BASE_URL."
          );
        }

        await createPhotoMutation.mutateAsync({
          assetId,
          photoUrl: fileUrl,
          photoKey: fileKey,
          caption: photoCaption || undefined,
        });
      }
      toast.success(`Successfully uploaded ${pendingFiles.length} photo(s)`);
      setIsUploadDialogOpen(false);
      setPendingFiles([]);
      setPhotoCaption('');
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setUploadingPhoto(false);
      setUploadProgress(0);
    }
  };

  const handleDeletePhoto = (photoId: number) => {
    if (confirm('Are you sure you want to delete this photo?')) {
      deletePhotoMutation.mutate({ id: photoId });
    }
  };

  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    status: "",
    manufacturer: "",
    model: "",
    serialNumber: "",
    location: "",
    notes: "",
    // NRCS Fields
    itemType: "",
    branchCode: "",
    itemCategoryCode: "",
    subCategoryId: "",
    methodOfAcquisition: "",
    projectReference: "",
    yearAcquired: null as number | null,
    acquiredCondition: "",
    department: "",
    physicalCheckDate: null as Date | null,
    physicalCheckConductedBy: "",
    // Financial Fields
    acquisitionCost: "",
    currentDepreciatedValue: "",
    residualValue: "",
    usefulLifeYears: null as number | null,
    depreciationMethod: "",
    depreciationStartDate: null as Date | null,
    warrantyExpiry: null as Date | null,
    // Technical Fields
    specifications: "",
  });
  
  const [editTab, setEditTab] = useState("basic");

  const handleEdit = () => {
    if (asset) {
      setEditForm({
        name: asset.name,
        description: asset.description || "",
        status: asset.status,
        manufacturer: asset.manufacturer || "",
        model: asset.model || "",
        serialNumber: asset.serialNumber || "",
        location: asset.location || "",
        notes: asset.notes || "",
        // NRCS Fields
        itemType: asset.itemType || "",
        branchCode: asset.branchCode || "",
        itemCategoryCode: asset.itemCategoryCode || "",
        subCategoryId: asset.subCategory || "",
        methodOfAcquisition: asset.methodOfAcquisition || "",
        projectReference: asset.projectReference || "",
        yearAcquired: asset.yearAcquired || null,
        acquiredCondition: asset.acquiredCondition || "",
        department: asset.department || "",
        physicalCheckDate: asset.lastPhysicalCheckDate ? new Date(asset.lastPhysicalCheckDate) : null,
        physicalCheckConductedBy: asset.checkConductedBy || "",
        // Financial Fields
        acquisitionCost: asset.acquisitionCost || "",
        currentDepreciatedValue: asset.currentDepreciatedValue || "",
        residualValue: asset.residualValue || "",
        usefulLifeYears: asset.usefulLifeYears || null,
        depreciationMethod: asset.depreciationMethod || "",
        depreciationStartDate: asset.depreciationStartDate ? new Date(asset.depreciationStartDate) : null,
        warrantyExpiry: asset.warrantyExpiry ? new Date(asset.warrantyExpiry) : null,
        // Technical Fields
        specifications: "",
      });
      setEditTab("basic");
      setIsEditDialogOpen(true);
    }
  };

  const handleUpdate = () => {
    updateAssetMutation.mutate({
      id: assetId,
      name: editForm.name || undefined,
      description: editForm.description || undefined,
      status: editForm.status as any,
      manufacturer: editForm.manufacturer || undefined,
      model: editForm.model || undefined,
      serialNumber: editForm.serialNumber || undefined,
      location: editForm.location || undefined,
      notes: editForm.notes || undefined,
      // NRCS Fields
      itemType: editForm.itemType as any,
      branchCode: editForm.branchCode || undefined,
      itemCategoryCode: editForm.itemCategoryCode || undefined,
      subCategory: editForm.subCategoryId || undefined,
      methodOfAcquisition: editForm.methodOfAcquisition || undefined,
      projectReference: editForm.projectReference || undefined,
      yearAcquired: editForm.yearAcquired || undefined,
      acquiredCondition: editForm.acquiredCondition as any,
      department: editForm.department || undefined,
      lastPhysicalCheckDate: editForm.physicalCheckDate || undefined,
      checkConductedBy: editForm.physicalCheckConductedBy || undefined,
      // Financial Fields
      acquisitionCost: editForm.acquisitionCost || undefined,
      currentDepreciatedValue: editForm.currentDepreciatedValue || undefined,
      warrantyExpiry: editForm.warrantyExpiry || undefined,
    });
  };

  const getStatusColor = (status: string) => {
    const colors = {
      operational: "bg-green-100 text-green-800",
      maintenance: "bg-yellow-100 text-yellow-800",
      repair: "bg-orange-100 text-orange-800",
      retired: "bg-gray-100 text-gray-800",
      disposed: "bg-red-100 text-red-800",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const canEdit = user?.role === "admin" || user?.role === "manager";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Package className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-xl text-muted-foreground">Asset not found</p>
        <Button onClick={() => setLocation("/assets")} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Assets
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setLocation("/assets")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{asset.name}</h1>
            <p className="text-muted-foreground mt-1">{asset.assetTag}</p>
          </div>
          <Badge className={getStatusColor(asset.status)}>{asset.status}</Badge>
        </div>
        {canEdit && (
          <Button onClick={handleEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Asset
          </Button>
        )}
      </div>

      {/* Quick Actions Sheet - Mobile Only */}
      <QuickActionsSheet
        assetId={asset.id}
        assetName={asset.name}
        assetTag={asset.assetTag}
        currentStatus={asset.status}
      />

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Asset Tag</p>
              <p className="text-base">{asset.assetTag}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Name</p>
              <p className="text-base">{asset.name}</p>
            </div>
            {asset.description && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Description</p>
                <p className="text-base">{asset.description}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <Badge className={getStatusColor(asset.status)}>{asset.status}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Technical Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {asset.manufacturer && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Manufacturer</p>
                <p className="text-base">{asset.manufacturer}</p>
              </div>
            )}
            {asset.model && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Model</p>
                <p className="text-base">{asset.model}</p>
              </div>
            )}
            {asset.serialNumber && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Serial Number</p>
                <p className="text-base">{asset.serialNumber}</p>
              </div>
            )}
            {asset.location && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Location</p>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <p className="text-base">{asset.location}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {asset.acquisitionDate && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Acquisition Date</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="text-base">{new Date(asset.acquisitionDate).toLocaleDateString()}</p>
                </div>
              </div>
            )}
            {asset.acquisitionCost && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Acquisition Cost</p>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <p className="text-base">₦{parseFloat(asset.acquisitionCost).toLocaleString()}</p>
                </div>
              </div>
            )}
            {asset.currentValue && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current Value</p>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <p className="text-base">₦{parseFloat(asset.currentValue).toLocaleString()}</p>
                </div>
              </div>
            )}
            {asset.depreciationRate && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Depreciation Rate</p>
                <p className="text-base">{asset.depreciationRate}% per year</p>
              </div>
            )}
            {asset.warrantyExpiry && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Warranty Expiry</p>
                <p className="text-base">{new Date(asset.warrantyExpiry).toLocaleDateString()}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>QR Code</CardTitle>
              {!asset.qrCode && canEdit && (
                <Button
                  size="sm"
                  onClick={() => generateQRCodeMutation.mutate({ id: asset.id })}
                  disabled={generateQRCodeMutation.isPending}
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  Generate QR Code
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {asset.qrCode ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <img
                    src={asset.qrCode}
                    alt="Asset QR Code"
                    className="w-48 h-48 border-2 border-border rounded-lg"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = asset.qrCode!;
                      link.download = `${asset.assetTag}-qr-code.png`;
                      link.click();
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.print()}
                  >
                    Print Label
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Scan this QR code to view asset details
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <QrCode className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No QR code generated yet
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {asset.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base whitespace-pre-wrap">{asset.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Photo Gallery */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Asset Photos
            </CardTitle>
            {canEdit && (
              <div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="photo-upload"
                  disabled={uploadingPhoto}
                />
                <Button
                  size="sm"
                  onClick={() => document.getElementById('photo-upload')?.click()}
                  disabled={uploadingPhoto}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadingPhoto ? `Uploading... ${uploadProgress}%` : 'Upload Photo'}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {photos && photos.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {photos.map((photo: any) => (
                <div key={photo.id} className="relative group">
                  <img
                    src={photo.photoUrl}
                    alt={photo.caption || 'Asset photo'}
                    className="w-full h-32 object-cover rounded-lg border-2 border-border cursor-pointer hover:border-primary transition-colors"
                    onClick={() => setSelectedImage(photo.photoUrl)}
                  />
                  {canEdit && (
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeletePhoto(photo.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  {photo.caption && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{photo.caption}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No photos uploaded yet
              </p>
              {canEdit && (
                <p className="text-xs text-muted-foreground mt-1">
                  Click "Upload Photo" to add images
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Preview Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Photo Preview</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Asset photo preview"
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Depreciation Analysis */}
      {asset.depreciationMethod && asset.depreciationMethod !== 'none' && (
        <AssetDepreciation assetId={assetId} />
      )}

      {/* Maintenance Timeline */}
      <div id="maintenance-timeline">
        <AssetMaintenanceTimeline assetId={assetId} />
      </div>

      {/* Maintenance History */}
      <div id="maintenance-history">
        <MaintenanceHistory assetId={assetId} />
      </div>

      {/* Edit History */}
      <div id="edit-history">
        <AssetEditHistoryTimeline assetId={assetId} />
      </div>

      {/* Photo Upload Dialog with Caption */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Photos</DialogTitle>
            <DialogDescription>
              {pendingFiles.length} photo(s) selected. Add an optional caption that will apply to all photos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="photo-caption">Caption (Optional)</Label>
              <Input
                id="photo-caption"
                placeholder="e.g., Front view, After maintenance, etc."
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Selected files:</p>
              <ul className="list-disc list-inside space-y-1">
                {pendingFiles.map((file, idx) => (
                  <li key={idx} className="truncate">{file.name}</li>
                ))}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsUploadDialogOpen(false);
                setPendingFiles([]);
                setPhotoCaption('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUploadWithCaption} disabled={uploadingPhoto}>
              {uploadingPhoto
                ? `Uploading... ${uploadProgress}%`
                : `Upload ${pendingFiles.length} Photo(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ComprehensiveAssetEditDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        asset={asset}
        onUpdate={handleUpdate}
        isUpdating={updateAssetMutation.isPending}
      />

      {/* Floating Action Button - Mobile Only */}
      {isMobile && (
        <FloatingActionButton
          icon={<RefreshCw className="h-6 w-6" />}
          label="Quick Update"
          onClick={() => setIsEditDialogOpen(true)}
          variant="primary"
          size="large"
          position="bottom-right"
        />
      )}
    </div>
  );
}
