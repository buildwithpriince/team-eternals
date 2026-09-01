import React, { useState } from 'react';
import { Volume2, VolumeX, Mic, MicOff } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface VoicePrompterProps {
  id?: string;
  promptEn: string;
  promptHi: string;
  onVoiceInput?: (transcript: string) => void;
}

export const VoicePrompter: React.FC<VoicePrompterProps> = ({
  id = 'voice-prompter-bar',
  promptEn,
  promptHi,
  onVoiceInput,
}) => {
  const { language, isSpeaking, speakText, stopSpeaking, autoVoiceEnabled, setAutoVoiceEnabled, theme } = useApp();
  const [isListening, setIsListening] = useState<boolean>(false);
  const [simulatedVoiceText, setSimulatedVoiceText] = useState<string>('');

  const currentPrompt = language === 'hi' ? promptHi : promptEn;

  const handleToggleSpeak = () => {
    if (isSpeaking) {
      stopSpeaking();
    } else {
      speakText(currentPrompt, language);
    }
  };

  const handleToggleListen = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    // Try SpeechRecognition if available, or simulate accessible prompt
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      try {
        const win = window as unknown as Record<string, any>;
        const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
        const recognition = new SpeechRec();
        recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
        recognition.interimResults = false;

        setIsListening(true);
        recognition.onresult = (event: any) => {
          const transcript = event.results?.[0]?.[0]?.transcript || '';
          setSimulatedVoiceText(transcript);
          setIsListening(false);
          if (onVoiceInput) onVoiceInput(transcript);
        };
        recognition.onerror = () => {
          setIsListening(false);
        };
        recognition.onend = () => {
          setIsListening(false);
        };
        recognition.start();
      } catch {
        // Fallback simulation
        setIsListening(true);
        setTimeout(() => {
          setIsListening(false);
        }, 3000);
      }
    } else {
      // Fallback
      setIsListening(true);
      setTimeout(() => {
        setIsListening(false);
      }, 3000);
    }
  };

  return (
    <div
      id={id}
      className="w-full p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 transition-all"
      style={{
        backgroundColor: theme.colors.bgCardSubtle,
        borderColor: theme.colors.borderDefault,
      }}
    >
      {/* Left: Animated Icon + Narration text */}
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <button
          id="btn-trigger-voice-narrator"
          type="button"
          onClick={handleToggleSpeak}
          className="relative p-3 rounded-full flex items-center justify-center shrink-0 cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
          style={{
            backgroundColor: isSpeaking ? theme.colors.primary : theme.colors.primaryLight,
            color: isSpeaking ? '#FFFFFF' : theme.colors.primaryDark,
          }}
          title={isSpeaking ? 'बोलना बंद करें' : 'आवाज में सुनें'}
          aria-label={isSpeaking ? 'Stop voice reading' : 'Play voice reading'}
        >
          {isSpeaking ? (
            <VolumeX className="w-6 h-6 animate-pulse" />
          ) : (
            <Volume2 className="w-6 h-6" />
          )}

          {/* Breathing ripple wave when speaking */}
          {isSpeaking && (
            <span
              className="absolute inset-0 rounded-full animate-ping opacity-30 pointer-events-none"
              style={{ backgroundColor: theme.colors.primary }}
            />
          )}
        </button>

        <div className="flex flex-col text-left">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: isSpeaking
                  ? theme.colors.accent
                  : theme.colors.success,
              }}
            />
            {isSpeaking
              ? language === 'hi'
                ? 'आवाज में पढ़ा जा रहा है...'
                : 'Swasthya AI Voice Active...'
              : language === 'hi'
              ? 'आवाज सहायता उपलब्ध'
              : 'Voice Assistant Ready'}
          </span>
          <p
            className="text-base sm:text-lg font-bold leading-snug"
            style={{ color: theme.colors.textPrimary }}
          >
            {currentPrompt}
          </p>
        </div>
      </div>

      {/* Right Controls: Speak Mic & Audio Settings */}
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
        {/* Listen Mic Button */}
        <button
          id="btn-mic-listen"
          type="button"
          onClick={handleToggleListen}
          className={`px-4 py-2.5 rounded-lg flex items-center gap-2 font-bold text-sm cursor-pointer transition-all border ${
            isListening
              ? 'bg-red-500 text-white border-red-600 animate-pulse shadow-md'
              : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
          }`}
          aria-label={isListening ? 'Listening' : 'Speak your answer'}
        >
          {isListening ? (
            <>
              <Mic className="w-5 h-5 animate-bounce" />
              <span>{language === 'hi' ? 'सुन रहा हूँ...' : 'Listening...'}</span>
            </>
          ) : (
            <>
              <Mic className="w-5 h-5 text-slate-600" />
              <span>{language === 'hi' ? 'बोलकर बताएं' : 'Speak Answer'}</span>
            </>
          )}
        </button>

        {/* Read aloud toggle */}
        <button
          id="btn-toggle-auto-audio"
          type="button"
          onClick={() => {
            if (autoVoiceEnabled) {
              stopSpeaking();
              setAutoVoiceEnabled(false);
            } else {
              setAutoVoiceEnabled(true);
              speakText(currentPrompt, language);
            }
          }}
          className={`p-2.5 rounded-lg border text-xs font-semibold cursor-pointer ${
            autoVoiceEnabled
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-slate-100 text-slate-500 border-slate-300'
          }`}
          title={autoVoiceEnabled ? 'ध्वनि चालू है' : 'ध्वनि म्यूट है'}
        >
          {autoVoiceEnabled ? (
            <span className="flex items-center gap-1">
              <Volume2 className="w-4 h-4" />
              <span className="hidden sm:inline">
                {language === 'hi' ? 'ऑडियो चालू' : 'Audio On'}
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <VolumeX className="w-4 h-4" />
              <span className="hidden sm:inline">
                {language === 'hi' ? 'म्यूट' : 'Mute'}
              </span>
            </span>
          )}
        </button>
      </div>

      {simulatedVoiceText && (
        <div className="w-full text-xs text-slate-700 bg-slate-100 p-2 rounded-lg mt-2 text-left">
          <strong>{language === 'hi' ? 'पहचाना गया:' : 'Heard:'}</strong> "{simulatedVoiceText}"
        </div>
      )}
    </div>
  );
};
