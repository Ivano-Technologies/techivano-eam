// @ts-nocheck — db query result types
import ExcelJS from 'exceljs';
import * as db from './db';

/**
 * Generate NRCS Asset Register Excel template matching official format
 */
export async function generateNRCSAssetTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  
  // README Sheet
  const readmeSheet = workbook.addWorksheet('README');
  readmeSheet.getColumn(1).width = 80;
  
  readmeSheet.addRow(['NRCS ASSET REGISTER - IMPORT TEMPLATE']);
  readmeSheet.addRow(['']);
  readmeSheet.addRow(['INSTRUCTIONS:']);
  readmeSheet.addRow(['1. Fill in the "Assets" sheet with your asset data']);
  readmeSheet.addRow(['2. Use the reference sheets (Branch Codes, Categories, Sub-Categories) for valid values']);
  readmeSheet.addRow(['3. Required fields are marked with * in the header']);
  readmeSheet.addRow(['4. Asset Code Format: NRCS_[BRANCH][CATEGORY][NUMBER] (e.g., NRCS_NHQCO0001)']);
  readmeSheet.addRow(['']);
  readmeSheet.addRow(['ASSET vs INVENTORY CLASSIFICATION:']);
  readmeSheet.addRow(['- ASSET: Cost > NGN 1,000,000 AND Useful Life >= 3 years']);
  readmeSheet.addRow(['- INVENTORY: Cost NGN 100,000 - 1,000,000 OR Useful Life < 3 years']);
  readmeSheet.addRow(['']);
  readmeSheet.addRow(['DEPRECIATION RATES (Straight-Line Method):']);
  readmeSheet.addRow(['- Motor Vehicles: 5 years (20% annual)']);
  readmeSheet.addRow(['- Furniture: 10 years (10% annual)']);
  readmeSheet.addRow(['- IT Equipment: 3 years (33% annual)']);
  readmeSheet.addRow(['- Buildings: 50 years (2% annual)']);
  readmeSheet.addRow(['']);
  readmeSheet.addRow(['METHOD OF ACQUISITION OPTIONS:']);
  readmeSheet.addRow(['- ICRC, IFRC, Other Donor, Project, Internal, Other']);
  
  // Style README
  readmeSheet.getRow(1).font = { bold: true, size: 14 };
  readmeSheet.getRow(3).font = { bold: true };
  readmeSheet.getRow(9).font = { bold: true };
  readmeSheet.getRow(14).font = { bold: true };
  readmeSheet.getRow(20).font = { bold: true };
  
  // Assets Sheet
  const assetsSheet = workbook.addWorksheet('Assets');
  
  const headers = [
    'Asset Code *',
    'Item Type *',
    'Item Name/Description *',
    'Sub-Category',
    'Branch Code *',
    'Category Code *',
    'Asset Number',
    'Manufacturer/Make',
    'Model',
    'Serial/Product Number',
    'Method of Acquisition',
    'Project Reference',
    'Year Acquired',
    'Acquired Condition',
    'Acquisition Cost (NGN)',
    'Current Depreciated Value (NGN)',
    'Status',
    'Assigned To (Name)',
    'Department',
    'Location',
    'Physical Condition',
    'Last Physical Check Date',
    'Check Conducted By',
    'Remarks'
  ];
  
  assetsSheet.addRow(headers);
  
  // Style header row
  const headerRow = assetsSheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0070C0' }
  };
  headerRow.height = 30;
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  
  // Set column widths
  assetsSheet.columns = [
    { width: 20 }, // Asset Code
    { width: 12 }, // Item Type
    { width: 35 }, // Name
    { width: 20 }, // Sub-Category
    { width: 15 }, // Branch Code
    { width: 15 }, // Category Code
    { width: 12 }, // Asset Number
    { width: 20 }, // Manufacturer
    { width: 20 }, // Model
    { width: 25 }, // Serial Number
    { width: 20 }, // Method of Acquisition
    { width: 25 }, // Project Reference
    { width: 12 }, // Year Acquired
    { width: 15 }, // Acquired Condition
    { width: 18 }, // Acquisition Cost
    { width: 22 }, // Current Value
    { width: 15 }, // Status
    { width: 25 }, // Assigned To
    { width: 20 }, // Department
    { width: 25 }, // Location
    { width: 18 }, // Condition
    { width: 18 }, // Check Date
    { width: 25 }, // Conducted By
    { width: 35 }  // Remarks
  ];
  
  // Add sample row
  assetsSheet.addRow([
    'NRCS_NHQCO0001',
    'Asset',
    'Dell Latitude 7420 Laptop',
    'Laptop',
    'NHQ',
    'CO',
    '1',
    'Dell',
    'Latitude 7420',
    'SN123456789',
    'ICRC',
    'Digital Transformation Project',
    new Date().getFullYear(),
    'New',
    '1500000',
    '1350000',
    'In Use',
    'John Doe',
    'IT Department',
    'HQ Office Block A',
    'Excellent',
    new Date().toISOString().split('T')[0],
    'Asset Manager',
    'Purchased for staff productivity'
  ]);
  
  // Branch Codes Reference Sheet
  const branchSheet = workbook.addWorksheet('Branch Codes');
  branchSheet.addRow(['Code', 'Name', 'State']);
  
  const branchCodes = await db.getAllBranchCodes();
  branchCodes.forEach(branch => {
    branchSheet.addRow([branch.code, branch.name, branch.state || 'N/A']);
  });
  
  branchSheet.getRow(1).font = { bold: true };
  branchSheet.columns = [
    { width: 12 },
    { width: 30 },
    { width: 20 }
  ];
  
  // Category Codes Reference Sheet
  const categorySheet = workbook.addWorksheet('Category Codes');
  categorySheet.addRow(['Code', 'Name', 'Useful Life (Years)', 'Depreciation Rate (%)']);
  
  const categoryCodes = await db.getAllCategoryCodes();
  categoryCodes.forEach(cat => {
    categorySheet.addRow([
      cat.code,
      cat.name,
      cat.usefulLifeYears,
      parseFloat(cat.depreciationRate as any) * 100
    ]);
  });
  
  categorySheet.getRow(1).font = { bold: true };
  categorySheet.columns = [
    { width: 12 },
    { width: 30 },
    { width: 20 },
    { width: 22 }
  ];
  
  // Sub-Categories Reference Sheet
  const subCatSheet = workbook.addWorksheet('Sub-Categories');
  subCatSheet.addRow(['Sub-Category', 'Type', 'Parent Category']);
  
  const subCategories = await db.getAllSubCategories();
  subCategories.forEach(sub => {
    subCatSheet.addRow([sub.name, sub.categoryType || 'Both', sub.parentCategory || 'General']);
  });
  
  subCatSheet.getRow(1).font = { bold: true };
  subCatSheet.columns = [
    { width: 30 },
    { width: 15 },
    { width: 25 }
  ];
  
  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Export assets to NRCS Excel format
 */
export async function exportAssetsToNRCSFormat(assets: any[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('NRCS Asset Register');
  
  const headers = [
    'Asset Code',
    'Item Type',
    'Item Name/Description',
    'Sub-Category',
    'Branch Code',
    'Category Code',
    'Asset Number',
    'Manufacturer/Make',
    'Model',
    'Serial/Product Number',
    'Method of Acquisition',
    'Project Reference',
    'Year Acquired',
    'Acquired Condition',
    'Acquisition Cost (NGN)',
    'Current Depreciated Value (NGN)',
    'Status',
    'Assigned To (Name)',
    'Department',
    'Location',
    'Physical Condition',
    'Last Physical Check Date',
    'Check Conducted By',
    'Remarks'
  ];
  
  sheet.addRow(headers);
  
  // Style header
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0070C0' }
  };
  headerRow.height = 30;
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  
  // Add data rows
  assets.forEach(asset => {
    sheet.addRow([
      asset.assetTag,
      asset.itemType || 'Asset',
      asset.name,
      asset.subCategory,
      asset.branchCode,
      asset.itemCategoryCode,
      asset.assetNumber,
      asset.manufacturer,
      asset.model,
      asset.productNumber || asset.serialNumber,
      asset.methodOfAcquisition,
      asset.projectReference,
      asset.yearAcquired,
      asset.acquiredCondition,
      asset.acquisitionCost,
      asset.currentDepreciatedValue,
      asset.status,
      asset.assignedToName,
      asset.department,
      asset.location,
      asset.condition,
      asset.lastPhysicalCheckDate ? new Date(asset.lastPhysicalCheckDate).toISOString().split('T')[0] : '',
      asset.checkConductedBy,
      asset.remarks
    ]);
  });
  
  // Auto-fit columns
  sheet.columns.forEach(column => {
    let maxLength = 0;
    column.eachCell?.({ includeEmpty: true }, cell => {
      const cellLength = cell.value ? cell.value.toString().length : 10;
      if (cellLength > maxLength) {
        maxLength = cellLength;
      }
    });
    column.width = Math.min(maxLength + 2, 50);
  });
  
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
