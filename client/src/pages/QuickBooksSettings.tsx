import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, RefreshCw, Save } from "lucide-react";

export default function QuickBooksSettings() {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [realmId, setRealmId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: config, refetch: refetchConfig } = trpc.quickbooks.getConfig.useQuery();
  const { data: connectionStatus, refetch: refetchConnection } = trpc.quickbooks.testConnection.useQuery();
  const saveConfigMutation = trpc.quickbooks.saveConfig.useMutation();
  const syncMutation = trpc.quickbooks.syncTransactions.useMutation();

  useEffect(() => {
    if (config) {
      setClientId(config.clientId || "");
      setClientSecret(config.clientSecret || "");
      setRealmId(config.realmId || "");
    }
  }, [config]);

  const handleSaveConfig = async () => {
    if (!clientId || !clientSecret || !realmId) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSaving(true);
    try {
      await saveConfigMutation.mutateAsync({
        clientId,
        clientSecret,
        redirectUri: `${window.location.origin}/quickbooks/callback`,
        realmId,
      });
      toast.success("QuickBooks configuration saved successfully");
      refetchConfig();
      refetchConnection();
    } catch (error: any) {
      toast.error(error.message || "Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnect = () => {
    if (!clientId) {
      toast.error("Please save configuration first");
      return;
    }

    const authUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      `${window.location.origin}/quickbooks/callback`
    )}&response_type=code&scope=com.intuit.quickbooks.accounting&state=${Math.random().toString(36)}`;

    window.location.href = authUrl;
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncMutation.mutateAsync();
      toast.success(`Synced ${result.synced} transactions successfully`);
      if (result.failed > 0) {
        toast.warning(`${result.failed} transactions failed to sync`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to sync transactions");
    } finally {
      setIsSyncing(false);
    }
  };

  const isConnected = connectionStatus?.connected;
  const lastSync = config?.lastSyncAt ? new Date(config.lastSyncAt).toLocaleString() : "Never";
  const isFormValid = clientId.trim() !== "" && clientSecret.trim() !== "" && realmId.trim() !== "";

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-navy-900">QuickBooks Integration</h1>
        <p className="text-gray-600 mt-2 text-sm sm:text-base">
          Connect your NRCS EAM system to QuickBooks for automatic financial transaction sync
        </p>
      </div>

      {/* Connection Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Connection Status
            {isConnected ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
          </CardTitle>
          <CardDescription>
            {isConnected
              ? "Your QuickBooks account is connected and ready to sync"
              : "Not connected to QuickBooks"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={isConnected ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Sync:</span>
              <span className="font-medium">{lastSync}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Auto Sync:</span>
              <span className="font-medium">{config?.autoSync ? "Enabled" : "Disabled"}</span>
            </div>
          </div>

          {isConnected && (
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <Button onClick={handleSync} disabled={isSyncing} className="bg-navy-900 hover:bg-navy-800">
                {isSyncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync Now
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => refetchConnection()}>
                Test Connection
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>QuickBooks Configuration</CardTitle>
          <CardDescription>
            Enter your QuickBooks API credentials. You can obtain these from the{" "}
            <a
              href="https://developer.intuit.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-600 hover:underline"
            >
              Intuit Developer Portal
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="clientId">Client ID *</Label>
              <Input
                id="clientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Enter your QuickBooks Client ID"
                className="border-gray-300 focus:border-red-600 focus:ring-red-600"
              />
            </div>

            <div>
              <Label htmlFor="clientSecret">Client Secret *</Label>
              <Input
                id="clientSecret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Enter your QuickBooks Client Secret"
                className="border-gray-300 focus:border-red-600 focus:ring-red-600"
              />
            </div>

            <div>
              <Label htmlFor="realmId">Company ID (Realm ID) *</Label>
              <Input
                id="realmId"
                value={realmId}
                onChange={(e) => setRealmId(e.target.value)}
                placeholder="Enter your QuickBooks Company ID"
                className="border-gray-300 focus:border-red-600 focus:ring-red-600"
              />
              <p className="text-sm text-gray-500 mt-1">
                This is your QuickBooks company identifier
              </p>
            </div>
          </div>
        </CardContent>
        
        {/* Action Buttons Section - Separated for visibility */}
        <CardContent className="border-t bg-gray-50/50 pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={handleSaveConfig} 
              disabled={isSaving || !isFormValid} 
              className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
              size="lg"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Configuration...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Configuration
                </>
              )}
            </Button>

            {config && !isConnected && (
              <Button 
                onClick={handleConnect} 
                variant="outline" 
                className="border-navy-900 text-navy-900 hover:bg-navy-50 w-full sm:w-auto"
                size="lg"
              >
                Connect to QuickBooks
              </Button>
            )}

            {!config && (
              <p className="text-sm text-gray-600 flex items-center mt-2 sm:mt-0">
                💡 Save your configuration first, then connect to QuickBooks
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Help Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
            <li>Create a QuickBooks app at the Intuit Developer Portal</li>
            <li>Copy your Client ID and Client Secret from the app settings</li>
            <li>Add the redirect URI: <code className="bg-gray-100 px-2 py-1 rounded text-xs">{window.location.origin}/quickbooks/callback</code></li>
            <li>Enter your credentials above and click <strong>"Save Configuration"</strong></li>
            <li>Click "Connect to QuickBooks" to authorize the integration</li>
            <li>Once connected, transactions will automatically sync to QuickBooks</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
