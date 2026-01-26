import { Home, Package, Wrench, ScanLine, MoreHorizontal } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface MobileBottomTabBarProps {
  onMoreClick: () => void;
}

const tabs = [
  { icon: Home, label: "Dashboard", path: "/" },
  { icon: Package, label: "Assets", path: "/assets" },
  { icon: Wrench, label: "Work Orders", path: "/work-orders" },
  { icon: ScanLine, label: "Scanner", path: "/scanner" },
  { icon: MoreHorizontal, label: "More", path: null }, // null path means it triggers drawer
];

export function MobileBottomTabBar({ onMoreClick }: MobileBottomTabBarProps) {
  const [location, setLocation] = useLocation();

  const handleTabClick = (tab: typeof tabs[0]) => {
    if (tab.path === null) {
      // "More" button - open drawer
      onMoreClick();
    } else {
      // Navigate to path
      setLocation(tab.path);
    }
  };

  const isActive = (path: string | null) => {
    if (path === null) return false; // "More" is never "active"
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* Glassmorphism background */}
      <div className="glass dark:glass-dark border-t border-border/50 backdrop-blur-xl">
        <nav className="flex items-center justify-around px-2 py-2 safe-area-inset-bottom">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.path);
            
            return (
              <button
                key={tab.label}
                onClick={() => handleTabClick(tab)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[64px]",
                  "active:scale-95",
                  active
                    ? "bg-[#DC2626] text-white shadow-lg"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
                aria-label={tab.label}
                aria-current={active ? "page" : undefined}
              >
                <Icon 
                  className={cn(
                    "h-6 w-6 transition-transform",
                    active && "scale-110"
                  )} 
                />
                <span className="text-[10px] font-medium leading-none">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
