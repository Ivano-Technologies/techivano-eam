import { useEffect, useRef } from 'react';
import { triggerHaptic } from './useHaptic';

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  enabled?: boolean;
}

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  enabled = true,
}: SwipeGestureOptions) {
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const isSwiping = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      isSwiping.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isSwiping.current) return;
      touchEndX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = () => {
      if (!isSwiping.current) return;
      
      const deltaX = touchEndX.current - touchStartX.current;
      
      // Swipe right (open sidebar)
      if (deltaX > threshold && onSwipeRight) {
        triggerHaptic('light');
        onSwipeRight();
      }
      
      // Swipe left (close sidebar)
      if (deltaX < -threshold && onSwipeLeft) {
        triggerHaptic('light');
        onSwipeLeft();
      }
      
      isSwiping.current = false;
      touchStartX.current = 0;
      touchEndX.current = 0;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight, threshold, enabled]);
}
