import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, ArrowRight, Sparkles, Stethoscope, Loader2 } from 'lucide-react';
import { BackendQuestionContract, QuestionOption } from '../types';
import { OptionChip } from './OptionChip';
import { VoicePrompter } from './VoicePrompter';
import { useApp } from '../context/AppContext';
import { matchVoiceToOptions, matchSemanticsLocally } from '../utils/aiMatcher';
import { toggleMultiSelectOption, resolveMultiSelectVoiceIds } from '../utils/optionUtils';
import { speechService } from '../utils/speech';

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
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [customFreeText, setCustomFreeText] = useState<string>('');
  const [isMatchingVoice, setIsMatchingVoice] = useState<boolean>(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);

  const activeQuestionIdRef = useRef<string>(question.id);

  // When question changes, speak question if autoVoice is on and clear previous state
  useEffect(() => {
    activeQuestionIdRef.current = question.id;
    setCurrentSelected(selectedOptionId);
    setSelectedOptionIds([]);
    setCustomFreeText('');
    setVoiceStatus(null);
    setIsMatchingVoice(false);

    if (autoVoiceEnabled) {
      const audioPrompt =
        language === 'hi'
          ? question.audio_prompt_hi || question.question_hi
          : question.audio_prompt_en || question.question_en;
      speakText(audioPrompt, language);
    }
  }, [question.id, language]);

  const handleSelectOption = (option: QuestionOption) => {
    if (question.input_type === 'multi_select') {
      setSelectedOptionIds((prev) =>
        toggleMultiSelectOption(question.options || [], prev, option)
      );
    } else {
      setCurrentSelected(option.id);
    }
  };

  const handleVoiceInput = async (transcript: string) => {
    const targetQId = question.id;
    if (!transcript.trim()) return;

    if (question.input_type === 'free_text') {
      if (activeQuestionIdRef.current !== targetQId) return;
      setCustomFreeText(transcript);
      setVoiceStatus(language === 'hi' ? `दर्ज हुआ: "${transcript}"` : `Transcribed: "${transcript}"`);
      speechService.playChime('success');
      return;
    }

    // Instant semantic match first (e.g. "5 months" -> "> 1 to 3 months", severity, etc.)
    const localSemantic = matchSemanticsLocally(transcript, question.options);
    let instant: QuestionOption | undefined;
    if (localSemantic.matchedIds && localSemantic.matchedIds.length > 0) {
      if (question.input_type === 'multi_select') {
        const matched = question.options.filter((opt) => localSemantic.matchedIds.includes(opt.id));
        if (matched.length > 0) {
          if (activeQuestionIdRef.current !== targetQId) return;
          setSelectedOptionIds((prev) =>
            resolveMultiSelectVoiceIds(question.options || [], prev, matched)
          );
          const names = matched.map((o) => (language === 'hi' ? o.text_hi : o.text_en)).join(', ');
          setVoiceStatus(language === 'hi' ? `चयनित: ${names}` : `Matched: ${names}`);
          speechService.playChime('success');
        }
      } else {
        instant = question.options.find((opt) => opt.id === localSemantic.matchedIds[0]);
        if (instant) {
          if (activeQuestionIdRef.current !== targetQId) return;
          handleSelectOption(instant);
          setVoiceStatus(
            language === 'hi'
              ? `चयनित: ${instant.text_hi}`
              : `Matched & Selected: ${instant.text_en}`
          );
          speechService.playChime('success');
        }
      }
    }

    if (!instant && question.input_type !== 'multi_select') {
      if (activeQuestionIdRef.current !== targetQId) return;
      setIsMatchingVoice(true);
      setVoiceStatus(language === 'hi' ? 'Gemini AI सटीक विकल्प खोज रहा है...' : 'Matching with Gemini Flash AI...');
    }

    try {
      const matchResult = await matchVoiceToOptions(
        transcript,
        {
          id: question.id,
          question_en: question.question_en,
          question_hi: question.question_hi,
        },
        question.options,
        language
      );

      if (activeQuestionIdRef.current !== targetQId) return;
      setIsMatchingVoice(false);

      if (matchResult.matchedIds && matchResult.matchedIds.length > 0) {
        const matched = question.options.filter((o) => matchResult.matchedIds.includes(o.id));
        if (matched.length > 0) {
          if (question.input_type === 'multi_select') {
            setSelectedOptionIds((prev) =>
              resolveMultiSelectVoiceIds(question.options || [], prev, matched)
            );
          } else {
            handleSelectOption(matched[0]);
          }
          const names = matched.map((o) => (language === 'hi' ? o.text_hi : o.text_en)).join(', ');
          setVoiceStatus(
            language === 'hi'
              ? `चयनित: ${names}`
              : `Matched & Selected: ${names}`
          );
          speechService.playChime('success');
          return;
        }
      }

      if (!instant) {
        setVoiceStatus(
          language === 'hi'
            ? `कोई मिलान नहीं मिला ("${transcript}")। कृपया नीचे से चुनें।`
            : `No match found ("${transcript}"). Please select below.`
        );
      }
    } catch (err) {
      if (activeQuestionIdRef.current === targetQId) {
        setIsMatchingVoice(false);
      }
      console.error('QuestionCard voice match error:', err);
    }
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

    if (question.input_type === 'multi_select') {
      const matched = question.options.filter((o) => selectedOptionIds.includes(o.id));
      if (matched.length > 0) {
        const combinedOpt: QuestionOption = {
          id: matched.map((o) => o.id).join('_'),
          text_en: matched.map((o) => o.text_en).join('; '),
          text_hi: matched.map((o) => o.text_hi).join('; '),
          red_flag: matched.some((o) => o.red_flag),
          red_flag_reason: matched.find((o) => o.red_flag)?.red_flag_reason,
        };
        onAnswerSelected(combinedOpt);
      }
      return;
    }

    const matched = question.options.find((o) => o.id === currentSelected);
    if (matched) {
      onAnswerSelected(matched);
    }
  };

  const isNextDisabled =
    (question.input_type === 'single_select' && !currentSelected) ||
    (question.input_type === 'multi_select' && selectedOptionIds.length === 0) ||
    (question.input_type === 'free_text' && !customFreeText.trim()) ||
    isSubmitting;

  return (
    <div
      id={`question-card-${question.id}`}
      className="w-full bg-white rounded-2xl p-5 sm:p-7 border-2 shadow-md space-y-5 animate-fadeIn"
      style={{ borderColor: theme.colors.borderDefault }}
    >
      {/* Top Banner: Voice prompt bar */}
      <VoicePrompter
        promptEn={question.audio_prompt_en || question.question_en}
        promptHi={question.audio_prompt_hi || question.question_hi}
        onVoiceInput={handleVoiceInput}
      />

      {voiceStatus && (
        <div className="text-xs p-2.5 rounded-lg bg-slate-100 text-slate-700 font-medium flex items-center gap-2">
          {isMatchingVoice && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />}
          <span>{voiceStatus}</span>
        </div>
      )}

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

          {question.input_type === 'multi_select' && (
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
              {language === 'hi' ? 'एक से अधिक चुनें' : 'Multi-Select'}
            </span>
          )}

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
      {question.input_type !== 'free_text' ? (
        <div
          className="grid gap-3.5 w-full pt-2"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
        >
          {question.options.map((opt, idx) => (
            <OptionChip
              key={opt.id}
              option={opt}
              index={idx}
              isMultiSelect={question.input_type === 'multi_select'}
              isSelected={
                question.input_type === 'multi_select'
                  ? selectedOptionIds.includes(opt.id)
                  : currentSelected === opt.id
              }
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
            className="w-full p-4 rounded-xl border-2 border-slate-300 focus:border-cyan-700 focus:ring-4 focus:ring-cyan-100 text-base sm:text-lg font-medium text-slate-900"
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
          disabled={isNextDisabled}
          onClick={handleConfirmNext}
          className={`w-full sm:w-auto px-8 py-4 rounded-xl font-extrabold text-lg flex items-center justify-center gap-3 shadow-lg transition-all active:scale-95 cursor-pointer min-h-[56px] ${
            isNextDisabled
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              : 'text-white'
          }`}
          style={{
            backgroundColor: !isNextDisabled ? theme.colors.primary : undefined,
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
