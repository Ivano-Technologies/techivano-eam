import { ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  snapPoints?: number[]; // [0.6, 0.9] = 60% or 90% of viewport height
  children: ReactNode;
  title?: string;
}

export function BottomSheet({
  isOpen,
  onClose,
  snapPoints = [0.6],
  children,
  title,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isDragging = useRef(false);

  // Handle drag start
  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
  };

  // Handle drag move
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    
    // Only allow downward dragging
    if (diff > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${diff}px)`;
    }
  };

  // Handle drag end
  const handleTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const diff = currentY.current - startY.current;
    
    // Close if dragged down more than 100px
    if (diff > 100) {
      onClose();
    }

    // Reset transform
    if (sheetRef.current) {
      sheetRef.current.style.transform = '';
    }
  };

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className={cn(
          "absolute inset-0 bg-black/50 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          "absolute bottom-0 left-0 right-0 bg-background rounded-t-3xl shadow-2xl",
          "transition-transform duration-300 ease-out",
          isOpen ? "translate-y-0" : "translate-y-full"
        )}
        style={{ height: `${snapPoints[0] * 100}%` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
          <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 pb-4 border-b">
            <h3 className="text-xl font-bold">{title}</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto h-full pb-8">
          {children}
        </div>
      </div>
    </div>
  );
}
