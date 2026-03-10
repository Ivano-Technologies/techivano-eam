import * as XLSX from 'xlsx';
import * as db from './db';
import { getDb } from './db';
import { importHistory } from '../drizzle/schema';

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * Parse CSV or Excel file data
 */
export function parseFileData(fileContent: string, fileType: 'csv' | 'excel'): any[] {
  try {
    if (fileType === 'csv') {
      // Parse CSV using xlsx library
      const workbook = XLSX.read(fileContent, { type: 'string' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      return XLSX.utils.sheet_to_json(worksheet);
    } else {
      // Parse Excel (base64 encoded)
      const workbook = XLSX.read(fileContent, { type: 'base64' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      return XLSX.utils.sheet_to_json(worksheet);
    }
  } catch (error) {
    throw new Error(`Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Bulk import assets
 */
export async function bulkImportAssets(
  data: any[],
  userId: number,
  fileName: string,
  fileType: 'csv' | 'excel',
  organizationId?: string | null
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: 0,
    failed: 0,
    errors: [],
  };

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 2; // +2 because Excel is 1-indexed and row 1 is header

    try {
      // Validate required fields
      if (!row.name || !row.assetTag || !row.categoryId || !row.siteId) {
        throw new Error('Missing required fields: name, assetTag, categoryId, or siteId');
      }

      // Create asset
      await db.createAsset({
        name: String(row.name),
        assetTag: String(row.assetTag),
        categoryId: Number(row.categoryId),
        siteId: Number(row.siteId),
        status: row.status || 'operational',
        manufacturer: row.manufacturer ? String(row.manufacturer) : undefined,
        model: row.model ? String(row.model) : undefined,
        serialNumber: row.serialNumber ? String(row.serialNumber) : undefined,
        description: row.description ? String(row.description) : undefined,
        acquisitionDate: row.acquisitionDate ? new Date(row.acquisitionDate) : undefined,
        acquisitionCost: row.acquisitionCost ? String(row.acquisitionCost) : undefined,
        currentValue: row.currentValue ? String(row.currentValue) : undefined,
        warrantyExpiry: row.warrantyExpiry ? new Date(row.warrantyExpiry) : undefined,
        ...(organizationId != null && organizationId !== '' ? { organizationId } : {}),
      });

      result.imported++;
    } catch (error) {
      result.failed++;
      result.errors.push({
        row: rowNumber,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  if (result.failed > 0) {
    result.success = false;
  }

  // Log import history
  const status = result.failed === 0 ? 'success' : (result.imported > 0 ? 'partial' : 'failed');
  const dbConn = await getDb();
  if (dbConn) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- schema is pg-core, getDb is mysql2 typed
    await dbConn.insert(importHistory as any).values({
    entityType: 'assets',
    fileName,
    fileType,
    importedBy: userId,
    totalRows: data.length,
    successCount: result.imported,
    failedCount: result.failed,
      errors: JSON.stringify(result.errors),
      status,
    });
  }

  return result;
}

/**
 * Bulk import sites
 */
export async function bulkImportSites(
  data: any[],
  userId: number,
  fileName: string,
  fileType: 'csv' | 'excel',
  organizationId?: string | null
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: 0,
    failed: 0,
    errors: [],
  };

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 2;

    try {
      // Validate required fields
      if (!row.name) {
        throw new Error('Missing required field: name');
      }

      // Create site
      await db.createSite({
        name: String(row.name),
        address: row.address ? String(row.address) : undefined,
        city: row.city ? String(row.city) : undefined,
        state: row.state ? String(row.state) : undefined,
        country: row.country ? String(row.country) : 'Nigeria',
        contactPerson: row.contactPerson ? String(row.contactPerson) : undefined,
        contactPhone: row.contactPhone ? String(row.contactPhone) : undefined,
        contactEmail: row.contactEmail ? String(row.contactEmail) : undefined,
        latitude: row.latitude ? String(row.latitude) : undefined,
        longitude: row.longitude ? String(row.longitude) : undefined,
        ...(organizationId != null && organizationId !== '' ? { organizationId } : {}),
      });

      result.imported++;
    } catch (error) {
      result.failed++;
      result.errors.push({
        row: rowNumber,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  result.success = result.failed === 0;
  return result;
}

/**
 * Bulk import vendors
 */
export async function bulkImportVendors(
  data: any[],
  userId: number,
  fileName: string,
  fileType: 'csv' | 'excel',
  organizationId?: string | null
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: 0,
    failed: 0,
    errors: [],
  };

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 2;

    try {
      // Validate required fields
      if (!row.name) {
        throw new Error('Missing required field: name');
      }

      // Create vendor
      await db.createVendor({
        name: String(row.name),
        contactPerson: row.contactPerson ? String(row.contactPerson) : undefined,
        email: row.email ? String(row.email) : undefined,
        phone: row.phone ? String(row.phone) : undefined,
        address: row.address ? String(row.address) : undefined,
        city: row.city ? String(row.city) : undefined,
        state: row.state ? String(row.state) : undefined,
        country: row.country ? String(row.country) : undefined,
        website: row.website ? String(row.website) : undefined,
        notes: row.notes ? String(row.notes) : undefined,
        ...(organizationId != null && organizationId !== '' ? { organizationId } : {}),
      });

      result.imported++;
    } catch (error) {
      result.failed++;
      result.errors.push({
        row: rowNumber,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  result.success = result.failed === 0;
  return result;
}

/**
 * Generate template for assets
 */
export function generateAssetsTemplate(format: 'csv' | 'excel'): string {
  const headers = [
    'name',
    'assetTag',
    'categoryId',
    'siteId',
    'status',
    'manufacturer',
    'model',
    'serialNumber',
    'description',
    'acquisitionDate',
    'acquisitionCost',
    'currentValue',
    'warrantyExpiry',
  ];

  const sampleData = [
    {
      name: 'Toyota Hilux Ambulance',
      assetTag: 'VEH-AMB-001',
      categoryId: 1,
      siteId: 1,
      status: 'operational',
      manufacturer: 'Toyota',
      model: 'Hilux 4x4',
      serialNumber: 'TH-2023-001',
      description: 'Emergency ambulance vehicle',
      acquisitionDate: '2023-01-15',
      acquisitionCost: 28500000,
      currentValue: 24000000,
      warrantyExpiry: '2026-01-15',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets');

  if (format === 'csv') {
    return XLSX.utils.sheet_to_csv(worksheet);
  } else {
    return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  }
}

/**
 * Generate template for sites
 */
export function generateSitesTemplate(format: 'csv' | 'excel'): string {
  const headers = [
    'name',
    'address',
    'city',
    'state',
    'country',
    'contactPerson',
    'contactPhone',
    'contactEmail',
    'latitude',
    'longitude',
  ];

  const sampleData = [
    {
      name: 'NRCS Lagos Headquarters',
      address: '11 Eko Akete Close, Victoria Island',
      city: 'Lagos',
      state: 'Lagos State',
      country: 'Nigeria',
      contactPerson: 'Dr. Abubakar Ibrahim',
      contactPhone: '+234-1-2614009',
      contactEmail: 'lagos@nrcs.org.ng',
      latitude: 6.4281,
      longitude: 3.4219,
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sites');

  if (format === 'csv') {
    return XLSX.utils.sheet_to_csv(worksheet);
  } else {
    return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  }
}

/**
 * Generate template for vendors
 */
export function generateVendorsTemplate(format: 'csv' | 'excel'): string {
  const headers = [
    'name',
    'contactPerson',
    'email',
    'phone',
    'address',
    'category',
  ];

  const sampleData = [
    {
      name: 'Global Medical Supplies Ltd',
      contactPerson: 'Mr. John Adeyemi',
      email: 'john@globalmedical.ng',
      phone: '+234-1-7654321',
      address: '45 Broad Street, Lagos',
      category: 'Medical Equipment',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Vendors');

  if (format === 'csv') {
    return XLSX.utils.sheet_to_csv(worksheet);
  } else {
    return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  }
}
