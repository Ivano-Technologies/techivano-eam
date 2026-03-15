import { lazy, Suspense, useState, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";

const DashboardLayout = lazy(() => import("./components/DashboardLayout"));
const Marketing = lazy(() => import("./pages/Marketing"));

const NotFound = lazy(() => import("@/pages/NotFound"));
const Signup = lazy(() => import("./pages/Signup"));
const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyMagicLink = lazy(() => import("./pages/VerifyMagicLink"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Welcome = lazy(() => import("@/pages/Welcome"));
const PendingUsers = lazy(() => import("./pages/PendingUsers"));
const Home = lazy(() => import("./pages/Home"));
const Assets = lazy(() => import("./pages/Assets"));
const AssetDetail = lazy(() => import("./pages/AssetDetail"));
const AssetScanner = lazy(() => import("./pages/AssetScanner"));
const OfflineQueue = lazy(() => import("./pages/OfflineQueue"));
const AssetMap = lazy(() => import("./pages/AssetMap"));
const WorkOrders = lazy(() => import("./pages/WorkOrders"));
const WorkOrderDetail = lazy(() => import("./pages/WorkOrderDetail"));
const Maintenance = lazy(() => import("./pages/Maintenance"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Vendors = lazy(() => import("./pages/Vendors"));
const Financial = lazy(() => import("./pages/Financial"));
const Compliance = lazy(() => import("./pages/Compliance"));
const Sites = lazy(() => import("./pages/Sites"));
const Users = lazy(() => import("./pages/Users"));
const NotificationPreferences = lazy(() => import("./pages/NotificationPreferences"));
const Reports = lazy(() => import("./pages/Reports"));
const QuickBooksSettings = lazy(() => import("./pages/QuickBooksSettings"));
const QuickBooksCallback = lazy(() => import("./pages/QuickBooksCallback"));
const EmailNotifications = lazy(() => import("./pages/EmailNotifications"));
const DashboardSettings = lazy(() => import("./pages/DashboardSettings"));
const WorkOrderTemplates = lazy(() => import("./pages/WorkOrderTemplates"));
const ReportScheduling = lazy(() => import("./pages/ReportScheduling"));
const MobileWorkOrders = lazy(() => import("./pages/MobileWorkOrders"));
const MobileWorkOrderDetail = lazy(() => import("./pages/MobileWorkOrderDetail"));
const WarrantyAlerts = lazy(() => import("./pages/WarrantyAlerts"));
const CostAnalytics = lazy(() => import("./pages/CostAnalytics"));
const AuditTrail = lazy(() => import("./pages/AuditTrail"));
const ActivityLog = lazy(() => import("./pages/ActivityLog"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const ThemeSettings = lazy(() => import("./pages/ThemeSettings"));
const Profile = lazy(() => import("./pages/Profile"));
const SmartScanner = lazy(() => import("./pages/SmartScanner"));
const BiometricSetup = lazy(() => import("./pages/BiometricSetup"));
const DepreciationDashboard = lazy(() => import("./pages/DepreciationDashboard"));
const WarehouseRebalanceDashboard = lazy(() => import("@/pages/WarehouseRebalanceDashboard"));
const VendorIntelligenceDashboard = lazy(() => import("./pages/VendorIntelligenceDashboard"));
const ProcurementDashboard = lazy(() => import("@/pages/ProcurementDashboard"));
const SupplyChainRiskDashboard = lazy(() => import("@/pages/SupplyChainRiskDashboard"));
const FleetOperationsDashboard = lazy(() => import("@/pages/FleetOperationsDashboard"));
const ExecutiveDashboard = lazy(() => import("./pages/ExecutiveDashboard"));

function PageFallback() {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 bg-slate-50 text-slate-600">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
      <span className="text-sm">Loading…</span>
    </div>
  );
}

function Router() {
  return (
      <Switch>
        <Route path="/signup" component={Signup} />
        <Route path="/login" component={Login} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/verify-magic-link" component={VerifyMagicLink} />
        <Route path="/auth/callback" component={AuthCallback} />
        <Route path="/welcome" component={Welcome} />
      <Route path="/" component={Home} />
      <Route path="/assets" component={Assets} />
        <Route path="/assets/:id" component={AssetDetail} />
        <Route path="/scanner" component={AssetScanner} />
        <Route path="/offline-queue" component={OfflineQueue} />
        <Route path="/settings/theme" component={ThemeSettings} />
        <Route path="/profile" component={Profile} />
        <Route path="/biometric-setup" component={BiometricSetup} />
        <Route path="/smart-scanner" component={SmartScanner} />
      <Route path="/asset-map" component={AssetMap} />
      <Route path="/warranty-alerts" component={WarrantyAlerts} />
      <Route path="/cost-analytics" component={CostAnalytics} />
      <Route path="/audit-trail" component={AuditTrail} />
      <Route path="/activity-log" component={ActivityLog} />
      <Route path="/work-orders" component={WorkOrders} />
      <Route path="/work-orders/:id" component={WorkOrderDetail} />
      <Route path="/mobile-work-orders" component={MobileWorkOrders} />
      <Route path="/mobile-work-order/:id" component={MobileWorkOrderDetail} />
      <Route path="/work-order-templates" component={WorkOrderTemplates} />
      <Route path="/maintenance" component={Maintenance} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/warehouse-rebalance" component={WarehouseRebalanceDashboard} />
      <Route path="/vendor-intelligence" component={VendorIntelligenceDashboard} />
      <Route path="/procurement" component={ProcurementDashboard} />
      <Route path="/supply-chain-risk" component={SupplyChainRiskDashboard} />
      <Route path="/fleet-operations" component={FleetOperationsDashboard} />
      <Route path="/executive" component={ExecutiveDashboard} />
      <Route path="/vendors" component={Vendors} />
      <Route path="/financial" component={Financial} />
      <Route path="/depreciation" component={DepreciationDashboard} />
      <Route path="/compliance" component={Compliance} />
      <Route path="/sites" component={Sites} />
      <Route path="/users" component={Users} />
      <Route path="/pending-users" component={PendingUsers} />
      <Route path="/notification-preferences" component={NotificationPreferences} />
      <Route path="/reports" component={Reports} />
      <Route path="/report-scheduling" component={ReportScheduling} />
      <Route path="/quickbooks" component={QuickBooksSettings} />
      <Route path="/quickbooks/callback" component={QuickBooksCallback} />
        <Route path="/email-notifications" component={EmailNotifications} />
        <Route path="/dashboard-settings" component={DashboardSettings} />
      <Route path="/legal/terms" component={TermsOfService} />
      <Route path="/legal/privacy" component={PrivacyPolicy} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

/** True when host is techivano.com or www.techivano.com (apex marketing). */
function useIsApexHost() {
  const [isApex, setIsApex] = useState(false);
  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    setIsApex(host === "techivano.com" || host === "www.techivano.com");
  }, []);
  return isApex;
}

function App() {
  const isApex = useIsApexHost();

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <PWAInstallPrompt />
          {isApex ? (
            <Suspense fallback={<PageFallback />}>
              <Marketing />
            </Suspense>
          ) : (
            <Suspense fallback={<PageFallback />}>
              <DashboardLayout>
                <Suspense fallback={<PageFallback />}>
                  <Router />
                </Suspense>
              </DashboardLayout>
            </Suspense>
          )}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
