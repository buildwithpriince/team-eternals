import React, { useState, useEffect } from 'react';
import { HelpCircle, ArrowRight, Sparkles, Stethoscope } from 'lucide-react';
import { BackendQuestionContract, QuestionOption } from '../types';
import { OptionChip } from './OptionChip';
import { VoicePrompter } from './VoicePrompter';
import { useApp } from '../context/AppContext';

interface QuestionCardProps {
  question: BackendQuestionContract;
  onAnswerSelected: (option: QuestionOption, customText?: string) => void;
  selectedOptionId?: string;
  isSubmitting?: boolean;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  onAnswerSelected,
  selectedOptionId,
  isSubmitting = false,
}) => {
  const { language, theme, speakText, autoVoiceEnabled } = useApp();
  const [currentSelected, setCurrentSelected] = useState<string | undefined>(selectedOptionId);
  const [customFreeText, setCustomFreeText] = useState<string>('');

  // When question changes, speak question if autoVoice is on
  useEffect(() => {
    setCurrentSelected(selectedOptionId);
    setCustomFreeText('');

    if (autoVoiceEnabled) {
      const audioPrompt =
        language === 'hi'
          ? question.audio_prompt_hi || question.question_hi
          : question.audio_prompt_en || question.question_en;
      speakText(audioPrompt, language);
    }
  }, [question.id, language]);

  const handleSelectOption = (option: QuestionOption) => {
    setCurrentSelected(option.id);
  };

  const handleConfirmNext = () => {
    if (question.input_type === 'free_text') {
      const pseudoOpt: QuestionOption = {
        id: 'free_text_entry',
        text_en: customFreeText || 'Not specified',
        text_hi: customFreeText || 'कोई विवरण नहीं',
      };
      onAnswerSelected(pseudoOpt, customFreeText);
      return;
    }

    const matched = question.options.find((o) => o.id === currentSelected);
    if (matched) {
      onAnswerSelected(matched);
    }
  };

  return (
    <div
      id={`question-card-${question.id}`}
      className="w-full bg-white rounded-2xl p-5 sm:p-8 border-2 shadow-md space-y-6 animate-fadeIn"
      style={{ borderColor: theme.colors.borderDefault }}
    >
      {/* Top Banner: Voice prompt bar */}
      <VoicePrompter
        promptEn={question.audio_prompt_en || question.question_en}
        promptHi={question.audio_prompt_hi || question.question_hi}
        onVoiceInput={(transcript) => {
          setCustomFreeText(transcript);
          // Try to match option
          const lower = transcript.toLowerCase();
          const match = question.options.find(
            (o) =>
              o.text_hi.toLowerCase().includes(lower) ||
              o.text_en.toLowerCase().includes(lower) ||
              lower.includes(o.id)
          );
          if (match) {
            setCurrentSelected(match.id);
          }
        }}
      />

      {/* Main Question Heading */}
      <div className="space-y-2 text-left">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider"
            style={{
              backgroundColor: theme.colors.primaryLight,
              color: theme.colors.primaryDark,
            }}
          >
            <Stethoscope className="w-3.5 h-3.5" />
            {question.section.replace('_', ' ')}
          </span>

          {question.symptom_tags.map((tag, idx) => (
            <span
              key={idx}
              className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200"
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* Primary Language Question */}
        <h2
          className="text-2xl sm:text-3xl font-extrabold leading-snug"
          style={{ color: theme.colors.textPrimary }}
        >
          {language === 'hi' ? question.question_hi : question.question_en}
        </h2>

        {/* Dual-language Subtitle */}
        <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed">
          {language === 'hi' ? question.question_en : question.question_hi}
        </p>
      </div>

      {/* Option Chips or Free Text Input */}
      {question.input_type === 'single_select' ? (
        <div className="space-y-3 pt-2">
          {question.options.map((opt, idx) => (
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
        <div className="space-y-3 pt-2">
          <label className="block text-base font-bold text-slate-800">
            {language === 'hi' ? 'अपना उत्तर यहां लिखें या बोलें:' : 'Enter or speak your response:'}
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
            className="w-full p-4 rounded-xl border-2 border-slate-300 focus:border-cyan-700 focus:ring-4 focus:ring-cyan-100 text-lg font-medium text-slate-900"
          />
        </div>
      )}

      {/* Clinical Rationale Hint */}
      {question.clinical_rationale && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5 text-xs text-slate-600">
          <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-800">
              {language === 'hi' ? 'क्लिनिकल तर्क (Clinical Rationale): ' : 'Clinical Rationale: '}
            </span>
            {question.clinical_rationale}
          </div>
        </div>
      )}

      {/* Primary Action Button (Single Prominent Action) */}
      <div className="pt-4 border-t border-slate-200 flex justify-end">
        <button
          id="btn-confirm-next-question"
          type="button"
          disabled={
            (!currentSelected && question.input_type === 'single_select') ||
            (question.input_type === 'free_text' && !customFreeText.trim()) ||
            isSubmitting
          }
          onClick={handleConfirmNext}
          className={`w-full sm:w-auto px-8 py-4 rounded-xl font-extrabold text-lg flex items-center justify-center gap-3 shadow-lg transition-all active:scale-95 cursor-pointer min-h-[56px] ${
            (!currentSelected && question.input_type === 'single_select') ||
            (question.input_type === 'free_text' && !customFreeText.trim())
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              : 'text-white'
          }`}
          style={{
            backgroundColor:
              currentSelected || (question.input_type === 'free_text' && customFreeText.trim())
                ? theme.colors.primary
                : undefined,
          }}
        >
          <span>
            {question.interview_complete
              ? language === 'hi'
                ? 'पूछताछ पूर्ण करें (Finish Interview)'
                : 'Complete Interview'
              : language === 'hi'
              ? 'आगे बढ़ें (Next Question)'
              : 'Next Question'}
          </span>
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
