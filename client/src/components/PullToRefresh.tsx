import { ReactNode, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { triggerHaptic } from '@/hooks/useHaptic';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  enabled?: boolean;
}

export function PullToRefresh({ onRefresh, children, enabled = true }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const PULL_THRESHOLD = 80;
  const MAX_PULL = 120;

  useEffect(() => {
    if (!enabled) return;
    
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger if at top of scroll
      if (container.scrollTop === 0) {
        startY.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (refreshing || startY.current === 0) return;
      
      const currentY = e.touches[0].clientY;
      const distance = currentY - startY.current;
      
      // Only pull down
      if (distance > 0 && container.scrollTop === 0) {
        e.preventDefault();
        const pullAmount = Math.min(distance * 0.5, MAX_PULL);
        setPullDistance(pullAmount);
        setPulling(pullAmount >= PULL_THRESHOLD);
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance >= PULL_THRESHOLD && !refreshing) {
        triggerHaptic('medium');
        setRefreshing(true);
        setPullDistance(PULL_THRESHOLD);
        
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          setPullDistance(0);
          setPulling(false);
          startY.current = 0;
        }
      } else {
        setPullDistance(0);
        setPulling(false);
        startY.current = 0;
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, onRefresh, pullDistance, refreshing]);

  const rotation = (pullDistance / PULL_THRESHOLD) * 360;
  const opacity = Math.min(pullDistance / PULL_THRESHOLD, 1);

  return (
    <div ref={containerRef} className="relative h-full overflow-auto">
      {/* Pull indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center transition-all duration-200 pointer-events-none z-50"
        style={{
          height: `${pullDistance}px`,
          opacity,
        }}
      >
        <div className="bg-background border border-border rounded-full p-2 shadow-lg">
          <RefreshCw
            className={`h-5 w-5 text-primary ${refreshing ? 'animate-spin' : ''}`}
            style={{
              transform: refreshing ? 'none' : `rotate(${rotation}deg)`,
            }}
          />
        </div>
      </div>
      
      {/* Content */}
      <div
        className="transition-transform duration-200"
        style={{
          transform: `translateY(${pullDistance}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
