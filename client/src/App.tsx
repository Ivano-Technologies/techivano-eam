import { lazy, Suspense } from "react";
import type { ComponentType } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthSession } from "@/contexts/AuthContext";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthRefreshHandler } from "./components/AuthRefreshHandler";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";
const DashboardLayout = lazy(() => import("./components/DashboardLayout"));

const NotFound = lazy(() => import("@/pages/NotFound"));
const Signup = lazy(() => import("./pages/Signup"));
const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const SetPassword = lazy(() => import("./pages/SetPassword"));
const VerifyMagicLink = lazy(() => import("./pages/VerifyMagicLink"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const MfaSetup = lazy(() => import("./pages/MfaSetup"));
const MfaVerify = lazy(() => import("./pages/MfaVerify"));
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
const Sessions = lazy(() => import("./pages/Sessions"));
const SmartScanner = lazy(() => import("./pages/SmartScanner"));
const BiometricSetup = lazy(() => import("./pages/BiometricSetup"));
const DepreciationDashboard = lazy(() => import("./pages/DepreciationDashboard"));
const WarehouseRebalanceDashboard = lazy(() => import("@/pages/WarehouseRebalanceDashboard"));
const WarehouseDashboard = lazy(() => import("@/pages/warehouse/WarehouseDashboard"));
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

function ProtectedRoute({ path, component: Component }: { path: string; component: ComponentType }) {
  const { session, loading } = useAuthSession();
  return (
    <Route path={path}>
      {() => {
        if (loading) return <PageFallback />;
        if (!session) {
          if (typeof window !== "undefined" && window.location.pathname !== "/login") {
            window.location.replace("/login");
          }
          return <PageFallback />;
        }
        return <Component />;
      }}
    </Route>
  );
}

function PublicOnlyRoute({ path, component: Component }: { path: string; component: ComponentType }) {
  const { session, loading } = useAuthSession();
  return (
    <Route path={path}>
      {() => {
        if (loading) return <PageFallback />;
        if (session) {
          if (typeof window !== "undefined" && window.location.pathname !== "/dashboard") {
            window.location.replace("/dashboard");
          }
          return <PageFallback />;
        }
        return <Component />;
      }}
    </Route>
  );
}

function Router() {
  return (
      <Switch>
        <PublicOnlyRoute path="/signup" component={Signup} />
        <PublicOnlyRoute path="/login" component={Login} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/set-password" component={SetPassword} />
        <Route path="/verify-magic-link" component={VerifyMagicLink} />
        <Route path="/auth/callback" component={AuthCallback} />
        <Route path="/mfa/setup" component={MfaSetup} />
        <Route path="/mfa/verify" component={MfaVerify} />
        <ProtectedRoute path="/welcome" component={Welcome} />
      <ProtectedRoute path="/dashboard" component={Home} />
      <ProtectedRoute path="/" component={Home} />
      <ProtectedRoute path="/assets" component={Assets} />
        <ProtectedRoute path="/assets/:id" component={AssetDetail} />
        <ProtectedRoute path="/scanner" component={AssetScanner} />
        <ProtectedRoute path="/offline-queue" component={OfflineQueue} />
        <ProtectedRoute path="/settings/theme" component={ThemeSettings} />
        <ProtectedRoute path="/settings/sessions" component={Sessions} />
        <ProtectedRoute path="/profile" component={Profile} />
        <ProtectedRoute path="/biometric-setup" component={BiometricSetup} />
        <ProtectedRoute path="/smart-scanner" component={SmartScanner} />
      <ProtectedRoute path="/asset-map" component={AssetMap} />
      <ProtectedRoute path="/warranty-alerts" component={WarrantyAlerts} />
      <ProtectedRoute path="/cost-analytics" component={CostAnalytics} />
      <ProtectedRoute path="/audit-trail" component={AuditTrail} />
      <ProtectedRoute path="/activity-log" component={ActivityLog} />
      <ProtectedRoute path="/work-orders" component={WorkOrders} />
      <ProtectedRoute path="/work-orders/:id" component={WorkOrderDetail} />
      <ProtectedRoute path="/mobile-work-orders" component={MobileWorkOrders} />
      <ProtectedRoute path="/mobile-work-order/:id" component={MobileWorkOrderDetail} />
      <ProtectedRoute path="/work-order-templates" component={WorkOrderTemplates} />
      <ProtectedRoute path="/maintenance" component={Maintenance} />
      <ProtectedRoute path="/inventory" component={Inventory} />
      <ProtectedRoute path="/warehouse" component={WarehouseDashboard} />
      <ProtectedRoute path="/warehouse-rebalance" component={WarehouseRebalanceDashboard} />
      <ProtectedRoute path="/vendor-intelligence" component={VendorIntelligenceDashboard} />
      <ProtectedRoute path="/procurement" component={ProcurementDashboard} />
      <ProtectedRoute path="/supply-chain-risk" component={SupplyChainRiskDashboard} />
      <ProtectedRoute path="/fleet-operations" component={FleetOperationsDashboard} />
      <ProtectedRoute path="/executive" component={ExecutiveDashboard} />
      <ProtectedRoute path="/vendors" component={Vendors} />
      <ProtectedRoute path="/financial" component={Financial} />
      <ProtectedRoute path="/depreciation" component={DepreciationDashboard} />
      <ProtectedRoute path="/compliance" component={Compliance} />
      <ProtectedRoute path="/sites" component={Sites} />
      <ProtectedRoute path="/users" component={Users} />
      <ProtectedRoute path="/pending-users" component={PendingUsers} />
      <ProtectedRoute path="/notification-preferences" component={NotificationPreferences} />
      <ProtectedRoute path="/reports" component={Reports} />
      <ProtectedRoute path="/report-scheduling" component={ReportScheduling} />
      <ProtectedRoute path="/quickbooks" component={QuickBooksSettings} />
      <ProtectedRoute path="/quickbooks/callback" component={QuickBooksCallback} />
        <ProtectedRoute path="/email-notifications" component={EmailNotifications} />
        <ProtectedRoute path="/dashboard-settings" component={DashboardSettings} />
      <Route path="/legal/terms" component={TermsOfService} />
      <Route path="/legal/privacy" component={PrivacyPolicy} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Marketing site disabled; single EAM app at techivano.com for all hosts.
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthRefreshHandler />
        <TooltipProvider>
          <Toaster />
          <PWAInstallPrompt />
          <Suspense fallback={<PageFallback />}>
            <DashboardLayout>
              <Suspense fallback={<PageFallback />}>
                <Router />
              </Suspense>
            </DashboardLayout>
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
