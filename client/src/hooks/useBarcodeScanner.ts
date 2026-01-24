import { useState, useCallback, useRef, useEffect } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { toast } from 'sonner';

interface BarcodeScannerOptions {
  onScan: (decodedText: string, format: string) => void;
  onError?: (error: string) => void;
  fps?: number;
  qrbox?: number;
}

/**
 * Hook for barcode/QR code scanning using device camera
 * Supports multiple barcode formats including QR, EAN, UPC, Code128, etc.
 */
export function useBarcodeScanner(options: BarcodeScannerOptions) {
  const { onScan, onError, fps = 10, qrbox = 250 } = options;
  
  const [isScanning, setIsScanning] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const elementIdRef = useRef<string>(`barcode-scanner-${Date.now()}`);

  useEffect(() => {
    // Check camera support
    Html5Qrcode.getCameras()
      .then(cameras => {
        setIsSupported(cameras && cameras.length > 0);
      })
      .catch(() => {
        setIsSupported(false);
      });

    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = useCallback(async () => {
    if (!isSupported) {
      const message = 'Camera not available on this device';
      if (onError) {
        onError(message);
      } else {
        toast.error(message);
      }
      return false;
    }

    if (isScanning) {
      return true;
    }

    try {
      // Initialize scanner if not already done
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(elementIdRef.current);
      }

      // Configure supported formats (all common barcode types)
      const config = {
        fps,
        qrbox,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.ITF,
        ],
      };

      // Start scanning with back camera (environment facing)
      await scannerRef.current.start(
        { facingMode: 'environment' },
        config,
        (decodedText, decodedResult) => {
          onScan(decodedText, decodedResult.result.format?.formatName || 'UNKNOWN');
        },
        (errorMessage) => {
          // Ignore frequent scanning errors (no code in frame)
          // Only log actual errors
          if (!errorMessage.includes('No MultiFormat Readers')) {
            console.debug('Scan error:', errorMessage);
          }
        }
      );

      setIsScanning(true);
      return true;
    } catch (error: any) {
      console.error('Failed to start scanner:', error);
      
      const message = error.message || 'Failed to start camera';
      if (onError) {
        onError(message);
      } else {
        toast.error(message);
      }
      
      setIsScanning(false);
      return false;
    }
  }, [isSupported, isScanning, fps, qrbox, onScan, onError]);

  const stopScanning = useCallback(async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        setIsScanning(false);
      } catch (error) {
        console.error('Failed to stop scanner:', error);
      }
    }
  }, [isScanning]);

  const toggleScanning = useCallback(async () => {
    if (isScanning) {
      await stopScanning();
    } else {
      await startScanning();
    }
  }, [isScanning, startScanning, stopScanning]);

  return {
    isScanning,
    isSupported,
    elementId: elementIdRef.current,
    startScanning,
    stopScanning,
    toggleScanning,
  };
}
