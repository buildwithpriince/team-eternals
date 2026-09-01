import React, { useEffect } from 'react';
import { Volume2, ArrowRight, AlertTriangle, Sparkles, HeartPulse, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const Step1Greeting: React.FC = () => {
  const {
    language,
    theme,
    speakText,
    stopSpeaking,
    setCurrentKioskStep,
    triggerEmergencyHelp,
  } = useApp();

  const greetingTextHi =
    'नमस्ते! मैं स्वास्थ्य ए.आई. हूँ। डॉक्टर साहब से मिलने से पहले, मैं आपकी बीमारी के बारे में कुछ जरूरी बातें लिखूंगा, ताकि डॉक्टर आपका सही व त्वरित इलाज कर सकें।';
  const greetingTextEn =
    'Namaste! I am Swasthya AI. Before you meet the doctor, I will record your health history and symptoms so the physician can provide faster, accurate care.';

  useEffect(() => {
    // Speak greeting automatically
    speakText(language === 'hi' ? greetingTextHi : greetingTextEn, language);
    return () => {
      stopSpeaking();
    };
  }, [language]);

  const handleStart = () => {
    stopSpeaking();
    setCurrentKioskStep(2);
  };

  const handleEmergencySkip = () => {
    stopSpeaking();
    triggerEmergencyHelp('emergency_skip_at_greeting');
  };

  return (
    <div
      id="step-1-greeting-screen"
      className="w-full max-w-4xl mx-auto space-y-8 animate-fadeIn text-center"
    >
      {/* Visual Avatar / Emblem */}
      <div className="relative inline-block mx-auto">
        <div
          className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl flex items-center justify-center text-white shadow-xl mx-auto transform transition-transform hover:scale-105"
          style={{ backgroundColor: theme.colors.primary }}
        >
          <HeartPulse className="w-14 h-14 sm:w-16 sm:h-16 animate-pulse" />
        </div>
        <span
          className="absolute -bottom-2 -right-2 px-3 py-1 rounded-full text-xs font-black uppercase text-white shadow-md"
          style={{ backgroundColor: theme.colors.accent }}
        >
          AI Kiosk
        </span>
      </div>

      {/* Main Title & Subtitle */}
      <div className="space-y-3">
        <h1
          className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight"
          style={{ color: theme.colors.textPrimary }}
        >
          {language === 'hi' ? 'नमस्ते, मैं स्वास्थ्या AI हूँ' : 'Namaste, I am Swasthya AI'}
        </h1>
        <p className="text-lg sm:text-xl text-slate-700 font-semibold max-w-2xl mx-auto leading-relaxed">
          {language === 'hi'
            ? 'अस्पताल ओ.पी.डी. में आपका स्वागत है। डॉक्टर से परामर्श पूर्व आपका स्वास्थ्य विवरण तैयार किया जा रहा है।'
            : 'Welcome to Hospital OPD. We prepare your structured clinical summary before you see the physician.'}
        </p>
      </div>

      {/* Bilingual Spoken Transcript Card */}
      <div
        className="p-6 sm:p-8 rounded-2xl border-2 text-left space-y-3 shadow-md"
        style={{
          backgroundColor: theme.colors.bgCardSubtle,
          borderColor: theme.colors.borderDefault,
        }}
      >
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500">
          <Volume2 className="w-4 h-4 text-cyan-700 animate-pulse" />
          <span>{language === 'hi' ? 'आवाज संदेश (Voice Message)' : 'Spoken Voice Greeting'}</span>
        </div>

        <p
          className="text-xl sm:text-2xl font-bold leading-snug"
          style={{ color: theme.colors.textPrimary }}
        >
          {language === 'hi' ? greetingTextHi : greetingTextEn}
        </p>

        <p className="text-base sm:text-lg text-slate-600 font-medium">
          {language === 'hi' ? greetingTextEn : greetingTextHi}
        </p>
      </div>

      {/* Highlights / Features for reassurance */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>{language === 'hi' ? '2 मिनट में पूर्ण' : 'Takes only 2 mins'}</span>
          </div>
          <p className="text-xs text-slate-600 font-medium">
            {language === 'hi' ? 'आसान सवाल, बोलकर या छूकर उत्तर दें' : 'Simple questions by voice or touch'}
          </p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center gap-2 text-cyan-800 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>{language === 'hi' ? 'दवा पर्ची स्कैन' : 'Document Scan'}</span>
          </div>
          <p className="text-xs text-slate-600 font-medium">
            {language === 'hi' ? 'पुरानी पर्ची व खून जांच रिपोर्ट जोड़ें' : 'Add past prescriptions & lab tests'}
          </p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>{language === 'hi' ? 'सीधे डॉक्टर तक' : 'Instant Doctor EMR'}</span>
          </div>
          <p className="text-xs text-slate-600 font-medium">
            {language === 'hi' ? 'डॉक्टर को पूरी जानकारी तुरंत मिलेगी' : 'Doctor sees structured history ready'}
          </p>
        </div>
      </div>

      {/* Primary Action & Emergency Skip */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
        {/* Big Start Button */}
        <button
          id="btn-start-history-intake"
          type="button"
          onClick={handleStart}
          className="w-full sm:w-auto px-10 py-5 rounded-2xl font-extrabold text-xl text-white shadow-xl flex items-center justify-center gap-3 transition-all transform active:scale-95 cursor-pointer min-h-[64px]"
          style={{ backgroundColor: theme.colors.primary }}
        >
          <span>{language === 'hi' ? 'शुरू करें (Start History)' : 'Start History Intake'}</span>
          <ArrowRight className="w-7 h-7" />
        </button>

        {/* Skippable immediately for emergencies */}
        <button
          id="btn-greeting-emergency-skip"
          type="button"
          onClick={handleEmergencySkip}
          className="w-full sm:w-auto px-6 py-5 rounded-2xl font-bold text-base bg-red-50 hover:bg-red-100 text-red-800 border-2 border-red-300 flex items-center justify-center gap-2.5 transition-colors cursor-pointer min-h-[64px]"
        >
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <span>
            {language === 'hi'
              ? 'गंभीर इमरजेंसी? सीधे मदद लें'
              : 'Emergency? Skip to Triage'}
          </span>
        </button>
      </div>
    </div>
  );
};
