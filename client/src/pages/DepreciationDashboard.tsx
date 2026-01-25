import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, DollarSign, Calendar, PieChart } from "lucide-react";
import { ShimmerLoader } from "@/components/ShimmerLoader";

export default function DepreciationDashboard() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { data: depreciationSummary, isLoading } = trpc.nrcs.getDepreciationSummary.useQuery({
    year: parseInt(selectedYear),
    categoryCode: selectedCategory !== "all" ? selectedCategory : undefined,
  });

  const { data: categoryCodes } = trpc.nrcs.getCategoryCodes.useQuery();

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <ShimmerLoader />
        <ShimmerLoader />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Depreciation Dashboard</h1>
          <p className="text-muted-foreground">Asset lifecycle and financial analytics</p>
        </div>
        <div className="flex gap-4">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categoryCodes?.map((cat) => (
                <SelectItem key={cat.id} value={cat.code}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Asset Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(depreciationSummary?.totalAcquisitionCost || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Original acquisition cost</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Value</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(depreciationSummary?.totalCurrentValue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">After depreciation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Depreciation</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(depreciationSummary?.totalDepreciation || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Cumulative loss in value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Annual Depreciation</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(depreciationSummary?.annualDepreciation || 0)}
            </div>
            <p className="text-xs text-muted-foreground">For {selectedYear}</p>
          </CardContent>
        </Card>
      </div>

      {/* Depreciation by Category */}
      <Card>
        <CardHeader>
          <CardTitle>Depreciation by Category</CardTitle>
          <CardDescription>Asset value breakdown by NRCS category codes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {depreciationSummary?.byCategory?.map((cat: any) => {
              const percentage = depreciationSummary.totalAcquisitionCost > 0
                ? ((cat.totalAcquisitionCost / depreciationSummary.totalAcquisitionCost) * 100).toFixed(1)
                : 0;
              
              return (
                <div key={cat.categoryCode} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{cat.categoryCode}</Badge>
                      <span className="font-medium">{cat.categoryName}</span>
                      <span className="text-sm text-muted-foreground">
                        ({cat.assetCount} assets)
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(cat.totalCurrentValue)}</div>
                      <div className="text-xs text-muted-foreground">
                        {percentage}% of total
                      </div>
                    </div>
                  </div>
                  <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="absolute h-full bg-primary transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Original: {formatCurrency(cat.totalAcquisitionCost)}</span>
                    <span className="text-red-600">
                      Depreciated: {formatCurrency(cat.totalDepreciation)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Asset Lifecycle Analytics */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Asset Age Distribution</CardTitle>
            <CardDescription>Assets grouped by years since acquisition</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {depreciationSummary?.ageDistribution?.map((group: any) => (
                <div key={group.ageRange} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{group.ageRange}</span>
                    <Badge>{group.count} assets</Badge>
                  </div>
                  <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="absolute h-full bg-blue-500 transition-all"
                      style={{
                        width: `${((group.count / depreciationSummary.totalAssets) * 100).toFixed(0)}%`
                      }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Total Value: {formatCurrency(group.totalValue)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Depreciation Schedule</CardTitle>
            <CardDescription>Projected annual depreciation for next 5 years</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {depreciationSummary?.futureDepreciation?.map((year: any) => (
                <div key={year.year} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{year.year}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrency(year.depreciation)}</div>
                    <div className="text-xs text-muted-foreground">
                      Remaining: {formatCurrency(year.remainingValue)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assets by Branch */}
      <Card>
        <CardHeader>
          <CardTitle>Asset Distribution by Branch</CardTitle>
          <CardDescription>Current value of assets across NRCS branches</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {depreciationSummary?.byBranch?.map((branch: any) => (
              <div key={branch.branchCode} className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{branch.branchCode}</Badge>
                  <span className="text-sm text-muted-foreground">{branch.assetCount} assets</span>
                </div>
                <div className="font-semibold text-lg">{formatCurrency(branch.totalCurrentValue)}</div>
                <div className="text-xs text-muted-foreground">
                  Original: {formatCurrency(branch.totalAcquisitionCost)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
