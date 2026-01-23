import { useEffect, useRef, useState } from 'react';

interface PullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  maxPull?: number;
  enabled?: boolean;
}

/**
 * Hook to implement pull-to-refresh gesture on mobile
 * Returns the pull distance for visual feedback
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 150,
  enabled = true,
}: PullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only start pull if at the top of the page
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        isPulling.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const distance = currentY - startY.current;

      // Only pull down (positive distance) and limit to maxPull
      if (distance > 0) {
        const limitedDistance = Math.min(distance, maxPull);
        setPullDistance(limitedDistance);

        // Prevent default scrolling when pulling
        if (distance > 10) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling.current || isRefreshing) return;

      isPulling.current = false;

      // Trigger refresh if pulled past threshold
      if (pullDistance >= threshold) {
        setIsRefreshing(true);
        
        // Haptic feedback on refresh trigger
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }

        try {
          await onRefresh();
        } catch (error) {
          console.error('Refresh error:', error);
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        // Snap back if not past threshold
        setPullDistance(0);
      }
    };

    // Add listeners to document for global pull-to-refresh
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, pullDistance, threshold, maxPull, onRefresh, isRefreshing]);

  return {
    pullDistance,
    isRefreshing,
    isPulling: isPulling.current,
    containerRef,
  };
}

/**
 * Calculate opacity for pull indicator based on distance
 */
export function getPullOpacity(distance: number, threshold: number): number {
  return Math.min(distance / threshold, 1);
}

/**
 * Calculate rotation for pull indicator based on distance
 */
export function getPullRotation(distance: number, maxPull: number): number {
  return (distance / maxPull) * 360;
}
