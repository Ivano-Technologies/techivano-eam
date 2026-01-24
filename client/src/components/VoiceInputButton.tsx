import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  append?: boolean; // If true, appends to existing text; if false, replaces
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
}

/**
 * Voice input button component
 * Provides speech-to-text functionality with visual feedback
 */
export function VoiceInputButton({
  onTranscript,
  append = true,
  className,
  size = 'icon',
  variant = 'outline',
}: VoiceInputButtonProps) {
  const {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceInput({
    continuous: true,
    interimResults: true,
  });

  // Send transcript to parent when it changes
  useEffect(() => {
    if (transcript) {
      onTranscript(transcript);
      resetTranscript();
    }
  }, [transcript, onTranscript, resetTranscript]);

  if (!isSupported) {
    return null; // Hide button if not supported
  }

  const handleClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="relative">
      <Button
        type="button"
        size={size}
        variant={variant}
        onClick={handleClick}
        className={cn(
          'transition-all',
          isListening && 'bg-destructive text-destructive-foreground hover:bg-destructive/90 animate-pulse',
          className
        )}
        title={isListening ? 'Stop recording' : 'Start voice input'}
      >
        {isListening ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>

      {/* Interim transcript indicator */}
      {isListening && interimTranscript && (
        <div className="absolute top-full left-0 mt-2 px-3 py-2 bg-popover text-popover-foreground text-sm rounded-lg shadow-lg border border-border max-w-xs z-50">
          <p className="text-xs text-muted-foreground mb-1">Listening...</p>
          <p className="italic">{interimTranscript}</p>
        </div>
      )}
    </div>
  );
}
