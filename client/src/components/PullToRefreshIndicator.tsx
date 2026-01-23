import { RefreshCw } from 'lucide-react';
import { getPullOpacity, getPullRotation } from '@/hooks/usePullToRefresh';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
  maxPull?: number;
}

/**
 * Visual indicator for pull-to-refresh gesture
 * Shows a rotating refresh icon that appears as user pulls down
 */
export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold = 80,
  maxPull = 150,
}: PullToRefreshIndicatorProps) {
  const opacity = getPullOpacity(pullDistance, threshold);
  const rotation = getPullRotation(pullDistance, maxPull);
  const isActive = pullDistance >= threshold;

  // Don't render if not pulling and not refreshing
  if (pullDistance === 0 && !isRefreshing) return null;

  return (
    <div
      className="fixed top-16 left-0 right-0 flex justify-center z-40 pointer-events-none transition-opacity duration-200"
      style={{
        opacity: isRefreshing ? 1 : opacity,
      }}
    >
      <div
        className={`
          flex items-center justify-center
          h-12 w-12 rounded-full
          ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
          shadow-lg
          transition-colors duration-200
        `}
        style={{
          transform: isRefreshing
            ? 'none'
            : `translateY(${Math.min(pullDistance / 2, 40)}px) rotate(${rotation}deg)`,
          transition: isRefreshing ? 'transform 0.3s ease' : 'none',
        }}
      >
        <RefreshCw
          className={`h-6 w-6 ${isRefreshing ? 'animate-spin' : ''}`}
        />
      </div>
    </div>
  );
}
