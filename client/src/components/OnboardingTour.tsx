import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface TourStep {
  title: string;
  description: string;
  target?: string; // CSS selector for highlighting
  position: "top" | "bottom" | "left" | "right" | "center";
}

const tourSteps: TourStep[] = [
  {
    title: "Welcome to NRCS EAM! 👋",
    description: "Let's take a quick tour to help you get started with managing your assets efficiently.",
    position: "center",
  },
  {
    title: "Bottom Navigation Bar",
    description: "Access your most-used features quickly: Dashboard, Assets, Work Orders, and Scanner. Tap any icon to navigate.",
    position: "bottom",
  },
  {
    title: "More Features",
    description: "Tap the 'More' button to open a drawer with all additional features like Inventory, Maintenance, Reports, and Settings.",
    position: "bottom",
  },
  {
    title: "Swipe to Close",
    description: "When the drawer is open, you can swipe down to close it naturally, or tap the X button.",
    position: "center",
  },
  {
    title: "Desktop Sidebar",
    description: "On larger screens, you'll see a full sidebar with all features. You can resize it by dragging the edge.",
    position: "left",
  },
  {
    title: "You're All Set!",
    description: "Start managing your assets by scanning QR codes, creating work orders, or exploring the dashboard. Enjoy!",
    position: "center",
  },
];

export function OnboardingTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenTour, setHasSeenTour] = useState(false);

  useEffect(() => {
    // Check if user has seen the tour
    const tourCompleted = localStorage.getItem("nrcs_onboarding_completed");
    if (!tourCompleted) {
      // Delay showing tour to let page load
      setTimeout(() => setIsOpen(true), 1000);
    } else {
      setHasSeenTour(true);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem("nrcs_onboarding_completed", "true");
    setIsOpen(false);
    setHasSeenTour(true);
  };

  const handleSkip = () => {
    localStorage.setItem("nrcs_onboarding_completed", "true");
    setIsOpen(false);
    setHasSeenTour(true);
  };

  if (!isOpen || hasSeenTour) return null;

  const step = tourSteps[currentStep];
  const progress = ((currentStep + 1) / tourSteps.length) * 100;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] animate-in fade-in duration-300" />

      {/* Tour Card */}
      <div
        className={cn(
          "fixed z-[101] max-w-md w-[90vw] glass dark:glass-dark rounded-2xl shadow-2xl p-6 animate-in slide-in-from-bottom duration-300",
          step.position === "center" && "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
          step.position === "bottom" && "bottom-24 left-1/2 -translate-x-1/2",
          step.position === "top" && "top-24 left-1/2 -translate-x-1/2",
          step.position === "left" && "left-4 top-1/2 -translate-y-1/2",
          step.position === "right" && "right-4 top-1/2 -translate-y-1/2"
        )}
      >
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-accent/50 transition-colors"
          aria-label="Skip tour"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="mb-6">
          <h3 className="text-xl font-bold mb-2">{step.title}</h3>
          <p className="text-muted-foreground">{step.description}</p>
        </div>

        {/* Navigation */}
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground text-center">
            Step {currentStep + 1} of {tourSteps.length}
          </div>

          <div className="flex gap-2 justify-end">
            {currentStep > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                className="gap-1 flex-shrink-0"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden xs:inline">Back</span>
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleNext}
              className="gap-1 flex-shrink-0 min-w-[120px]"
            >
              {currentStep === tourSteps.length - 1 ? "Get Started" : "Next"}
              {currentStep < tourSteps.length - 1 && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Skip button */}
        {currentStep < tourSteps.length - 1 && (
          <button
            onClick={handleSkip}
            className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip tour
          </button>
        )}
      </div>
    </>
  );
}
