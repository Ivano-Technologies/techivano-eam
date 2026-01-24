import { Link, useLocation } from 'wouter';
import { 
  Home, 
  Package, 
  QrCode, 
  Wrench, 
  User 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  to: string;
  isFAB?: boolean;
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Dashboard', to: '/' },
  { icon: Package, label: 'Assets', to: '/assets' },
  { icon: QrCode, label: 'Scan', to: '/smart-scanner', isFAB: true },
  { icon: Wrench, label: 'Work Orders', to: '/work-orders' },
  { icon: User, label: 'Profile', to: '/profile' },
];

export function MobileBottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border md:hidden">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.to || 
            (item.to !== '/' && location.startsWith(item.to));

          if (item.isFAB) {
            return (
              <Link key={item.to} href={item.to}>
                <button
                  className={cn(
                    'relative -mt-8 w-14 h-14 rounded-full shadow-lg',
                    'bg-primary text-primary-foreground',
                    'hover:bg-primary/90 transition-all',
                    'flex items-center justify-center',
                    'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
                  )}
                  aria-label={item.label}
                >
                  <Icon className="w-6 h-6" />
                </button>
              </Link>
            );
          }

          return (
            <Link key={item.to} href={item.to}>
              <button
                className={cn(
                  'flex flex-col items-center justify-center',
                  'min-w-[60px] h-full px-2 py-1',
                  'transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset rounded-md',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className={cn('w-5 h-5 mb-0.5', isActive && 'stroke-[2.5]')} />
                <span className={cn(
                  'text-[10px] font-medium',
                  isActive && 'font-semibold'
                )}>
                  {item.label}
                </span>
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
