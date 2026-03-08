import { X, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  MapPin,
  Users,
  Mail,
  DollarSign,
  FileText,
  Calendar,
  BarChart3,
  Settings,
  Shield,
  Boxes,
  TrendingUp,
  Clock,
  Building2,
  AlertCircle,
  BookOpen,
} from "lucide-react";

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const secondaryFeatures = [
  { icon: MapPin, label: "Asset Map", path: "/asset-map", color: "from-blue-500 to-blue-600" },
  { icon: Boxes, label: "Inventory", path: "/inventory", color: "from-purple-500 to-purple-600" },
  { icon: Calendar, label: "Maintenance", path: "/maintenance", color: "from-orange-500 to-orange-600" },
  { icon: Clock, label: "Warranty Alerts", path: "/warranty-alerts", color: "from-yellow-500 to-yellow-600" },
  { icon: Building2, label: "Sites", path: "/sites", color: "from-green-500 to-green-600" },
  { icon: Users, label: "Users", path: "/users", color: "from-indigo-500 to-indigo-600" },
  { icon: DollarSign, label: "Financial", path: "/financial", color: "from-emerald-500 to-emerald-600" },
  { icon: TrendingUp, label: "Depreciation", path: "/depreciation", color: "from-teal-500 to-teal-600" },
  { icon: FileText, label: "Reports", path: "/reports", color: "from-pink-500 to-pink-600" },
  { icon: BarChart3, label: "Analytics", path: "/asset-health", color: "from-cyan-500 to-cyan-600" },
  { icon: Calendar, label: "Inspections", path: "/inspections", color: "from-orange-500 to-orange-600" },
  { icon: AlertCircle, label: "Compliance Dashboard", path: "/compliance-dashboard", color: "from-amber-500 to-amber-600" },
  { icon: Mail, label: "Email Notifications", path: "/email-notifications", color: "from-red-500 to-red-600" },
  { icon: AlertCircle, label: "Compliance", path: "/compliance", color: "from-amber-500 to-amber-600" },
  { icon: BookOpen, label: "Audit Trail", path: "/audit-trail", color: "from-violet-500 to-violet-600" },
  { icon: BookOpen, label: "Audit Logs", path: "/audit-logs", color: "from-violet-500 to-violet-600" },
  { icon: Shield, label: "Profile", path: "/profile", color: "from-slate-500 to-slate-600" },
  { icon: Settings, label: "Settings", path: "/settings", color: "from-gray-500 to-gray-600" },
];

export function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isPortrait, setIsPortrait] = useState(true);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  // Detect orientation
  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);
    
    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  // Filter features based on search
  const filteredFeatures = secondaryFeatures.filter((feature) =>
    feature.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFeatureClick = (path: string) => {
    setLocation(path);
    onClose();
  };

  // Swipe-down gesture to close drawer
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (touchStart - touchEnd < -100) {
      // Swiped down more than 100px
      onClose();
    }
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Determine grid columns based on orientation
  const gridCols = isPortrait ? "grid-cols-2" : "grid-cols-4";

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 md:hidden",
          "glass dark:glass-dark rounded-t-3xl shadow-2xl",
          "transition-transform duration-300 ease-out",
          isOpen ? "translate-y-0" : "translate-y-full"
        )}
        style={{
          maxHeight: isPortrait ? "75vh" : "90vh",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle bar for swipe gesture indication */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4 border-b border-border/50">
          <h2 className="text-lg font-bold">All Features</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-accent/50 transition-colors active:scale-95"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background/50 focus:outline-none focus:ring-2 focus:ring-[#DC2626] transition-all"
            />
          </div>
        </div>

        {/* Features Grid */}
        <div className="px-6 pb-6 pt-2 overflow-y-auto" style={{ maxHeight: isPortrait ? "calc(75vh - 160px)" : "calc(90vh - 160px)" }}>
          <div className={cn("grid gap-3", gridCols)}>
            {filteredFeatures.map((feature) => {
              const Icon = feature.icon;
              const isActive = location === feature.path;
              
              return (
                <button
                  key={feature.path}
                  onClick={() => handleFeatureClick(feature.path)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-2xl transition-all duration-200",
                    "glass dark:glass-dark border border-border/50",
                    "hover:shadow-lg hover:-translate-y-0.5 active:scale-95",
                    isActive && "ring-2 ring-[#DC2626] bg-[#DC2626]/10"
                  )}
                >
                  <div className={cn(
                    "p-3 rounded-xl bg-gradient-to-br shadow-md",
                    feature.color
                  )}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-xs font-medium text-center leading-tight">
                    {feature.label}
                  </span>
                </button>
              );
            })}
          </div>

          {filteredFeatures.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">No features found</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
