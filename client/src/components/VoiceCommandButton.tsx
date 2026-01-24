import { Mic, MicOff } from 'lucide-react';
import { Button } from './ui/button';
import { useVoiceCommand } from '@/hooks/useVoiceCommand';
import { useLocation } from 'wouter';
import { useState } from 'react';
import { triggerHaptic } from '@/hooks/useHaptic';


export function VoiceCommandButton() {
  const [, setLocation] = useLocation();

  const [command, setCommand] = useState('');

  const { isListening, transcript, isSupported, toggleListening } = useVoiceCommand({
    onAssetLookup: (assetId) => {
      triggerHaptic('success');
      setCommand(`Finding asset: ${assetId}`);
      setTimeout(() => setLocation(`/assets?search=${assetId}`), 500);
    },
    onWorkOrderCreate: (description) => {
      triggerHaptic('success');
      setCommand(`Creating work order: ${description}`);
      setTimeout(() => setLocation(`/work-orders?create=true&description=${encodeURIComponent(description)}`), 500);
    },
    onCommand: (text) => {
      setCommand(text);
    },
  });

  if (!isSupported) {
    return null;
  }

  const handleClick = () => {
    triggerHaptic('light');
    toggleListening();
  };

  return (
    <div className="relative">
      <Button
        variant={isListening ? 'default' : 'outline'}
        size="icon"
        onClick={handleClick}
        className={`${isListening ? 'bg-red-500 hover:bg-red-600 animate-pulse' : ''}`}
        title={isListening ? 'Stop listening' : 'Voice command'}
      >
        {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </Button>
      
      {isListening && transcript && (
        <div className="absolute top-full mt-2 right-0 bg-background border rounded-lg shadow-lg p-3 min-w-[200px] max-w-[300px] z-50">
          <p className="text-xs text-muted-foreground mb-1">Listening...</p>
          <p className="text-sm">{transcript}</p>
        </div>
      )}
    </div>
  );
}
