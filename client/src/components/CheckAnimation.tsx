import { useEffect, useState } from "react";
import { CheckCircle } from "lucide-react";

interface CheckAnimationProps {
  show: boolean;
  onComplete?: () => void;
  size?: "sm" | "md" | "lg";
  message?: string;
}

export function CheckAnimation({ show, onComplete, size = "md", message }: CheckAnimationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!isVisible) return null;

  const sizeClasses = {
    sm: "h-12 w-12",
    md: "h-16 w-16",
    lg: "h-24 w-24",
  };

  const iconSizes = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-16 w-16",
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 success-pulse">
        <div className={`${sizeClasses[size]} rounded-full bg-green-500 flex items-center justify-center shadow-2xl`}>
          <CheckCircle className={`${iconSizes[size]} text-white check-animation`} strokeWidth={3} />
        </div>
        {message && (
          <p className="text-lg font-semibold text-foreground bg-background px-6 py-2 rounded-full shadow-lg">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
