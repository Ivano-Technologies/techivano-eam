import QRCode from 'qrcode';

/**
 * Generate QR code as data URL for an asset
 * @param assetId - The asset ID
 * @param assetTag - The asset tag for the QR code content
 * @returns Promise<string> - Base64 data URL of the QR code
 */
export async function generateAssetQRCode(assetId: number, assetTag: string): Promise<string> {
  // Create URL that links to asset detail page
  const baseUrl = process.env.VITE_APP_URL || 'https://your-app-url.com';
  const assetUrl = `${baseUrl}/assets/${assetId}`;
  
  // Generate QR code with asset information
  const qrData = JSON.stringify({
    assetId,
    assetTag,
    url: assetUrl,
    type: 'NRCS_ASSET',
  });
  
  try {
    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    
    return qrCodeDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate QR code as buffer for printing
 * @param assetId - The asset ID
 * @param assetTag - The asset tag
 * @returns Promise<Buffer> - PNG buffer of the QR code
 */
export async function generateAssetQRCodeBuffer(assetId: number, assetTag: string): Promise<Buffer> {
  const baseUrl = process.env.VITE_APP_URL || 'https://your-app-url.com';
  const assetUrl = `${baseUrl}/assets/${assetId}`;
  
  const qrData = JSON.stringify({
    assetId,
    assetTag,
    url: assetUrl,
    type: 'NRCS_ASSET',
  });
  
  try {
    const buffer = await QRCode.toBuffer(qrData, {
      errorCorrectionLevel: 'H',
      type: 'png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    
    return buffer;
  } catch (error) {
    console.error('Error generating QR code buffer:', error);
    throw new Error('Failed to generate QR code buffer');
  }
}

/**
 * Parse QR code data to extract asset information
 * @param qrData - The scanned QR code data string
 * @returns Object with asset information or null if invalid
 */
export function parseAssetQRCode(qrData: string): { assetId: number; assetTag: string; url: string } | null {
  try {
    const parsed = JSON.parse(qrData);
    
    if (parsed.type === 'NRCS_ASSET' && parsed.assetId && parsed.assetTag) {
      return {
        assetId: parsed.assetId,
        assetTag: parsed.assetTag,
        url: parsed.url,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing QR code data:', error);
    return null;
  }
}
