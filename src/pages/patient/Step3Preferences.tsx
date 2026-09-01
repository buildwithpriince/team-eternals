import React, { useEffect } from 'react';
import { Globe, Mic, Touchpad, Stethoscope, Sparkles, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { VoicePrompter } from '../../components/VoicePrompter';
import { Department, AppLanguage, InputMode } from '../../types';
import { speechService } from '../../utils/speech';
import { generalClinicalQuestions, ayushClinicalQuestions } from '../../data/clinicalQuestions';

export const Step3Preferences: React.FC = () => {
  const {
    language,
    setLanguage,
    inputMode,
    setInputMode,
    department,
    setDepartment,
    theme,
    speakText,
    setCurrentKioskStep,
    updateKioskPatient,
  } = useApp();

  const prefPromptHi =
    'कृपया अपनी भाषा, उत्तर देने का तरीका, और अपना विभाग (सामान्य चिकित्सा या आयुष आयुर्वेद) चुनें।';
  const prefPromptEn =
    'Please select your language, voice or touch preference, and consultation department.';

  useEffect(() => {
    speakText(language === 'hi' ? prefPromptHi : prefPromptEn, language);

    // Pre-fetch the first question of both general and ayush tracks in background
    const qList = department === 'ayush' ? ayushClinicalQuestions : generalClinicalQuestions;
    const firstQ = qList[0];
    if (firstQ) {
      const qPrompt = language === 'hi' ? (firstQ.audio_prompt_hi || firstQ.question_hi) : (firstQ.audio_prompt_en || firstQ.question_en);
      speechService.prefetch(qPrompt, language);
    }
  }, [language, department]);

  const handleSelectDepartment = (dept: Department) => {
    setDepartment(dept);
    updateKioskPatient({ department: dept });
  };

  const handleProceed = () => {
    updateKioskPatient({
      language,
      inputMode,
      department,
    });
    setCurrentKioskStep(4);
  };

  return (
    <div
      id="step-3-preferences-screen"
      className="w-full max-w-4xl mx-auto space-y-8 animate-fadeIn text-left"
    >
      <VoicePrompter
        promptEn={prefPromptEn}
        promptHi={prefPromptHi}
      />

      {/* Header */}
      <div>
        <h2
          className="text-2xl sm:text-3xl font-extrabold"
          style={{ color: theme.colors.textPrimary }}
        >
          {language === 'hi'
            ? 'अपनी प्राथमिकताएं चुनें (Setup Preferences)'
            : 'Select Preferences & Department'}
        </h2>
        <p className="text-sm sm:text-base text-slate-600 font-medium mt-1">
          {language === 'hi'
            ? 'आप किस भाषा में और किस विभाग के डॉक्टर को दिखाना चाहते हैं?'
            : 'Choose your language, input preference, and OPD department.'}
        </p>
      </div>

      {/* 1. Language Select */}
      <div className="space-y-3">
        <label className="block text-base font-extrabold text-slate-900 flex items-center gap-2">
          <Globe className="w-5 h-5 text-cyan-700" />
          <span>1. {language === 'hi' ? 'भाषा का चयन करें' : 'Select Language'}</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            id="btn-pref-lang-hi"
            type="button"
            onClick={() => setLanguage('hi')}
            className={`p-5 rounded-2xl border-3 flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer min-h-[72px] ${
              language === 'hi'
                ? 'bg-amber-50/60 border-amber-600 shadow-md ring-2 ring-amber-300'
                : 'bg-white border-slate-300 hover:border-slate-400'
            }`}
          >
            <div>
              <span className="text-2xl font-black text-slate-900 block">
                हिंदी (Hindi)
              </span>
              <span className="text-sm text-slate-600 font-medium">
                सरल हिंदी में प्रश्न व आवाज
              </span>
            </div>
            {language === 'hi' && (
              <CheckCircle2 className="w-8 h-8 text-amber-700 shrink-0" />
            )}
          </button>

          <button
            id="btn-pref-lang-en"
            type="button"
            onClick={() => setLanguage('en')}
            className={`p-5 rounded-2xl border-3 flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer min-h-[72px] ${
              language === 'en'
                ? 'bg-blue-50/60 border-blue-600 shadow-md ring-2 ring-blue-300'
                : 'bg-white border-slate-300 hover:border-slate-400'
            }`}
          >
            <div>
              <span className="text-2xl font-black text-slate-900 block">
                English
              </span>
              <span className="text-sm text-slate-600 font-medium">
                English audio & text interview
              </span>
            </div>
            {language === 'en' && (
              <CheckCircle2 className="w-8 h-8 text-blue-700 shrink-0" />
            )}
          </button>
        </div>
      </div>

      {/* 2. Speak or Tap Choice */}
      <div className="space-y-3">
        <label className="block text-base font-extrabold text-slate-900 flex items-center gap-2">
          <Mic className="w-5 h-5 text-emerald-700" />
          <span>2. {language === 'hi' ? 'उत्तर देने का तरीका (Speak or Tap?)' : 'Input Preference'}</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            id="btn-pref-mode-voice"
            type="button"
            onClick={() => setInputMode('voice')}
            className={`p-5 rounded-2xl border-3 flex items-center gap-4 text-left transition-all active:scale-[0.98] cursor-pointer min-h-[72px] ${
              inputMode === 'voice'
                ? 'bg-emerald-50/80 border-emerald-600 shadow-md ring-2 ring-emerald-300'
                : 'bg-white border-slate-300 hover:border-slate-400'
            }`}
          >
            <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
              <Mic className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <span className="text-xl font-bold text-slate-900 block">
                {language === 'hi' ? 'बोलकर बताएं (Voice Mode)' : 'Speak by Voice'}
              </span>
              <span className="text-xs sm:text-sm text-slate-600 font-medium">
                {language === 'hi'
                  ? 'बुजुर्गों व बिना टाइप किए उत्तर देने हेतु'
                  : 'Voice-assisted handsfree prompts'}
              </span>
            </div>
            {inputMode === 'voice' && (
              <CheckCircle2 className="w-7 h-7 text-emerald-700 shrink-0" />
            )}
          </button>

          <button
            id="btn-pref-mode-touch"
            type="button"
            onClick={() => setInputMode('touch')}
            className={`p-5 rounded-2xl border-3 flex items-center gap-4 text-left transition-all active:scale-[0.98] cursor-pointer min-h-[72px] ${
              inputMode === 'touch'
                ? 'bg-cyan-50/80 border-cyan-600 shadow-md ring-2 ring-cyan-300'
                : 'bg-white border-slate-300 hover:border-slate-400'
            }`}
          >
            <div className="p-3 bg-cyan-100 text-cyan-800 rounded-xl">
              <Touchpad className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <span className="text-xl font-bold text-slate-900 block">
                {language === 'hi' ? 'स्क्रीन छूकर (Touch Mode)' : 'Touch / Tap Mode'}
              </span>
              <span className="text-xs sm:text-sm text-slate-600 font-medium">
                {language === 'hi'
                  ? 'बड़े बटनों को दबाकर उत्तर दें'
                  : 'Large tappable option chips'}
              </span>
            </div>
            {inputMode === 'touch' && (
              <CheckCircle2 className="w-7 h-7 text-cyan-700 shrink-0" />
            )}
          </button>
        </div>
      </div>

      {/* 3. Department Select (Determines the Theme!) */}
      <div className="space-y-3">
        <label className="block text-base font-extrabold text-slate-900 flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-indigo-700" />
          <span>3. {language === 'hi' ? 'विभाग चुनें (Department)' : 'Select Consultation Department'}</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* General Medicine */}
          <button
            id="btn-dept-general"
            type="button"
            onClick={() => handleSelectDepartment('general')}
            className={`p-6 rounded-2xl border-3 flex flex-col justify-between text-left transition-all active:scale-[0.98] cursor-pointer min-h-[140px] ${
              department === 'general'
                ? 'bg-[#E0F2FE]/70 border-[#0E4A5C] shadow-lg ring-2 ring-[#0E4A5C]/40'
                : 'bg-white border-slate-300 hover:border-slate-400'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="p-3 bg-[#0E4A5C] text-white rounded-xl">
                <Stethoscope className="w-7 h-7" />
              </div>
              {department === 'general' && (
                <span className="px-3 py-1 bg-[#0E4A5C] text-white text-xs font-extrabold rounded-full">
                  {language === 'hi' ? 'सक्रिय थीम' : 'Active Theme'}
                </span>
              )}
            </div>

            <div className="mt-3">
              <span className="text-xl sm:text-2xl font-black text-slate-950 block">
                {language === 'hi' ? 'सामान्य चिकित्सा (General OPD)' : 'General Medicine OPD'}
              </span>
              <p className="text-xs sm:text-sm text-slate-700 font-medium mt-1">
                {language === 'hi'
                  ? 'बुखार, खांसी, छाती दर्द, बीपी, शुगर व अन्य एलोपैथिक जांच'
                  : 'Internal Medicine, Cardio, Chest, Acute & Chronic clinical care'}
              </p>
            </div>
          </button>

          {/* AYUSH / Ayurvedic */}
          <button
            id="btn-dept-ayush"
            type="button"
            onClick={() => handleSelectDepartment('ayush')}
            className={`p-6 rounded-2xl border-3 flex flex-col justify-between text-left transition-all active:scale-[0.98] cursor-pointer min-h-[140px] ${
              department === 'ayush'
                ? 'bg-[#E8F3EE] border-[#1B4332] shadow-lg ring-2 ring-[#1B4332]/40'
                : 'bg-white border-slate-300 hover:border-slate-400'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="p-3 bg-[#1B4332] text-white rounded-xl">
                <Sparkles className="w-7 h-7 text-amber-300" />
              </div>
              {department === 'ayush' && (
                <span className="px-3 py-1 bg-[#1B4332] text-white text-xs font-extrabold rounded-full">
                  {language === 'hi' ? 'सक्रिय आयुष थीम' : 'Active AYUSH'}
                </span>
              )}
            </div>

            <div className="mt-3">
              <span className="text-xl sm:text-2xl font-black text-[#19241E] block">
                {language === 'hi' ? 'आयुष एवं आयुर्वेद ओ.पी.डी.' : 'AYUSH & Ayurvedic OPD'}
              </span>
              <p className="text-xs sm:text-sm text-[#3D4F46] font-medium mt-1">
                {language === 'hi'
                  ? 'दशविध परीक्षा, प्रकृति, जठराग्नि, वात-पित्त-कफ एवं पंचकर्म'
                  : 'Dosha evaluation, Prakriti, Agni, Kostha & Ayurvedic therapies'}
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Navigation actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={() => setCurrentKioskStep(2)}
          className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-slate-300 text-slate-700 font-bold flex items-center justify-center gap-2 hover:bg-slate-100 cursor-pointer text-base"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>{language === 'hi' ? 'पीछे' : 'Back'}</span>
        </button>

        <button
          id="btn-proceed-to-interview"
          type="button"
          onClick={handleProceed}
          className="w-full sm:w-auto px-10 py-4 rounded-2xl font-extrabold text-xl text-white shadow-xl flex items-center justify-center gap-3 transition-all transform active:scale-95 cursor-pointer min-h-[64px]"
          style={{ backgroundColor: theme.colors.primary }}
        >
          <span>
            {language === 'hi'
              ? 'पूछताछ शुरू करें (Start Interview)'
              : 'Begin History Interview'}
          </span>
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
