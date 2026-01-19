import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Assets from "./pages/Assets";
import AssetDetail from "./pages/AssetDetail";
import AssetMap from "./pages/AssetMap";
import WorkOrders from "./pages/WorkOrders";
import WorkOrderDetail from "./pages/WorkOrderDetail";
import Maintenance from "./pages/Maintenance";
import Inventory from "./pages/Inventory";
import Vendors from "./pages/Vendors";
import Financial from "./pages/Financial";
import Compliance from "./pages/Compliance";
import Sites from "./pages/Sites";
import Users from "./pages/Users";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/assets" component={Assets} />
      <Route path="/assets/:id" component={AssetDetail} />
      <Route path="/asset-map" component={AssetMap} />
      <Route path="/work-orders" component={WorkOrders} />
      <Route path="/work-orders/:id" component={WorkOrderDetail} />
      <Route path="/maintenance" component={Maintenance} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/vendors" component={Vendors} />
      <Route path="/financial" component={Financial} />
      <Route path="/compliance" component={Compliance} />
      <Route path="/sites" component={Sites} />
      <Route path="/users" component={Users} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <DashboardLayout>
            <Router />
          </DashboardLayout>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
