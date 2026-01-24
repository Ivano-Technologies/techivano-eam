import { useSwipeable } from 'react-swipeable';
import { useState, useRef, useEffect } from 'react';
import { Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeableCardProps {
  children: React.ReactNode;
  onDelete?: () => void | Promise<void>;
  onRefresh?: () => void | Promise<void>;
  deleteThreshold?: number;
  refreshThreshold?: number;
  className?: string;
  disabled?: boolean;
}

/**
 * Swipeable card component with delete and refresh actions
 * - Swipe left to reveal delete button
 * - Swipe down to refresh (alternative to pull-to-refresh)
 */
export function SwipeableCard({
  children,
  onDelete,
  onRefresh,
  deleteThreshold = 100,
  refreshThreshold = 80,
  className,
  disabled = false,
}: SwipeableCardProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Reset position after swipe ends
  useEffect(() => {
    if (!isSwiping && !showDeleteConfirm) {
      const timer = setTimeout(() => {
        setOffsetX(0);
        setOffsetY(0);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isSwiping, showDeleteConfirm]);

  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      if (disabled || isDeleting) return;

      setIsSwiping(true);

      // Horizontal swipe (delete action)
      if (Math.abs(eventData.deltaX) > Math.abs(eventData.deltaY)) {
        // Only allow left swipe for delete
        if (eventData.deltaX < 0 && onDelete) {
          setOffsetX(Math.max(eventData.deltaX, -deleteThreshold * 1.5));
        }
      }
      // Vertical swipe (refresh action)
      else if (eventData.deltaY > 0 && onRefresh) {
        setOffsetY(Math.min(eventData.deltaY, refreshThreshold * 1.5));
      }
    },
    onSwiped: (eventData) => {
      if (disabled || isDeleting) return;

      setIsSwiping(false);

      // Check if delete threshold reached
      if (eventData.deltaX < -deleteThreshold && onDelete) {
        setShowDeleteConfirm(true);
        setOffsetX(-deleteThreshold);
      }
      // Check if refresh threshold reached
      else if (eventData.deltaY > refreshThreshold && onRefresh) {
        handleRefresh();
      }
      else {
        setOffsetX(0);
        setOffsetY(0);
      }
    },
    trackMouse: false,
    trackTouch: true,
  });

  const handleDelete = async () => {
    if (!onDelete || isDeleting) return;

    setIsDeleting(true);
    try {
      await onDelete();
    } catch (error) {
      console.error('Delete failed:', error);
      setShowDeleteConfirm(false);
      setOffsetX(0);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRefresh = async () => {
    if (!onRefresh) return;

    try {
      await onRefresh();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setOffsetY(0);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setOffsetX(0);
  };

  return (
    <div className="relative overflow-hidden">
      {/* Delete action background */}
      {onDelete && showDeleteConfirm && (
        <div className="absolute inset-0 bg-destructive flex items-center justify-end px-4 gap-2">
          <button
            onClick={handleCancelDelete}
            className="flex items-center gap-2 text-white font-medium px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
            disabled={isDeleting}
          >
            <X className="h-5 w-5" />
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 text-white font-medium px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
            disabled={isDeleting}
          >
            <Trash2 className="h-5 w-5" />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      )}

      {/* Refresh indicator */}
      {onRefresh && offsetY > 0 && (
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center bg-primary/10 text-primary font-medium text-sm"
          style={{ height: `${offsetY}px` }}
        >
          {offsetY >= refreshThreshold ? 'Release to refresh' : 'Pull down to refresh'}
        </div>
      )}

      {/* Card content */}
      <div
        {...handlers}
        ref={cardRef}
        className={cn(
          'transition-transform touch-pan-y',
          isSwiping ? 'transition-none' : 'duration-200',
          className
        )}
        style={{
          transform: `translate(${offsetX}px, ${offsetY}px)`,
          touchAction: disabled ? 'auto' : 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
}
