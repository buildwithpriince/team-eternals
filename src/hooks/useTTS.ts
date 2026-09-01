import { useState, useCallback, useEffect } from 'react';
import { AppLanguage } from '../types';
import { speechService } from '../utils/speech';

interface UseTTSOptions {
  voice?: string;
  defaultLang?: AppLanguage;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

export function useTTS(options: UseTTSOptions = {}) {
  const { defaultLang = 'en', onStart, onEnd, onError } = options;
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const speak = useCallback(
    (text: string, lang: AppLanguage = defaultLang) => {
      if (!text || !text.trim()) {
        if (onEnd) onEnd();
        return;
      }

      speechService.speak(
        text,
        lang,
        () => {
          setIsSpeaking(true);
          if (onStart) onStart();
        },
        () => {
          setIsSpeaking(false);
          if (onEnd) onEnd();
        },
        () => {
          setIsSpeaking(false);
          if (onError) onError(new Error('Speech error'));
        }
      );
    },
    [defaultLang, onStart, onEnd, onError]
  );

  const stop = useCallback(() => {
    speechService.stop();
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    speak,
    stop,
    isSpeaking,
    isFallbackActive: false,
  };
}
