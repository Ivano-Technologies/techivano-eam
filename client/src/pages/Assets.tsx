import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Package, MapPin, Download, Upload } from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Assets() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: assets, isLoading, refetch } = trpc.assets.list.useQuery({
    siteId: siteFilter !== "all" ? Number(siteFilter) : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const { data: sites } = trpc.sites.list.useQuery();
  const { data: categories } = trpc.assetCategories.list.useQuery();
  
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const { refetch: downloadTemplate, isFetching: isDownloading } = trpc.bulkOperations.getImportTemplate.useQuery(
    { entity: "assets" },
    { enabled: false }
  );

  const handleDownloadTemplate = async () => {
    try {
      const result = await downloadTemplate();
      if (result.data) {
        const blob = new Blob([Buffer.from(result.data.data, 'base64')], { type: result.data.mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.data.filename;
        link.click();
        URL.revokeObjectURL(url);
        toast.success("Template downloaded");
      }
    } catch (error: any) {
      toast.error(`Failed to download template: ${error.message}`);
    }
  };

  const importAssetsMutation = trpc.bulkOperations.importAssets.useMutation({
    onSuccess: (result: any) => {
      toast.success(`Imported ${result.imported || 0} assets successfully`);
      if (result.failed > 0) {
        toast.error(`${result.failed} errors occurred`);
      }
      setIsImportDialogOpen(false);
      setImportFile(null);
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });



  const handleImport = async () => {
    if (!importFile) {
      toast.error("Please select a file");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = e.target?.result as string;
      const base64Data = data.split(',')[1];
      importAssetsMutation.mutate({ fileData: base64Data });
    };
    reader.readAsDataURL(importFile);
  };

  const createAssetMutation = trpc.assets.create.useMutation({
    onSuccess: () => {
      toast.success("Asset created successfully");
      setIsCreateDialogOpen(false);
      refetch();
      setNewAsset({
        assetTag: "",
        name: "",
        description: "",
        categoryId: "",
        siteId: "",
        manufacturer: "",
        model: "",
        serialNumber: "",
        location: "",
      });
    },
    onError: (error: any) => {
      toast.error(`Failed to create asset: ${error.message}`);
    },
  });

  const [newAsset, setNewAsset] = useState({
    assetTag: "",
    name: "",
    description: "",
    categoryId: "",
    siteId: "",
    manufacturer: "",
    model: "",
    serialNumber: "",
    location: "",
  });

  const handleCreateAsset = () => {
    if (!newAsset.assetTag || !newAsset.name || !newAsset.categoryId || !newAsset.siteId) {
      toast.error("Please fill in all required fields");
      return;
    }

    createAssetMutation.mutate({
      assetTag: newAsset.assetTag,
      name: newAsset.name,
      description: newAsset.description || undefined,
      categoryId: Number(newAsset.categoryId),
      siteId: Number(newAsset.siteId),
      manufacturer: newAsset.manufacturer || undefined,
      model: newAsset.model || undefined,
      serialNumber: newAsset.serialNumber || undefined,
      location: newAsset.location || undefined,
    });
  };

  const filteredAssets = assets?.filter((asset) =>
    searchTerm === "" ||
    asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.assetTag.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const canCreateAsset = user?.role === "admin" || user?.role === "manager";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assets</h1>
          <p className="text-muted-foreground mt-2">
            Manage your organization's physical assets
          </p>
        </div>
        {canCreateAsset && (
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleDownloadTemplate}
              disabled={isDownloading}
            >
              <Download className="mr-2 h-4 w-4" />
              Template
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsImportDialogOpen(true)}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Asset
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Asset</DialogTitle>
                <DialogDescription>
                  Create a new asset record in the system
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="assetTag">Asset Tag *</Label>
                    <Input
                      id="assetTag"
                      value={newAsset.assetTag}
                      onChange={(e) => setNewAsset({ ...newAsset, assetTag: e.target.value })}
                      placeholder="e.g., AST-001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Asset Name *</Label>
                    <Input
                      id="name"
                      value={newAsset.name}
                      onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                      placeholder="e.g., Generator Unit"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newAsset.description}
                    onChange={(e) => setNewAsset({ ...newAsset, description: e.target.value })}
                    placeholder="Asset description..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select value={newAsset.categoryId} onValueChange={(value) => setNewAsset({ ...newAsset, categoryId: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="site">Site *</Label>
                    <Select value={newAsset.siteId} onValueChange={(value) => setNewAsset({ ...newAsset, siteId: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select site" />
                      </SelectTrigger>
                      <SelectContent>
                        {sites?.map((site) => (
                          <SelectItem key={site.id} value={site.id.toString()}>
                            {site.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="manufacturer">Manufacturer</Label>
                    <Input
                      id="manufacturer"
                      value={newAsset.manufacturer}
                      onChange={(e) => setNewAsset({ ...newAsset, manufacturer: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Input
                      id="model"
                      value={newAsset.model}
                      onChange={(e) => setNewAsset({ ...newAsset, model: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="serialNumber">Serial Number</Label>
                    <Input
                      id="serialNumber"
                      value={newAsset.serialNumber}
                      onChange={(e) => setNewAsset({ ...newAsset, serialNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={newAsset.location}
                      onChange={(e) => setNewAsset({ ...newAsset, location: e.target.value })}
                      placeholder="e.g., Building A, Floor 2"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateAsset} disabled={createAssetMutation.isPending}>
                  {createAssetMutation.isPending ? "Creating..." : "Create Asset"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="operational">Operational</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="repair">Repair</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
                <SelectItem value="disposed">Disposed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={siteFilter} onValueChange={setSiteFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by site" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                {sites?.map((site) => (
                  <SelectItem key={site.id} value={site.id.toString()}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : filteredAssets && filteredAssets.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAssets.map((asset) => (
            <Link key={asset.id} href={`/assets/${asset.id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      <div>
                        <CardTitle className="text-lg">{asset.name}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {asset.assetTag}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className={getStatusColor(asset.status)}>
                      {asset.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {asset.manufacturer && (
                      <p className="text-muted-foreground">
                        <span className="font-medium">Manufacturer:</span> {asset.manufacturer}
                      </p>
                    )}
                    {asset.model && (
                      <p className="text-muted-foreground">
                        <span className="font-medium">Model:</span> {asset.model}
                      </p>
                    )}
                    {asset.location && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{asset.location}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No assets found</p>
          </CardContent>
        </Card>
      )}

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Assets</DialogTitle>
            <DialogDescription>
              Upload an Excel file to bulk import assets
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="import-file">Select Excel File</Label>
              <Input
                id="import-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
            </div>
            {importFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {importFile.name}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport}
              disabled={!importFile || importAssetsMutation.isPending}
            >
              {importAssetsMutation.isPending ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
