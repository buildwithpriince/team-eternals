import React, { useState, useEffect } from 'react';
import { ArrowLeft, RotateCcw, Volume2, Sparkles, AlertTriangle, Stethoscope, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { OptionChip } from '../../components/OptionChip';
import { generalClinicalQuestions, ayushClinicalQuestions } from '../../data/clinicalQuestions';
import { BackendQuestionContract, QuestionOption, Department } from '../../types';

export const Step4Interview: React.FC = () => {
  const {
    department,
    setDepartment,
    language,
    saveKioskAnswer,
    kioskPatient,
    setCurrentKioskStep,
    theme,
    speakText,
    isSpeaking,
    autoVoiceEnabled,
  } = useApp();

  // Pick question set based on active department
  const questions: BackendQuestionContract[] =
    department === 'ayush' ? ayushClinicalQuestions : generalClinicalQuestions;

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const currentQuestion = questions[currentIndex] || questions[0];

  const [currentSelected, setCurrentSelected] = useState<string | undefined>(undefined);
  const [customFreeText, setCustomFreeText] = useState<string>('');

  // Find previously saved answer for this question if any
  useEffect(() => {
    const prevAns = kioskPatient.historyAnswers?.[currentQuestion.id];
    if (prevAns) {
      const match = currentQuestion.options.find(
        (o) => o.text_en === prevAns.answer_en || o.text_hi === prevAns.answer_hi
      );
      if (match) setCurrentSelected(match.id);
      else setCustomFreeText(prevAns.answer_en || '');
    } else {
      setCurrentSelected(undefined);
      setCustomFreeText('');
    }

    if (autoVoiceEnabled) {
      const audioPrompt =
        language === 'hi'
          ? currentQuestion.audio_prompt_hi || currentQuestion.question_hi
          : currentQuestion.audio_prompt_en || currentQuestion.question_en;
      speakText(audioPrompt, language);
    }
  }, [currentQuestion.id, language]);

  const handleSelectOption = (option: QuestionOption) => {
    setCurrentSelected(option.id);
  };

  const handleRepeatVoice = () => {
    const audioPrompt =
      language === 'hi'
        ? currentQuestion.audio_prompt_hi || currentQuestion.question_hi
        : currentQuestion.audio_prompt_en || currentQuestion.question_en;
    speakText(audioPrompt, language);
  };

  const handleConfirmNext = () => {
    let chosenOption: QuestionOption | undefined;
    let customText: string | undefined;

    if (currentQuestion.input_type === 'free_text') {
      chosenOption = {
        id: 'free_text_entry',
        text_en: customFreeText || 'Not specified',
        text_hi: customFreeText || 'कोई विवरण नहीं',
      };
      customText = customFreeText;
    } else {
      chosenOption = currentQuestion.options.find((o) => o.id === currentSelected);
    }

    if (!chosenOption) return;

    const textEn = customText || chosenOption.text_en;
    const textHi = customText || chosenOption.text_hi;

    saveKioskAnswer(
      currentQuestion.id,
      currentQuestion.question_en,
      currentQuestion.question_hi,
      currentQuestion.section,
      textEn,
      textHi,
      chosenOption.red_flag,
      chosenOption.red_flag_reason
    );

    // If next question exists
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Completed all questions -> move to document scan
      setCurrentKioskStep(5);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else {
      setCurrentKioskStep(3);
    }
  };

  const hasActiveRedFlag =
    currentQuestion.options.find((o) => o.id === currentSelected)?.red_flag ||
    (kioskPatient.redFlags && kioskPatient.redFlags.length > 0);

  const activeRedFlagReason =
    currentQuestion.options.find((o) => o.id === currentSelected)?.red_flag_reason ||
    kioskPatient.redFlags?.[0] ||
    'Patient reports urgent acute discomfort requiring fast-track triage.';

  return (
    <div
      id="step-4-interview-container"
      className="w-full max-w-7xl mx-auto flex flex-col space-y-6 animate-fadeIn text-left"
    >
      {/* 12-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Left Section (8 Cols) */}
        <section className="col-span-12 lg:col-span-8 flex flex-col space-y-6">
          {/* Section Indicator & Dual Headings */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-[#102A43]/70">
                Section: {currentQuestion.section.replace(/_/g, ' ')} |{' '}
                {language === 'hi' ? 'नैदानिक पूछताछ' : 'Clinical Interview'}
              </span>
              <span className="text-xs font-extrabold px-2.5 py-1 bg-slate-200 text-slate-700 rounded-md">
                {currentIndex + 1} / {questions.length}
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight text-[#102A43]">
              {language === 'hi' ? currentQuestion.question_hi : currentQuestion.question_en}
            </h2>
            <h3 className="text-2xl sm:text-3xl font-bold text-slate-600 leading-snug">
              {language === 'hi' ? currentQuestion.question_en : currentQuestion.question_hi}
            </h3>
          </div>

          {/* Options Grid (2-Column Polish Cards) */}
          {currentQuestion.input_type === 'single_select' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentQuestion.options.map((opt, idx) => (
                <OptionChip
                  key={opt.id}
                  option={opt}
                  index={idx}
                  isSelected={currentSelected === opt.id}
                  onSelect={handleSelectOption}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3 bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-xs">
              <label className="block text-base font-bold text-slate-800">
                {language === 'hi'
                  ? 'अपना उत्तर यहां लिखें या बोलें:'
                  : 'Enter or speak your response:'}
              </label>
              <textarea
                id="input-question-free-text"
                rows={4}
                value={customFreeText}
                onChange={(e) => setCustomFreeText(e.target.value)}
                placeholder={
                  language === 'hi'
                    ? 'अपनी तकलीफ का विस्तार से वर्णन करें...'
                    : 'Describe your symptoms in your own words...'
                }
                className="w-full p-4 rounded-xl border-2 border-slate-300 focus:border-[#102A43] focus:ring-4 focus:ring-slate-100 text-lg font-medium text-slate-900"
              />
            </div>
          )}

          {/* Clinical Rationale Hint */}
          {currentQuestion.clinical_rationale && (
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-start gap-2.5 text-xs text-slate-600 shadow-2xs">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900">
                  {language === 'hi' ? 'क्लिनिकल तर्क: ' : 'Clinical Rationale: '}
                </span>
                {currentQuestion.clinical_rationale}
              </div>
            </div>
          )}
        </section>

        {/* Aside / Doctor's Real-Time Summary Sidebar (4 Cols) */}
        <aside className="col-span-12 lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 flex flex-col space-y-6 shadow-xs">
          {/* Doctor Real-time View Header */}
          <div className="pb-4 border-b border-slate-100 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Doctor's Real-time View / चिकित्सक पूर्वावलोकन
            </h3>

            {/* Critical Red Flag Box if present */}
            {hasActiveRedFlag ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
                <div className="flex items-center space-x-2 text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-xs font-black uppercase tracking-wider">
                    Critical Red Flag / गंभीर लक्षण
                  </span>
                </div>
                <p className="text-sm font-bold text-red-900 leading-snug">
                  {activeRedFlagReason}
                </p>
              </div>
            ) : (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-center gap-2 text-xs font-bold text-emerald-800">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span>Normal clinical trajectory • No acute flags</span>
              </div>
            )}
          </div>

          {/* Interview Summary Timeline */}
          <div className="flex-1 overflow-hidden space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Interview Summary / दर्ज विवरण
            </h4>

            <div className="space-y-3 text-sm">
              <div className="flex items-start space-x-3">
                <div className="w-1.5 h-10 bg-emerald-500 rounded-full mt-1 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Current Chief Concern
                  </p>
                  <p className="text-sm font-bold text-slate-900 leading-tight">
                    {kioskPatient.chiefComplaints?.[0] || 'Chest Pain / Acute Discomfort'}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-1.5 h-10 bg-[#102A43] rounded-full mt-1 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Active Section
                  </p>
                  <p className="text-sm font-semibold text-slate-800">
                    {currentQuestion.section.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>

              {/* Symptom Tags */}
              <div className="flex items-start space-x-3 pt-1">
                <div className="w-1.5 h-10 bg-slate-300 rounded-full mt-1 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Symptom Tags
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {currentQuestion.symptom_tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-700"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Department Mode Selector in Sidebar */}
          <div className="p-4 bg-[#F2F5F7] rounded-2xl border border-slate-200 space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Department Mode / विभाग
            </p>
            <div className="flex p-1 bg-white rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setDepartment('general')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                  department === 'general'
                    ? 'bg-[#102A43] text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Clinical OPD
              </button>
              <button
                type="button"
                onClick={() => setDepartment('ayush')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                  department === 'ayush'
                    ? 'bg-[#1B4332] text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                AYUSH
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Footer Navigation Bar (Matching Professional Polish Theme) */}
      <footer className="w-full bg-white border border-slate-200 rounded-2xl px-6 sm:px-10 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        {/* Left: Back & Repeat Voice Actions */}
        <div className="flex items-center space-x-6 sm:space-x-8">
          <button
            type="button"
            onClick={handlePreviousQuestion}
            className="flex items-center space-x-3 group cursor-pointer text-left"
          >
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition-colors">
              <ArrowLeft className="w-6 h-6 text-[#102A43]" />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Back</p>
              <p className="text-sm font-bold text-[#102A43]">पीछे जाएं</p>
            </div>
          </button>

          <button
            type="button"
            onClick={handleRepeatVoice}
            className="flex items-center space-x-3 group cursor-pointer text-left"
          >
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition-colors">
              <RotateCcw className="w-6 h-6 text-[#102A43]" />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-slate-400">Repeat</p>
              <p className="text-sm font-bold text-[#102A43]">फिर से बोलें</p>
            </div>
          </button>
        </div>

        {/* Right: Audio Wave Equalizer & Next Button */}
        <div className="flex items-center space-x-6">
          {/* Animated Audio Equalizer Bars */}
          <div className="flex space-x-1 items-center" title="Voice audio channel active">
            <div className={`w-1 bg-blue-400 rounded-full transition-all duration-200 ${isSpeaking ? 'h-5 animate-pulse' : 'h-3'}`} />
            <div className={`w-1 bg-blue-500 rounded-full transition-all duration-200 ${isSpeaking ? 'h-8 animate-pulse' : 'h-6'}`} />
            <div className={`w-1 bg-blue-400 rounded-full transition-all duration-200 ${isSpeaking ? 'h-6 animate-pulse' : 'h-4'}`} />
            <div className={`w-1 bg-blue-600 rounded-full transition-all duration-200 ${isSpeaking ? 'h-10 animate-pulse' : 'h-7'}`} />
            <div className={`w-1 bg-blue-400 rounded-full transition-all duration-200 ${isSpeaking ? 'h-5 animate-pulse' : 'h-3'}`} />
          </div>

          {/* Next Button CTA (Warm Amber with yellow border-b-4) */}
          <button
            id="btn-confirm-next-question"
            type="button"
            disabled={
              (!currentSelected && currentQuestion.input_type === 'single_select') ||
              (currentQuestion.input_type === 'free_text' && !customFreeText.trim())
            }
            onClick={handleConfirmNext}
            className={`px-8 sm:px-10 py-3.5 sm:py-4 rounded-2xl font-black text-base sm:text-lg shadow-xl shadow-yellow-100/50 border-b-4 border-yellow-600 active:border-b-0 active:translate-y-1 transition-all cursor-pointer flex items-center gap-2 ${
              (!currentSelected && currentQuestion.input_type === 'single_select') ||
              (currentQuestion.input_type === 'free_text' && !customFreeText.trim())
                ? 'bg-slate-200 text-slate-400 border-slate-300 shadow-none cursor-not-allowed'
                : 'bg-[#F0B429] text-[#102A43] hover:brightness-105'
            }`}
          >
            <span>
              {currentIndex === questions.length - 1
                ? language === 'hi'
                  ? 'पूर्ण करें | FINISH'
                  : 'NEXT | अगला'
                : 'NEXT | अगला'}
            </span>
          </button>
        </div>
      </footer>
    </div>
  );
};
