import ExcelJS from 'exceljs';
import * as db from './db';

interface ImportError {
  row: number;
  field: string;
  value: any;
  message: string;
}

interface ImportResult {
  success: boolean;
  totalRows: number;
  successCount: number;
  failedCount: number;
  errors: ImportError[];
  createdAssets: any[];
}

/**
 * Parse and validate NRCS Excel file for asset import
 */
export async function parseAndValidateNRCSExcel(
  buffer: Buffer,
  userId: number
): Promise<ImportResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  
  const worksheet = workbook.getWorksheet('Assets');
  if (!worksheet) {
    throw new Error('Assets worksheet not found in Excel file');
  }

  // Load reference data for validation
  const [branchCodes, categoryCodes, subCategories, sites, categories] = await Promise.all([
    db.getAllBranchCodes(),
    db.getAllCategoryCodes(),
    db.getAllSubCategories(),
    db.getAllSites(),
    db.getAllAssetCategories(),
  ]);

  const branchCodeSet = new Set(branchCodes.map(b => b.code));
  const categoryCodeSet = new Set(categoryCodes.map(c => c.code));
  const subCategorySet = new Set(subCategories.map(s => s.name));
  const siteMap = new Map(sites.map(s => [s.name.toLowerCase(), s.id]));
  const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));

  const errors: ImportError[] = [];
  const createdAssets: any[] = [];
  let successCount = 0;
  let failedCount = 0;

  // Skip header row (row 1)
  const dataRows: any[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) { // Skip header
      dataRows.push({ row, rowNumber });
    }
  });

  const totalRows = dataRows.length;

  for (const { row, rowNumber } of dataRows) {
    const rowData = {
      assetCode: row.getCell(1).value?.toString().trim() || '',
      itemType: row.getCell(2).value?.toString().trim() || 'Asset',
      name: row.getCell(3).value?.toString().trim() || '',
      subCategory: row.getCell(4).value?.toString().trim() || '',
      branchCode: row.getCell(5).value?.toString().trim() || '',
      categoryCode: row.getCell(6).value?.toString().trim() || '',
      assetNumber: row.getCell(7).value?.toString().trim() || '',
      manufacturer: row.getCell(8).value?.toString().trim() || '',
      model: row.getCell(9).value?.toString().trim() || '',
      serialNumber: row.getCell(10).value?.toString().trim() || '',
      methodOfAcquisition: row.getCell(11).value?.toString().trim() || '',
      projectReference: row.getCell(12).value?.toString().trim() || '',
      yearAcquired: row.getCell(13).value ? Number(row.getCell(13).value) : undefined,
      acquiredCondition: row.getCell(14).value?.toString().trim() || '',
      acquisitionCost: row.getCell(15).value ? Number(row.getCell(15).value) : undefined,
      currentDepreciatedValue: row.getCell(16).value ? Number(row.getCell(16).value) : undefined,
      status: row.getCell(17).value?.toString().trim() || 'In Use',
      assignedToName: row.getCell(18).value?.toString().trim() || '',
      department: row.getCell(19).value?.toString().trim() || '',
      location: row.getCell(20).value?.toString().trim() || '',
      condition: row.getCell(21).value?.toString().trim() || '',
      lastPhysicalCheckDate: row.getCell(22).value ? new Date(row.getCell(22).value as any) : undefined,
      checkConductedBy: row.getCell(23).value?.toString().trim() || '',
      remarks: row.getCell(24).value?.toString().trim() || '',
    };

    // Validation
    const rowErrors: ImportError[] = [];

    // Required fields
    if (!rowData.assetCode) {
      rowErrors.push({
        row: rowNumber,
        field: 'Asset Code',
        value: rowData.assetCode,
        message: 'Asset Code is required'
      });
    }

    if (!rowData.name) {
      rowErrors.push({
        row: rowNumber,
        field: 'Item Name',
        value: rowData.name,
        message: 'Item Name is required'
      });
    }

    // Validate branch code
    if (rowData.branchCode && !branchCodeSet.has(rowData.branchCode)) {
      rowErrors.push({
        row: rowNumber,
        field: 'Branch Code',
        value: rowData.branchCode,
        message: `Invalid branch code: ${rowData.branchCode}`
      });
    }

    // Validate category code
    if (rowData.categoryCode && !categoryCodeSet.has(rowData.categoryCode)) {
      rowErrors.push({
        row: rowNumber,
        field: 'Category Code',
        value: rowData.categoryCode,
        message: `Invalid category code: ${rowData.categoryCode}`
      });
    }

    // Validate sub-category
    if (rowData.subCategory && !subCategorySet.has(rowData.subCategory)) {
      rowErrors.push({
        row: rowNumber,
        field: 'Sub-Category',
        value: rowData.subCategory,
        message: `Invalid sub-category: ${rowData.subCategory}`
      });
    }

    // Validate item type
    if (rowData.itemType && !['Asset', 'Inventory'].includes(rowData.itemType)) {
      rowErrors.push({
        row: rowNumber,
        field: 'Item Type',
        value: rowData.itemType,
        message: 'Item Type must be either "Asset" or "Inventory"'
      });
    }

    // If validation failed, skip this row
    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      failedCount++;
      continue;
    }

    // Try to create asset
    try {
      // Find site ID (use first site if location not found)
      let siteId = siteMap.get(rowData.location?.toLowerCase() || '');
      if (!siteId && sites.length > 0) {
        siteId = sites[0].id;
      }

      // Find category ID (use first category if not found)
      let categoryId = categoryMap.get('general') || categoryMap.get('other');
      if (!categoryId && categories.length > 0) {
        categoryId = categories[0].id;
      }

      if (!siteId || !categoryId) {
        throw new Error('Site or Category not found in system');
      }

      const asset = await db.createAsset({
        assetTag: rowData.assetCode,
        name: rowData.name,
        description: rowData.remarks || undefined,
        categoryId,
        siteId,
        manufacturer: rowData.manufacturer || undefined,
        model: rowData.model || undefined,
        serialNumber: rowData.serialNumber || undefined,
        location: rowData.location || undefined,
        // NRCS fields
        itemType: rowData.itemType,
        branchCode: rowData.branchCode || undefined,
        itemCategoryCode: rowData.categoryCode || undefined,
        subCategory: rowData.subCategory || undefined,
        productNumber: rowData.serialNumber || undefined,
        methodOfAcquisition: rowData.methodOfAcquisition || undefined,
        projectReference: rowData.projectReference || undefined,
        yearAcquired: rowData.yearAcquired || undefined,
        acquiredCondition: rowData.acquiredCondition || undefined,
        acquisitionCost: rowData.acquisitionCost?.toString() || undefined,
        currentDepreciatedValue: rowData.currentDepreciatedValue?.toString() || undefined,
        status: rowData.status,
        assignedToName: rowData.assignedToName || undefined,
        department: rowData.department || undefined,
        condition: rowData.condition || undefined,
        lastPhysicalCheckDate: rowData.lastPhysicalCheckDate || undefined,
        checkConductedBy: rowData.checkConductedBy || undefined,
        remarks: rowData.remarks || undefined,
      });

      createdAssets.push(asset);
      successCount++;
    } catch (error: any) {
      errors.push({
        row: rowNumber,
        field: 'Database',
        value: rowData.assetCode,
        message: `Failed to create asset: ${error.message}`
      });
      failedCount++;
    }
  }

  return {
    success: failedCount === 0,
    totalRows,
    successCount,
    failedCount,
    errors,
    createdAssets,
  };
}
