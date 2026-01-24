import { useState, useEffect, useCallback, useRef } from 'react';

interface VoiceCommandOptions {
  onCommand?: (transcript: string) => void;
  onAssetLookup?: (assetId: string) => void;
  onWorkOrderCreate?: (description: string) => void;
  continuous?: boolean;
  language?: string;
}

export function useVoiceCommand({
  onCommand,
  onAssetLookup,
  onWorkOrderCreate,
  continuous = false,
  language = 'en-US',
}: VoiceCommandOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check if Web Speech API is supported
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcriptText = event.results[current][0].transcript;
      setTranscript(transcriptText);

      // Only process final results
      if (event.results[current].isFinal) {
        onCommand?.(transcriptText);
        processCommand(transcriptText);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [continuous, language, onCommand]);

  const processCommand = useCallback((text: string) => {
    const lowerText = text.toLowerCase();

    // Asset lookup: "find asset ABC123" or "lookup asset ABC123"
    const assetMatch = lowerText.match(/(?:find|lookup|search)\s+asset\s+([a-z0-9-]+)/i);
    if (assetMatch && onAssetLookup) {
      onAssetLookup(assetMatch[1].toUpperCase());
      return;
    }

    // Work order creation: "create work order [description]"
    const workOrderMatch = lowerText.match(/create\s+work\s+order\s+(.+)/i);
    if (workOrderMatch && onWorkOrderCreate) {
      onWorkOrderCreate(workOrderMatch[1]);
      return;
    }
  }, [onAssetLookup, onWorkOrderCreate]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
  };
}
