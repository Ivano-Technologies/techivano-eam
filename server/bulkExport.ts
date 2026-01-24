import * as XLSX from 'xlsx';

/**
 * Export data to CSV format
 */
export function exportToCSV(data: any[]): string {
  const worksheet = XLSX.utils.json_to_sheet(data);
  return XLSX.utils.sheet_to_csv(worksheet);
}

/**
 * Export data to Excel format (base64 encoded)
 */
export function exportToExcel(data: any[], sheetName: string = 'Sheet1'): string {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  // Write to base64
  const excelBuffer = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  return excelBuffer;
}

/**
 * Format asset data for export
 */
export function formatAssetsForExport(assets: any[]): any[] {
  return assets.map(asset => ({
    'Asset Tag': asset.assetTag,
    'Name': asset.name,
    'Category': asset.categoryName || '',
    'Site': asset.siteName || '',
    'Status': asset.status,
    'Manufacturer': asset.manufacturer || '',
    'Model': asset.model || '',
    'Serial Number': asset.serialNumber || '',
    'Acquisition Date': asset.acquisitionDate ? new Date(asset.acquisitionDate).toLocaleDateString() : '',
    'Acquisition Cost': asset.acquisitionCost || '',
    'Current Value': asset.currentValue || '',
    'Location': asset.location || '',
    'Notes': asset.notes || '',
  }));
}

/**
 * Format site data for export
 */
export function formatSitesForExport(sites: any[]): any[] {
  return sites.map(site => ({
    'Site Name': site.name,
    'Address': site.address || '',
    'City': site.city || '',
    'State': site.state || '',
    'Country': site.country || '',
    'Contact Person': site.contactPerson || '',
    'Contact Phone': site.contactPhone || '',
    'Contact Email': site.contactEmail || '',
    'Active': site.isActive ? 'Yes' : 'No',
  }));
}

/**
 * Format vendor data for export
 */
export function formatVendorsForExport(vendors: any[]): any[] {
  return vendors.map(vendor => ({
    'Vendor Name': vendor.name,
    'Vendor Code': vendor.vendorCode || '',
    'Contact Person': vendor.contactPerson || '',
    'Email': vendor.email || '',
    'Phone': vendor.phone || '',
    'Address': vendor.address || '',
    'City': vendor.city || '',
    'State': vendor.state || '',
    'Country': vendor.country || '',
    'Website': vendor.website || '',
    'Notes': vendor.notes || '',
    'Active': vendor.isActive ? 'Yes' : 'No',
  }));
}
