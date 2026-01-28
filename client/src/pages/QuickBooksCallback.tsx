import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function QuickBooksCallback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Processing QuickBooks authorization...");
  
  const exchangeCodeMutation = trpc.quickbooks.exchangeCode.useMutation();

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Parse URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const realmId = urlParams.get("realmId");
        const error = urlParams.get("error");
        const errorDescription = urlParams.get("error_description");

        // Check for OAuth errors
        if (error) {
          setStatus("error");
          setMessage(errorDescription || `Authorization failed: ${error}`);
          return;
        }

        // Validate required parameters
        if (!code || !realmId) {
          setStatus("error");
          setMessage("Missing authorization code or company ID. Please try again.");
          return;
        }

        // Exchange code for tokens
        await exchangeCodeMutation.mutateAsync({
          code,
          realmId,
        });

        setStatus("success");
        setMessage("Successfully connected to QuickBooks! Redirecting...");
        
        // Redirect to QuickBooks settings after 2 seconds
        setTimeout(() => {
          setLocation("/quickbooks");
        }, 2000);
      } catch (error: any) {
        console.error("QuickBooks callback error:", error);
        setStatus("error");
        setMessage(error.message || "Failed to complete QuickBooks authorization");
      }
    };

    processCallback();
  }, [exchangeCodeMutation, setLocation]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status === "processing" && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
            {status === "success" && <CheckCircle className="h-5 w-5 text-green-600" />}
            {status === "error" && <XCircle className="h-5 w-5 text-red-600" />}
            QuickBooks Authorization
          </CardTitle>
          <CardDescription>
            {status === "processing" && "Connecting to QuickBooks..."}
            {status === "success" && "Connection successful"}
            {status === "error" && "Connection failed"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-700">{message}</p>
            
            {status === "processing" && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            )}
            
            {status === "success" && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  ✓ QuickBooks connected successfully<br />
                  ✓ Access tokens saved<br />
                  ✓ Ready to sync transactions
                </p>
              </div>
            )}
            
            {status === "error" && (
              <div className="space-y-3">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">
                    {message}
                  </p>
                </div>
                <Button 
                  onClick={() => setLocation("/quickbooks")} 
                  className="w-full bg-navy-900 hover:bg-navy-800"
                >
                  Return to QuickBooks Settings
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
