import { Textarea } from '@/components/ui/textarea';
import { VoiceInputButton } from '@/components/VoiceInputButton';
import { forwardRef } from 'react';

interface TextareaWithVoiceProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value?: string;
  onValueChange?: (value: string) => void;
}

/**
 * Textarea component with integrated voice input button
 * Combines standard textarea with speech-to-text functionality
 */
export const TextareaWithVoice = forwardRef<HTMLTextAreaElement, TextareaWithVoiceProps>(
  ({ value, onValueChange, onChange, className, ...props }, ref) => {
    const handleVoiceTranscript = (transcript: string) => {
      const currentValue = value || '';
      const newValue = currentValue ? `${currentValue} ${transcript}` : transcript;
      
      if (onValueChange) {
        onValueChange(newValue);
      }
      
      if (onChange) {
        // Create synthetic event for onChange compatibility
        const syntheticEvent = {
          target: { value: newValue },
        } as React.ChangeEvent<HTMLTextAreaElement>;
        onChange(syntheticEvent);
      }
    };

    return (
      <div className="relative">
        <Textarea
          ref={ref}
          value={value}
          onChange={onChange}
          className={className}
          {...props}
        />
        <div className="absolute bottom-2 right-2">
          <VoiceInputButton
            onTranscript={handleVoiceTranscript}
            size="sm"
            variant="ghost"
          />
        </div>
      </div>
    );
  }
);

TextareaWithVoice.displayName = 'TextareaWithVoice';
