import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, PanelLeft, Users, Package, Wrench, Calendar, TrendingUp, FileText, MapPin, Building2, DollarSign, Map, Settings, Download, Maximize2, Mail } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { NotificationCenter } from "./NotificationCenter";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Package, label: "Assets", path: "/assets" },
  { icon: Map, label: "Asset Map", path: "/asset-map" },
  { icon: Wrench, label: "Work Orders", path: "/work-orders" },
  { icon: Calendar, label: "Maintenance", path: "/maintenance" },
  { icon: TrendingUp, label: "Inventory", path: "/inventory" },
  { icon: Building2, label: "Vendors", path: "/vendors" },
  { icon: DollarSign, label: "Financial", path: "/financial" },
  { icon: FileText, label: "Compliance", path: "/compliance" },
  { icon: FileText, label: "Reports", path: "/reports" },
  { icon: MapPin, label: "Sites", path: "/sites" },
  { icon: Users, label: "Users", path: "/users" },
  { icon: DollarSign, label: "QuickBooks", path: "/quickbooks" },
  { icon: Mail, label: "Email Notifications", path: "/email-notifications" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;
const PRESET_WIDTHS = {
  narrow: 200,
  medium: 280,
  wide: 380,
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user } = useAuth();
  const { data: userPrefs } = trpc.userPreferences.get.useQuery(undefined, { enabled: !!user });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });

  // Sync sidebar width with user preferences from backend
  useEffect(() => {
    if (userPrefs?.sidebarWidth) {
      setSidebarWidth(userPrefs.sidebarWidth);
    }
  }, [userPrefs]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-white via-blue-50 to-red-50">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full bg-white rounded-2xl shadow-2xl border border-border">
          <div className="flex flex-col items-center gap-6">
            <img 
              src="/nrcs-logo.png" 
              alt="Nigerian Red Cross Society" 
              className="h-24 w-24"
            />
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight mb-2">
                NRCS Asset Management
              </h1>
              <p className="text-sm text-muted-foreground">
                Nigerian Red Cross Society
              </p>
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Sign in to access the Enterprise Asset Management System
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all bg-primary hover:bg-primary/90"
          >
            Sign in with Manus
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Authorized personnel only
          </p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showWidthPresets, setShowWidthPresets] = useState(false);

  const updatePrefsMutation = trpc.userPreferences.update.useMutation();

  const applyWidthPreset = (preset: keyof typeof PRESET_WIDTHS) => {
    const newWidth = PRESET_WIDTHS[preset];
    setSidebarWidth(newWidth);
    setShowWidthPresets(false);
    if (user) {
      updatePrefsMutation.mutate({ sidebarWidth: newWidth });
    }
  };

  // Keyboard shortcut for sidebar toggle (Ctrl/Cmd+B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  // PWA install prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallPrompt(false);
    }
    setDeferredPrompt(null);
  };

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-20 justify-center border-b border-sidebar-border">
            <div className="flex items-center gap-3 px-3 transition-all w-full">
              {!isCollapsed ? (
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <img 
                    src="/nrcs-logo.png" 
                    alt="Nigerian Red Cross Society" 
                    className="h-12 w-12 shrink-0"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm text-sidebar-foreground truncate">
                      NRCS EAM
                    </span>
                    <span className="text-xs text-sidebar-foreground/70 truncate">
                      Asset Management
                    </span>
                  </div>
                </div>
              ) : (
                <img 
                  src="/nrcs-logo.png" 
                  alt="NRCS" 
                  className="h-10 w-10"
                />
              )}
              {!isCollapsed && (
                <DropdownMenu open={showWidthPresets} onOpenChange={setShowWidthPresets}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0 border border-sidebar-border hover:border-primary/50"
                      aria-label="Sidebar width presets"
                      title="Sidebar width presets"
                    >
                      <Maximize2 className="h-3.5 w-3.5 text-sidebar-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem onClick={() => applyWidthPreset('narrow')} className="cursor-pointer">
                      <span className="text-xs">Narrow (200px)</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => applyWidthPreset('medium')} className="cursor-pointer">
                      <span className="text-xs">Medium (280px)</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => applyWidthPreset('wide')} className="cursor-pointer">
                      <span className="text-xs">Wide (380px)</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0 ml-auto border border-sidebar-border hover:border-primary/50"
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <PanelLeft className={`h-4 w-4 text-sidebar-foreground transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 space-y-2">
            {showInstallPrompt && (
              <Button 
                onClick={handleInstallClick}
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 text-xs h-9 border-primary/30 hover:bg-primary/10"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="group-data-[collapsible=icon]:hidden">Install App</span>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => setLocation("/notification-preferences")}
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Notification Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
            <NotificationCenter />
          </div>
        )}
        {!isMobile && (
          <div className="flex border-b h-14 items-center justify-end bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <NotificationCenter />
          </div>
        )}
        <main className="flex-1 p-4">{children}</main>
      </SidebarInset>
    </>
  );
}
