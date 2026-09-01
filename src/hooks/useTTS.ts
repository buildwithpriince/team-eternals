import { useState, useCallback, useRef, useEffect } from 'react';
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
  const { defaultLang = 'hi', onStart, onEnd, onError } = options;
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isFallbackActive, setIsFallbackActive] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Native window.speechSynthesis fallback
  const speakNativeFallback = useCallback(
    (text: string, lang: AppLanguage = defaultLang) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setIsSpeaking(false);
        if (onEnd) onEnd();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const targetLang = lang === 'hi' ? 'hi-IN' : 'en-IN';
      const voices = window.speechSynthesis.getVoices();

      const femaleKeywords = [
        'female',
        'swara',
        'heera',
        'kalpana',
        'zira',
        'samantha',
        'serena',
        'karen',
        'victoria',
        'veena',
        'natural',
        'google',
      ];

      const matchingVoices = voices.filter(
        (v) => v.lang === targetLang || v.lang.startsWith(lang === 'hi' ? 'hi' : 'en')
      );

      const matchedVoice =
        matchingVoices.find((v) =>
          femaleKeywords.some((kw) => v.name.toLowerCase().includes(kw))
        ) || matchingVoices[0];

      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      utterance.lang = targetLang;
      utterance.rate = lang === 'en' ? 1.08 : 0.95;
      utterance.pitch = 1.05;

      utterance.onstart = () => {
        setIsSpeaking(true);
        if (onStart) onStart();
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        if (onEnd) onEnd();
      };

      utterance.onerror = (e) => {
        setIsSpeaking(false);
        if (onError) onError(e);
        if (onEnd) onEnd();
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (synthErr) {
        console.warn('Native speechSynthesis error:', synthErr);
        setIsSpeaking(false);
        if (onEnd) onEnd();
      }
    },
    [defaultLang, onStart, onEnd, onError]
  );

  const speak = useCallback(
    async (text: string, lang: AppLanguage = defaultLang) => {
      if (!text || !text.trim()) {
        if (onEnd) onEnd();
        return;
      }

      // Stop any previous speech
      stop();

      const cleanText = text.trim();

      // Delegate directly to speechService which coordinates caching, audio decoding,
      // and silent browser fallback with full 429 catch handling.
      try {
        setIsSpeaking(true);
        await speechService.speak(
          cleanText,
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
            console.warn('Gemini TTS failed with error, activating silent native fallback');
            setIsFallbackActive(true);
            speakNativeFallback(cleanText, lang);
          }
        );
      } catch (err: unknown) {
        // Specifically intercept 429 quota/rate limit errors or unexpected exceptions
        console.warn('Caught TTS invocation exception, executing silent native fallback:', err);
        setIsFallbackActive(true);
        speakNativeFallback(cleanText, lang);
      }
    },
    [defaultLang, onStart, onEnd, onError, speakNativeFallback]
  );

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    speechService.stop();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
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
    isFallbackActive,
  };
}
