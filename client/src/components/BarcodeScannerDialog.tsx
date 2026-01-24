import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { useEffect } from 'react';
import { X, Scan } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (code: string, format: string) => void;
  title?: string;
  description?: string;
}

/**
 * Barcode scanner dialog component
 * Opens camera for scanning barcodes/QR codes
 */
export function BarcodeScannerDialog({
  open,
  onOpenChange,
  onScan,
  title = 'Scan Barcode',
  description = 'Position the barcode within the frame to scan',
}: BarcodeScannerDialogProps) {
  const {
    isScanning,
    isSupported,
    elementId,
    startScanning,
    stopScanning,
  } = useBarcodeScanner({
    onScan: (decodedText, format) => {
      onScan(decodedText, format);
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Scanner error:', error);
    },
  });

  // Start scanning when dialog opens
  useEffect(() => {
    if (open && isSupported) {
      startScanning();
    } else if (!open) {
      stopScanning();
    }

    return () => {
      stopScanning();
    };
  }, [open, isSupported, startScanning, stopScanning]);

  if (!isSupported) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Camera Not Available</DialogTitle>
            <DialogDescription>
              Your device doesn't have a camera or camera access is not permitted.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Scan className="h-5 w-5" />
              {title}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Scanner viewport */}
        <div className="relative">
          <div
            id={elementId}
            className="rounded-lg overflow-hidden bg-black"
            style={{ minHeight: '300px' }}
          />
          
          {isScanning && (
            <div className="absolute top-2 right-2">
              <Badge variant="default" className="bg-green-500">
                <span className="animate-pulse mr-1">●</span>
                Scanning
              </Badge>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="text-sm text-muted-foreground space-y-2">
          <p>• Hold your device steady</p>
          <p>• Ensure good lighting</p>
          <p>• Position the barcode within the frame</p>
          <p>• Supports QR codes, EAN, UPC, Code128, and more</p>
        </div>

        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="w-full"
        >
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
