import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface NRCSAssetFormProps {
  asset?: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
  sites: { id: number; name?: string }[];
  categories: unknown[];
}

function str(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val);
}

interface SubCategoryEntry {
  id: number;
  name?: string;
  categoryType?: string;
}

interface BranchEntry {
  id: number;
  code?: string;
  name?: string;
  state?: string;
}

interface CategoryEntry {
  id: number;
  code?: string;
  name?: string;
  usefulLifeYears?: number;
  depreciationRate?: number;
}

export function NRCSAssetForm({ asset, onChange, sites, categories }: NRCSAssetFormProps) {
  const { data: branchCodesRaw } = trpc.nrcs.getBranchCodes.useQuery();
  const { data: categoryCodesRaw } = trpc.nrcs.getCategoryCodes.useQuery();
  const { data: allSubCategoriesRaw } = trpc.nrcs.getSubCategories.useQuery();

  const branchCodes: BranchEntry[] = Array.isArray(branchCodesRaw) ? (branchCodesRaw as BranchEntry[]) : [];
  const categoryCodes: CategoryEntry[] = Array.isArray(categoryCodesRaw) ? (categoryCodesRaw as CategoryEntry[]) : [];
  const allSubCategories: SubCategoryEntry[] = Array.isArray(allSubCategoriesRaw)
    ? (allSubCategoriesRaw as SubCategoryEntry[])
    : [];

  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [itemType, setItemType] = useState((asset?.itemType as string) || "Asset");

  // Filter sub-categories by item type
  const filteredSubCategories = allSubCategories.filter(
    (sub) => sub.categoryType === itemType || sub.categoryType === "Both"
  );

  const branchCode = typeof asset?.branchCode === "string" ? asset.branchCode : "";
  const categoryCode = typeof asset?.itemCategoryCode === "string" ? asset.itemCategoryCode : "";

  // Generate asset code when branch and category are selected
  const { data: assetCode } = trpc.nrcs.generateAssetCode.useQuery(
    { branchCode, categoryCode },
    { enabled: !!(branchCode && categoryCode) }
  );

  useEffect(() => {
    if (assetCode) {
      setGeneratedCode(assetCode);
    }
  }, [assetCode]);

  const handleItemTypeChange = (value: string) => {
    setItemType(value);
    onChange("itemType", value);
  };

  const acquisitionMethods = [
    "ICRC",
    "IFRC",
    "Other Donor",
    "Project",
    "Internal",
    "Other"
  ];

  const statusOptions = [
    "In Use",
    "In Store",
    "Damaged",
    "Under Repair",
    "Disposed",
    "Lost/Stolen"
  ];

  return (
    <Tabs defaultValue="basic" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="basic">Basic Info</TabsTrigger>
        <TabsTrigger value="nrcs">NRCS Details</TabsTrigger>
        <TabsTrigger value="tracking">Tracking</TabsTrigger>
      </TabsList>

      <TabsContent value="basic" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Core asset identification details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Item Type */}
            <div className="space-y-2">
              <Label htmlFor="itemType">Item Type *</Label>
              <Select value={itemType} onValueChange={handleItemTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asset">Asset (Cost &gt; ₦1M, Life ≥ 3 years)</SelectItem>
                  <SelectItem value="Inventory">Inventory (Cost ₦100K-1M, Life &lt; 3 years)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Generated Asset Code Display */}
            {generatedCode && (
              <div className="space-y-2">
                <Label>Generated NRCS Code</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-lg px-4 py-2">
                    {generatedCode}
                  </Badge>
                </div>
              </div>
            )}

            {/* Asset Tag */}
            <div className="space-y-2">
              <Label htmlFor="assetTag">Asset Tag *</Label>
              <Input
                id="assetTag"
                value={str(asset?.assetTag)}
                onChange={(e) => onChange("assetTag", e.target.value)}
                placeholder="e.g., NRCS_NHQCO0001"
              />
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Item Name/Description *</Label>
              <Input
                id="name"
                value={str(asset?.name)}
                onChange={(e) => onChange("name", e.target.value)}
                placeholder="e.g., Dell Latitude 7420 Laptop"
              />
            </div>

            {/* Sub-Category */}
            <div className="space-y-2">
              <Label htmlFor="subCategory">Sub-Category</Label>
              <Select
                value={str(asset?.subCategory)}
                onValueChange={(value) => onChange("subCategory", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sub-category" />
                </SelectTrigger>
                <SelectContent>
                  {filteredSubCategories?.map((sub) => (
                    <SelectItem key={sub.id} value={sub.name ?? ""}>
                      {sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Manufacturer */}
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer/Make</Label>
              <Input
                id="manufacturer"
                value={str(asset?.manufacturer)}
                onChange={(e) => onChange("manufacturer", e.target.value)}
                placeholder="e.g., Dell, HP, Toyota"
              />
            </div>

            {/* Model */}
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={str(asset?.model)}
                onChange={(e) => onChange("model", e.target.value)}
                placeholder="e.g., Latitude 7420"
              />
            </div>

            {/* Serial/Product Number */}
            <div className="space-y-2">
              <Label htmlFor="productNumber">Serial/Product Number</Label>
              <Input
                id="productNumber"
                value={str(asset?.productNumber)}
                onChange={(e) => onChange("productNumber", e.target.value)}
                placeholder="Serial or product identification number"
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="nrcs" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>NRCS Classification</CardTitle>
            <CardDescription>Official NRCS asset register fields</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Branch Code */}
            <div className="space-y-2">
              <Label htmlFor="branchCode">Branch Code *</Label>
              <Select
                value={str(asset?.branchCode)}
                onValueChange={(value) => onChange("branchCode", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branchCodes?.map((branch) => (
                    <SelectItem key={branch.id} value={branch.code ?? ""}>
                      {branch.code} - {branch.name} {branch.state && `(${branch.state})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category Code */}
            <div className="space-y-2">
              <Label htmlFor="itemCategoryCode">Category Code *</Label>
              <Select
                value={str(asset?.itemCategoryCode)}
                onValueChange={(value) => onChange("itemCategoryCode", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryCodes?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.code ?? ""}>
                      {cat.code} - {cat.name} ({cat.usefulLifeYears}yr, {cat.depreciationRate}% annual)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Site/Location */}
            <div className="space-y-2">
              <Label htmlFor="siteId">Site/Location *</Label>
              <Select
                value={asset?.siteId != null ? String(asset.siteId) : ""}
                onValueChange={(value) => onChange("siteId", value)}
              >
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

            {/* Method of Acquisition */}
            <div className="space-y-2">
              <Label htmlFor="methodOfAcquisition">Method of Acquisition</Label>
              <Select
                value={str(asset?.methodOfAcquisition)}
                onValueChange={(value) => onChange("methodOfAcquisition", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {acquisitionMethods.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project Reference */}
            <div className="space-y-2">
              <Label htmlFor="projectReference">Project Reference/Name</Label>
              <Input
                id="projectReference"
                value={str(asset?.projectReference)}
                onChange={(e) => onChange("projectReference", e.target.value)}
                placeholder="Associated project name or code"
              />
            </div>

            {/* Year Acquired */}
            <div className="space-y-2">
              <Label htmlFor="yearAcquired">Year Acquired</Label>
              <Input
                id="yearAcquired"
                type="number"
                min="2000"
                max={new Date().getFullYear()}
                value={str(asset?.yearAcquired)}
                onChange={(e) => onChange("yearAcquired", parseInt(e.target.value))}
                placeholder={new Date().getFullYear().toString()}
              />
            </div>

            {/* Acquired Condition */}
            <div className="space-y-2">
              <Label htmlFor="acquiredCondition">Acquired Condition</Label>
              <Select
                value={str(asset?.acquiredCondition)}
                onValueChange={(value) => onChange("acquiredCondition", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="New">New</SelectItem>
                  <SelectItem value="Used">Used</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Acquisition Cost */}
            <div className="space-y-2">
              <Label htmlFor="acquisitionCost">Acquisition Cost (NGN)</Label>
              <Input
                id="acquisitionCost"
                type="number"
                value={str(asset?.acquisitionCost)}
                onChange={(e) => onChange("acquisitionCost", e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Current Depreciated Value */}
            <div className="space-y-2">
              <Label htmlFor="currentDepreciatedValue">Current Depreciated Value (NGN)</Label>
              <Input
                id="currentDepreciatedValue"
                type="number"
                value={str(asset?.currentDepreciatedValue)}
                onChange={(e) => onChange("currentDepreciatedValue", e.target.value)}
                placeholder="Auto-calculated or manual entry"
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="tracking" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Assignment & Tracking</CardTitle>
            <CardDescription>Current status and physical verification</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Current Status</Label>
              <Select
                value={str(asset?.status) || "In Use"}
                onValueChange={(value) => onChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assigned To Name */}
            <div className="space-y-2">
              <Label htmlFor="assignedToName">Assigned To (Name)</Label>
              <Input
                id="assignedToName"
                value={str(asset?.assignedToName)}
                onChange={(e) => onChange("assignedToName", e.target.value)}
                placeholder="Full name of person assigned"
              />
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label htmlFor="department">Department/Unit</Label>
              <Input
                id="department"
                value={str(asset?.department)}
                onChange={(e) => onChange("department", e.target.value)}
                placeholder="e.g., Finance, Operations, IT"
              />
            </div>

            {/* Condition */}
            <div className="space-y-2">
              <Label htmlFor="condition">Physical Condition</Label>
              <Select
                value={str(asset?.condition)}
                onValueChange={(value) => onChange("condition", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Excellent">Excellent</SelectItem>
                  <SelectItem value="Good">Good</SelectItem>
                  <SelectItem value="Fair">Fair</SelectItem>
                  <SelectItem value="Poor">Poor</SelectItem>
                  <SelectItem value="Non-functional">Non-functional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Last Physical Check Date */}
            <div className="space-y-2">
              <Label htmlFor="lastPhysicalCheckDate">Last Physical Check Date</Label>
              <Input
                id="lastPhysicalCheckDate"
                type="date"
                value={str(asset?.lastPhysicalCheckDate)}
                onChange={(e) => onChange("lastPhysicalCheckDate", e.target.value)}
              />
            </div>

            {/* Check Conducted By */}
            <div className="space-y-2">
              <Label htmlFor="checkConductedBy">Check Conducted By</Label>
              <Input
                id="checkConductedBy"
                value={str(asset?.checkConductedBy)}
                onChange={(e) => onChange("checkConductedBy", e.target.value)}
                placeholder="Name of person who conducted physical check"
              />
            </div>

            {/* Remarks */}
            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks/Notes</Label>
              <Textarea
                id="remarks"
                value={str(asset?.remarks)}
                onChange={(e) => onChange("remarks", e.target.value)}
                placeholder="Additional notes or observations"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
