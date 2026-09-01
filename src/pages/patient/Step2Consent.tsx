import React, { useState, useEffect } from 'react';
import { ShieldCheck, Check, ArrowRight, ArrowLeft, Lock, FileCheck, Info } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { VoicePrompter } from '../../components/VoicePrompter';
import { speechService } from '../../utils/speech';

export const Step2Consent: React.FC = () => {
  const { language, theme, speakText, setCurrentKioskStep } = useApp();

  const [consentAI, setConsentAI] = useState<boolean>(true);
  const [consentEHR, setConsentEHR] = useState<boolean>(true);
  const [consentResearch, setConsentResearch] = useState<boolean>(false);

  const consentAudioPromptHi =
    'कृपया सहमति दें। आपकी जानकारी पूरी तरह सुरक्षित है और इसका उपयोग केवल आपके डॉक्टर द्वारा आपके सही इलाज के लिए किया जाएगा।';
  const consentAudioPromptEn =
    'Please grant consent. Your health information is strictly private, encrypted, and accessible only to your treating physician.';

  const prefPromptHi =
    'कृपया अपनी भाषा, उत्तर देने का तरीका, और अपना विभाग (सामान्य चिकित्सा या आयुष आयुर्वेद) चुनें।';
  const prefPromptEn =
    'Please select your language, voice or touch preference, and consultation department.';

  useEffect(() => {
    speakText(language === 'hi' ? consentAudioPromptHi : consentAudioPromptEn, language);
    // Prefetch next step prompt
    speechService.prefetch(language === 'hi' ? prefPromptHi : prefPromptEn, language);
  }, [language]);

  const handleAgreeAndProceed = () => {
    setCurrentKioskStep(3);
  };

  return (
    <div
      id="step-2-consent-screen"
      className="w-full max-w-3xl mx-auto space-y-6 animate-fadeIn text-left"
    >
      {/* Voice Prompter Bar */}
      <VoicePrompter
        promptEn={consentAudioPromptEn}
        promptHi={consentAudioPromptHi}
      />

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div
            className="p-2.5 rounded-xl text-white inline-flex"
            style={{ backgroundColor: theme.colors.primary }}
          >
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2
              className="text-2xl sm:text-3xl font-extrabold"
              style={{ color: theme.colors.textPrimary }}
            >
              {language === 'hi'
                ? 'गोपनीयता एवं सहमति (Privacy & Consent)'
                : 'Digital Health Consent'}
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              {language === 'hi'
                ? 'स्वास्थ्य डेटा संग्रह से पूर्व आवश्यक'
                : 'Required before collecting medical history'}
            </p>
          </div>
        </div>
      </div>

      {/* Plain Language Summary Card */}
      <div
        className="p-6 rounded-2xl border-2 space-y-4"
        style={{
          backgroundColor: theme.colors.bgCard,
          borderColor: theme.colors.borderDefault,
        }}
      >
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Lock className="w-5 h-5 text-emerald-600" />
          <span>
            {language === 'hi'
              ? 'आपकी जानकारी सुरक्षित और निजी है'
              : 'Plain Language Health Privacy Notice'}
          </span>
        </h3>

        <ul className="space-y-3 text-base text-slate-700 font-medium">
          <li className="flex items-start gap-2.5">
            <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              {language === 'hi'
                ? 'आपके द्वारा बताए गए लक्षण केवल आपके ड्यूटी डॉक्टर के स्क्रीन पर भेजे जाएंगे।'
                : 'Your reported symptoms will only be transmitted to your consultation room physician.'}
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              {language === 'hi'
                ? 'आपकी सहमति के बिना यह डेटा किसी तीसरे पक्ष या विज्ञापनदाता को नहीं दिया जाएगा।'
                : 'Your medical data is never sold or shared with any third party or advertisers.'}
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              {language === 'hi'
                ? 'आप किसी भी सवाल को छोड़ने या सीधे डॉक्टर से बात करने के लिए स्वतंत्र हैं।'
                : 'You have the right to skip any question or consult the doctor directly.'}
            </span>
          </li>
        </ul>
      </div>

      {/* Granular Toggles */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          {language === 'hi' ? 'विशिष्ट अनुमतियां (Granular Preferences)' : 'Granular Permissions'}
        </h4>

        {/* Toggle 1: AI Clinical Processing */}
        <label
          className="p-4 bg-white rounded-xl border-2 border-slate-300 flex items-center justify-between gap-4 cursor-pointer hover:border-slate-400"
        >
          <div className="flex items-center gap-3">
            <FileCheck className="w-5 h-5 text-cyan-700" />
            <div>
              <span className="font-bold text-slate-900 block text-base">
                {language === 'hi'
                  ? 'ए.आई. वॉइस व क्लिनिकल समरी तैयार करना'
                  : 'AI Voice & Clinical History Processing'}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {language === 'hi' ? 'इतिहास को डॉक्टर के लिए संरचित करना' : 'Synthesizes clinical note for physician'}
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={consentAI}
            onChange={(e) => setConsentAI(e.target.checked)}
            className="w-6 h-6 text-cyan-700 rounded focus:ring-cyan-500"
          />
        </label>

        {/* Toggle 2: Sync to Doctor EMR */}
        <label
          className="p-4 bg-white rounded-xl border-2 border-slate-300 flex items-center justify-between gap-4 cursor-pointer hover:border-slate-400"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            <div>
              <span className="font-bold text-slate-900 block text-base">
                {language === 'hi'
                  ? 'अस्पताल ओ.पी.डी. व डॉक्टर पोर्टल के साथ साझा'
                  : 'Transmit Directly to Doctor OPD Queue'}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {language === 'hi' ? 'डॉक्टर के डेस्क पर विवरण तुरंत उपलब्ध होगा' : 'Enables doctor to review prior to entry'}
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={consentEHR}
            onChange={(e) => setConsentEHR(e.target.checked)}
            className="w-6 h-6 text-emerald-700 rounded focus:ring-emerald-500"
          />
        </label>

        {/* Toggle 3: Anonymous Research */}
        <label
          className="p-4 bg-white rounded-xl border-2 border-slate-300 flex items-center justify-between gap-4 cursor-pointer hover:border-slate-400"
        >
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5 text-slate-500" />
            <div>
              <span className="font-bold text-slate-900 block text-base">
                {language === 'hi'
                  ? 'गुमनाम स्वास्थ्य अनुसंधान (वैकल्पिक)'
                  : 'Anonymous Clinical Quality Audit (Optional)'}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {language === 'hi' ? 'नाम व पहचान हटाकर अस्पताल सुधार हेतु' : 'De-identified data for public health metrics'}
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={consentResearch}
            onChange={(e) => setConsentResearch(e.target.checked)}
            className="w-6 h-6 text-slate-700 rounded focus:ring-slate-500"
          />
        </label>
      </div>

      {/* Primary Action Button: Big Green Yes */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={() => setCurrentKioskStep(1)}
          className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold flex items-center justify-center gap-2 hover:bg-slate-100 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>{language === 'hi' ? 'पीछे जाएं' : 'Back'}</span>
        </button>

        <button
          id="btn-confirm-consent"
          type="button"
          disabled={!consentAI || !consentEHR}
          onClick={handleAgreeAndProceed}
          className={`w-full sm:w-auto px-10 py-4 rounded-2xl font-extrabold text-xl flex items-center justify-center gap-3 shadow-lg transition-all transform active:scale-95 cursor-pointer min-h-[64px] ${
            consentAI && consentEHR
              ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Check className="w-7 h-7" />
          <span>
            {language === 'hi'
              ? 'हाँ, मैं सहमत हूँ (Yes, I Consent)'
              : 'Yes, I Agree & Continue'}
          </span>
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
