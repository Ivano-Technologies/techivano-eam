import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Box, Wrench, Camera, History } from "lucide-react";
import { toast } from "sonner";
import { useHaptic } from "@/hooks/useHaptic";

export default function SmartScanner() {
  const [, setLocation] = useLocation();
  const [isScanning, setIsScanning] = useState(false);
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const { vibrateSuccess, vibrateError } = useHaptic();

  // Get recent scans from localStorage
  const [recentScans, setRecentScans] = useState<Array<{
    code: string;
    type: string;
    timestamp: number;
  }>>([]);

  useEffect(() => {
    const stored = localStorage.getItem("recentScans");
    if (stored) {
      setRecentScans(JSON.parse(stored));
    }
  }, []);

  const saveRecentScan = (code: string, type: string) => {
    const newScan = { code, type, timestamp: Date.now() };
    const updated = [newScan, ...recentScans.filter(s => s.code !== code)].slice(0, 5);
    setRecentScans(updated);
    localStorage.setItem("recentScans", JSON.stringify(updated));
  };

  const handleScan = async (decodedText: string) => {
    vibrateSuccess();
    
    // Detect QR code type by prefix
    if (decodedText.startsWith("AST-")) {
      saveRecentScan(decodedText, "asset");
      toast.success("Asset QR Code detected!");
      const assetId = decodedText.replace("AST-", "");
      setLocation(`/assets/${assetId}`);
    } else if (decodedText.startsWith("INV-")) {
      saveRecentScan(decodedText, "inventory");
      toast.success("Inventory QR Code detected!");
      setLocation(`/inventory?search=${decodedText}`);
    } else if (decodedText.startsWith("WO-")) {
      saveRecentScan(decodedText, "workorder");
      toast.success("Work Order QR Code detected!");
      const woId = decodedText.replace("WO-", "");
      setLocation(`/work-orders/${woId}`);
    } else {
      vibrateError();
      toast.error("Unknown QR code format");
    }

    // Stop scanning after successful scan
    if (scanner) {
      await scanner.stop();
      setIsScanning(false);
    }
  };

  const startScanning = async () => {
    try {
      const html5QrCode = new Html5Qrcode("qr-reader");
      setScanner(html5QrCode);
      
      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        handleScan,
        () => {} // ignore errors
      );
      
      setIsScanning(true);
    } catch (err) {
      vibrateError();
      toast.error("Failed to start camera");
      console.error(err);
    }
  };

  const stopScanning = async () => {
    if (scanner) {
      await scanner.stop();
      setIsScanning(false);
      setScanner(null);
    }
  };

  const scanAsset = () => {
    toast.info("Scanning for Asset QR Codes...");
    startScanning();
  };

  const scanInventory = () => {
    toast.info("Scanning for Inventory QR Codes...");
    startScanning();
  };

  const scanWorkOrder = () => {
    toast.info("Scanning for Work Order QR Codes...");
    startScanning();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "asset": return <Package className="h-4 w-4" />;
      case "inventory": return <Box className="h-4 w-4" />;
      case "workorder": return <Wrench className="h-4 w-4" />;
      default: return null;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "asset": return "Asset";
      case "inventory": return "Inventory";
      case "workorder": return "Work Order";
      default: return "Unknown";
    }
  };

  const handleRecentScanClick = (scan: typeof recentScans[0]) => {
    if (scan.type === "asset") {
      const assetId = scan.code.replace("AST-", "");
      setLocation(`/assets/${assetId}`);
    } else if (scan.type === "inventory") {
      setLocation(`/inventory?search=${scan.code}`);
    } else if (scan.type === "workorder") {
      const woId = scan.code.replace("WO-", "");
      setLocation(`/work-orders/${woId}`);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Scan QR Code or Barcode</h1>
        <p className="text-muted-foreground">Choose what you want to scan</p>
      </div>

      {/* Camera Viewfinder */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div id="qr-reader" className="w-full min-h-[300px] bg-black flex items-center justify-center">
            {!isScanning && (
              <div className="text-white text-center p-6">
                <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-sm opacity-75">Camera will appear here</p>
              </div>
            )}
          </div>
          {isScanning && (
            <div className="p-4 bg-muted text-center">
              <p className="text-sm font-medium mb-2">Scanning...</p>
              <Button variant="outline" size="sm" onClick={stopScanning}>
                Stop Camera
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scan Type Buttons */}
      <div className="space-y-3">
        <Button
          className="w-full h-16 text-lg bg-blue-600 hover:bg-blue-700"
          onClick={scanAsset}
          disabled={isScanning}
        >
          <Package className="mr-3 h-6 w-6" />
          Scan Asset
        </Button>

        <Button
          className="w-full h-16 text-lg bg-green-600 hover:bg-green-700"
          onClick={scanInventory}
          disabled={isScanning}
        >
          <Box className="mr-3 h-6 w-6" />
          Scan Inventory
        </Button>

        <Button
          className="w-full h-16 text-lg bg-orange-600 hover:bg-orange-700"
          onClick={scanWorkOrder}
          disabled={isScanning}
        >
          <Wrench className="mr-3 h-6 w-6" />
          Scan Work Order
        </Button>
      </div>

      {/* Recent Scans */}
      {recentScans.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <History className="h-4 w-4" />
            Recent Scans
          </div>
          <div className="grid grid-cols-3 gap-2">
            {recentScans.map((scan, idx) => (
              <button
                key={idx}
                onClick={() => handleRecentScanClick(scan)}
                className="flex flex-col items-center gap-2 p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
              >
                {getTypeIcon(scan.type)}
                <span className="text-xs font-medium">{getTypeLabel(scan.type)}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
