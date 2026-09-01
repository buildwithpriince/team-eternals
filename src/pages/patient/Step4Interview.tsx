import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  RotateCcw,
  Volume2,
  Sparkles,
  AlertTriangle,
  Mic,
  MicOff,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { OptionChip } from '../../components/OptionChip';
import { generalClinicalQuestions, ayushClinicalQuestions } from '../../data/clinicalQuestions';
import { BackendQuestionContract, QuestionOption, Department } from '../../types';
import { speechService } from '../../utils/speech';
import { matchVoiceToOptions, matchSemanticsLocally } from '../../utils/aiMatcher';

export const Step4Interview: React.FC = () => {
  const {
    department,
    setDepartment,
    language,
    saveKioskAnswer,
    kioskPatient,
    setCurrentKioskStep,
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
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [customFreeText, setCustomFreeText] = useState<string>('');

  // Voice Speech-To-Text and AI Option Matching State
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [isMatchingVoice, setIsMatchingVoice] = useState<boolean>(false);
  const [voiceFeedback, setVoiceFeedback] = useState<{
    text: string;
    type: 'success' | 'info' | 'warning';
  } | null>(null);

  const recognitionRef = useRef<any>(null);
  const activeQuestionIdRef = useRef<string>(currentQuestion.id);

  // Keep activeQuestionIdRef in sync with current question
  useEffect(() => {
    activeQuestionIdRef.current = currentQuestion.id;
  }, [currentQuestion.id]);

  // Find previously saved answer for this question if any, and clean up previous question voice state
  useEffect(() => {
    // 1. Abort any running speech recognition from previous question immediately
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    }

    // 2. Clear all voice state instantly so previous question text/feedback never bleeds into the next question
    setVoiceTranscript('');
    setVoiceFeedback(null);
    setIsListening(false);
    setIsMatchingVoice(false);

    // 3. Populate existing answer if patient previously answered this question
    const prevAns = kioskPatient.historyAnswers?.[currentQuestion.id];
    if (prevAns) {
      if (currentQuestion.input_type === 'multi_select') {
        const prevTextEn = prevAns.answer_en || '';
        const prevTextHi = prevAns.answer_hi || '';
        const matched = currentQuestion.options.filter(
          (o) => prevTextEn.includes(o.text_en) || prevTextHi.includes(o.text_hi)
        );
        setSelectedOptionIds(matched.map((o) => o.id));
        setCurrentSelected(undefined);
        setCustomFreeText('');
      } else if (currentQuestion.input_type === 'single_select') {
        const match = currentQuestion.options.find(
          (o) => o.text_en === prevAns.answer_en || o.text_hi === prevAns.answer_hi
        );
        if (match) setCurrentSelected(match.id);
        setSelectedOptionIds([]);
        setCustomFreeText('');
      } else {
        setCustomFreeText(prevAns.answer_en || '');
        setCurrentSelected(undefined);
        setSelectedOptionIds([]);
      }
    } else {
      setCurrentSelected(undefined);
      setSelectedOptionIds([]);
      setCustomFreeText('');
    }

    if (autoVoiceEnabled) {
      const audioPrompt =
        language === 'hi'
          ? currentQuestion.audio_prompt_hi || currentQuestion.question_hi
          : currentQuestion.audio_prompt_en || currentQuestion.question_en;
      speakText(audioPrompt, language);
    }

    // Prefetch the upcoming question audio in background for instantaneous zero-delay response
    if (currentIndex + 1 < questions.length) {
      const nextQ = questions[currentIndex + 1];
      const nextPrompt =
        language === 'hi'
          ? nextQ.audio_prompt_hi || nextQ.question_hi
          : nextQ.audio_prompt_en || nextQ.question_en;
      speechService.prefetch(nextPrompt, language);
    }
  }, [currentQuestion.id, currentIndex, language, questions, autoVoiceEnabled]);

  // Option selection handler for both single and multi-select
  const handleSelectOption = (option: QuestionOption) => {
    if (currentQuestion.input_type === 'multi_select') {
      const isNoneOption =
        option.id.includes('none') ||
        option.id.includes('no') ||
        option.id === 'surg_no';

      if (isNoneOption) {
        setSelectedOptionIds((prev) =>
          prev.includes(option.id) ? [] : [option.id]
        );
      } else {
        setSelectedOptionIds((prev) => {
          const withoutNone = prev.filter(
            (id) => !id.includes('none') && !id.includes('no') && id !== 'surg_no'
          );
          if (withoutNone.includes(option.id)) {
            return withoutNone.filter((id) => id !== option.id);
          } else {
            return [...withoutNone, option.id];
          }
        });
      }
    } else {
      setCurrentSelected(option.id);
    }
  };

  // Handle Speech-to-Text and Gemini AI Option Matching Flow
  const handleToggleVoiceAnswer = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore
        }
      }
      setIsListening(false);
      return;
    }

    setVoiceFeedback(null);
    setVoiceTranscript('');

    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      try {
        const win = window as unknown as Record<string, any>;
        const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
        const recognition = new SpeechRec();
        recognitionRef.current = recognition;

        recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
        recognition.interimResults = false;
        recognition.continuous = false;

        recognition.onstart = () => {
          setIsListening(true);
          speechService.playChime('gentle');
        };

        recognition.onresult = async (event: any) => {
          const targetQuestionId = currentQuestion.id;
          const rawTranscript = event.results?.[0]?.[0]?.transcript || '';
          if (!rawTranscript.trim()) return;

          // Guard against question changes while speech recognition was processing
          if (activeQuestionIdRef.current !== targetQuestionId) {
            return;
          }

          setVoiceTranscript(rawTranscript);
          setIsListening(false);

          // Handle free-text questions
          if (currentQuestion.input_type === 'free_text') {
            if (activeQuestionIdRef.current !== targetQuestionId) return;
            setCustomFreeText(rawTranscript);
            setVoiceFeedback({
              text:
                language === 'hi'
                  ? `आपकी बात दर्ज हो गई: "${rawTranscript}"`
                  : `Transcribed: "${rawTranscript}"`,
              type: 'success',
            });
            speechService.playChime('success');
            return;
          }

          // Instant Semantic Local Match (0ms instant response for durations like "5 months", severity, symptoms, negations)
          const localSemanticResult = matchSemanticsLocally(rawTranscript, currentQuestion.options);
          let instantMatchedOption: QuestionOption | null = null;

          if (localSemanticResult.matchedIds && localSemanticResult.matchedIds.length > 0) {
            if (currentQuestion.input_type === 'multi_select') {
              const matchedOpts = currentQuestion.options.filter((opt) =>
                localSemanticResult.matchedIds.includes(opt.id)
              );
              if (matchedOpts.length > 0) {
                if (activeQuestionIdRef.current !== targetQuestionId) return;
                setSelectedOptionIds((prev) => {
                  const newIds = matchedOpts.map((o) => o.id);
                  const containsNone = newIds.some((id) => id.includes('none'));
                  if (containsNone) return newIds.filter((id) => id.includes('none'));
                  const withoutNone = prev.filter((id) => !id.includes('none'));
                  return Array.from(new Set([...withoutNone, ...newIds]));
                });
                const names = matchedOpts
                  .map((o) => (language === 'hi' ? o.text_hi : o.text_en))
                  .join(', ');
                setVoiceFeedback({
                  text: language === 'hi' ? `चयनित: ${names}` : `Voice Selected: ${names}`,
                  type: 'success',
                });
                speechService.playChime('success');
              }
            } else {
              instantMatchedOption =
                currentQuestion.options.find((opt) => opt.id === localSemanticResult.matchedIds[0]) ||
                null;
              if (instantMatchedOption) {
                if (activeQuestionIdRef.current !== targetQuestionId) return;
                handleSelectOption(instantMatchedOption);
                setVoiceFeedback({
                  text:
                    language === 'hi'
                      ? `चयनित: ${instantMatchedOption.text_hi}`
                      : `Voice Selected: ${instantMatchedOption.text_en}`,
                  type: 'success',
                });
                speechService.playChime('success');
              }
            }
          }

          if (!instantMatchedOption && currentQuestion.input_type !== 'multi_select') {
            if (activeQuestionIdRef.current !== targetQuestionId) return;
            setIsMatchingVoice(true);
            setVoiceFeedback({
              text:
                language === 'hi'
                  ? `Gemini AI सटीक उत्तर खोज रहा है... ("${rawTranscript}")`
                  : `Matching precise option via Gemini AI... ("${rawTranscript}")`,
              type: 'info',
            });
          } else if (currentQuestion.input_type === 'multi_select') {
            setIsMatchingVoice(true);
            setVoiceFeedback({
              text:
                language === 'hi'
                  ? `Gemini AI सटीक उत्तर खोज रहा है... ("${rawTranscript}")`
                  : `Matching precise option via Gemini AI... ("${rawTranscript}")`,
              type: 'info',
            });
          }

          // Rapid Gemini Flash (gemini-3.7-flash / gemini-3.6-flash for deep semantic inference)
          try {
            const matchResult = await matchVoiceToOptions(
              rawTranscript,
              {
                id: currentQuestion.id,
                question_en: currentQuestion.question_en,
                question_hi: currentQuestion.question_hi,
              },
              currentQuestion.options,
              language
            );

            // Guard: If the patient navigated away to another question during the async API call, discard the result
            if (activeQuestionIdRef.current !== targetQuestionId) {
              return;
            }

            setIsMatchingVoice(false);

            if (matchResult.matchedIds && matchResult.matchedIds.length > 0) {
              const matchedOptions = currentQuestion.options.filter((opt) =>
                matchResult.matchedIds.includes(opt.id)
              );

              if (matchedOptions.length > 0) {
                if (currentQuestion.input_type === 'multi_select') {
                  setSelectedOptionIds((prev) => {
                    const newIds = matchedOptions.map((o) => o.id);
                    const containsNone = newIds.some((id) => id.includes('none'));
                    if (containsNone) return newIds.filter((id) => id.includes('none'));
                    const withoutNone = prev.filter((id) => !id.includes('none'));
                    return Array.from(new Set([...withoutNone, ...newIds]));
                  });
                } else {
                  handleSelectOption(matchedOptions[0]);
                }

                const optionNames = matchedOptions
                  .map((opt) => (language === 'hi' ? opt.text_hi : opt.text_en))
                  .join(', ');

                setVoiceFeedback({
                  text:
                    language === 'hi'
                      ? `चयनित: ${optionNames}`
                      : `Voice Matched & Selected: ${optionNames}`,
                  type: 'success',
                });

                speechService.playChime('success');
              } else if (!instantMatchedOption) {
                setVoiceFeedback({
                  text:
                    language === 'hi'
                      ? `स्पष्ट उत्तर नहीं मिला। कृपया नीचे से विकल्प चुनें।`
                      : `No exact option matched. Please tap an option below.`,
                  type: 'warning',
                });
              }
            } else if (!instantMatchedOption) {
              setVoiceFeedback({
                text:
                  language === 'hi'
                    ? `कोई मिलान नहीं मिला ("none")। कृपया नीचे से विकल्प चुनें।`
                    : `No matching option found. Please tap an option below.`,
                type: 'warning',
              });
            }
          } catch (err) {
            if (activeQuestionIdRef.current === targetQuestionId) {
              setIsMatchingVoice(false);
            }
            console.error('Error during voice option matching:', err);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error event:', event);
          setIsListening(false);
          setIsMatchingVoice(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.start();
      } catch (err) {
        console.error('Speech recognition initiation error:', err);
        setIsListening(false);
      }
    } else {
      // Accessible simulation if browser does not support SpeechRecognition
      const targetQuestionId = currentQuestion.id;
      setIsListening(true);
      setTimeout(async () => {
        if (activeQuestionIdRef.current !== targetQuestionId) return;
        setIsListening(false);
        const sampleMatch = currentQuestion.options[0];
        if (sampleMatch) {
          const simulatedText =
            language === 'hi' ? sampleMatch.text_hi : sampleMatch.text_en;
          setVoiceTranscript(simulatedText);
          setIsMatchingVoice(true);

          const matchResult = await matchVoiceToOptions(
            simulatedText,
            currentQuestion,
            currentQuestion.options,
            language
          );
          if (activeQuestionIdRef.current !== targetQuestionId) return;
          setIsMatchingVoice(false);

          if (matchResult.matchedIds && matchResult.matchedIds.length > 0) {
            const found = currentQuestion.options.find(
              (o) => o.id === matchResult.matchedIds[0]
            );
            if (found) {
              handleSelectOption(found);
              setVoiceFeedback({
                text:
                  language === 'hi'
                    ? `चयनित: ${found.text_hi}`
                    : `Selected: ${found.text_en}`,
                type: 'success',
              });
              speechService.playChime('success');
            }
          }
        }
      }, 2000);
    }
  };

  const handleRepeatVoice = () => {
    const audioPrompt =
      language === 'hi'
        ? currentQuestion.audio_prompt_hi || currentQuestion.question_hi
        : currentQuestion.audio_prompt_en || currentQuestion.question_en;
    speakText(audioPrompt, language);
  };

  const handleConfirmNext = () => {
    // Abort running voice recognition and clear voice state when progressing
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    }
    setVoiceFeedback(null);
    setVoiceTranscript('');
    setIsListening(false);
    setIsMatchingVoice(false);

    let textEn = '';
    let textHi = '';
    let hasRedFlag = false;
    let redFlagReason: string | undefined = undefined;

    if (currentQuestion.input_type === 'free_text') {
      if (!customFreeText.trim()) return;
      textEn = customFreeText.trim();
      textHi = customFreeText.trim();
    } else if (currentQuestion.input_type === 'multi_select') {
      if (selectedOptionIds.length === 0) return;
      const chosenOptions = currentQuestion.options.filter((o) =>
        selectedOptionIds.includes(o.id)
      );
      if (chosenOptions.length === 0) return;
      textEn = chosenOptions.map((o) => o.text_en).join('; ');
      textHi = chosenOptions.map((o) => o.text_hi).join('; ');
      const rfOption = chosenOptions.find((o) => o.red_flag);
      if (rfOption) {
        hasRedFlag = true;
        redFlagReason = rfOption.red_flag_reason;
      }
    } else {
      const chosen = currentQuestion.options.find((o) => o.id === currentSelected);
      if (!chosen) return;
      textEn = chosen.text_en;
      textHi = chosen.text_hi;
      hasRedFlag = !!chosen.red_flag;
      redFlagReason = chosen.red_flag_reason;
    }

    saveKioskAnswer(
      currentQuestion.id,
      currentQuestion.question_en,
      currentQuestion.question_hi,
      currentQuestion.section,
      textEn,
      textHi,
      hasRedFlag,
      redFlagReason
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
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    }
    setVoiceFeedback(null);
    setVoiceTranscript('');
    setIsListening(false);
    setIsMatchingVoice(false);

    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else {
      setCurrentKioskStep(3);
    }
  };

  const hasActiveRedFlag =
    (currentQuestion.input_type === 'multi_select'
      ? currentQuestion.options.some((o) => selectedOptionIds.includes(o.id) && o.red_flag)
      : currentQuestion.options.find((o) => o.id === currentSelected)?.red_flag) ||
    (kioskPatient.redFlags && kioskPatient.redFlags.length > 0);

  const activeRedFlagReason =
    (currentQuestion.input_type === 'multi_select'
      ? currentQuestion.options.find((o) => selectedOptionIds.includes(o.id) && o.red_flag)?.red_flag_reason
      : currentQuestion.options.find((o) => o.id === currentSelected)?.red_flag_reason) ||
    kioskPatient.redFlags?.[0] ||
    'Patient reports urgent acute discomfort requiring fast-track triage.';

  const isNextDisabled =
    (currentQuestion.input_type === 'single_select' && !currentSelected) ||
    (currentQuestion.input_type === 'multi_select' && selectedOptionIds.length === 0) ||
    (currentQuestion.input_type === 'free_text' && !customFreeText.trim());

  return (
    <div
      id="step-4-interview-container"
      className="w-full max-w-7xl mx-auto flex flex-col space-y-5 animate-fadeIn text-left"
    >
      {/* Relative Width Layout for Laptop / Desktop screens (69-70% main, 28-30% sidebar) */}
      <div className="w-full flex flex-col lg:flex-row items-start gap-5 xl:gap-6">
        {/* Main Left Section (Relative ~69-70% Width) */}
        <section className="w-full lg:w-[69%] xl:w-[70%] flex flex-col space-y-4 sm:space-y-5 min-w-0">
          {/* Section Indicator & Dual Headings */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-[#102A43]/70">
                Section: {currentQuestion.section.replace(/_/g, ' ')} |{' '}
                {language === 'hi' ? 'नैदानिक पूछताछ' : 'Clinical Interview'}
              </span>
              <div className="flex items-center gap-2">
                {currentQuestion.input_type === 'multi_select' && (
                  <span className="text-[11px] font-extrabold px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-md border border-blue-200">
                    {language === 'hi' ? 'एक से अधिक चुनें' : 'Multi-Select'}
                  </span>
                )}
                <span className="text-xs font-extrabold px-2.5 py-1 bg-slate-200 text-slate-700 rounded-md">
                  {currentIndex + 1} / {questions.length}
                </span>
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-3.5xl font-extrabold leading-tight text-[#102A43]">
              {language === 'hi' ? currentQuestion.question_hi : currentQuestion.question_en}
            </h2>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-600 leading-snug">
              {language === 'hi' ? currentQuestion.question_en : currentQuestion.question_hi}
            </h3>
          </div>

          {/* Voice Input "Speak Answer" Action Bar */}
          <div
            id="voice-speak-answer-bar"
            className="w-full p-4 rounded-2xl bg-[#F8FAFC] border-2 border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 transition-all"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-200'
                    : isMatchingVoice
                    ? 'bg-amber-500 text-white animate-spin'
                    : 'bg-[#102A43] text-white'
                }`}
              >
                {isMatchingVoice ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isListening ? (
                  <Mic className="w-5 h-5 animate-bounce" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </div>

              <div className="text-left">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {language === 'hi' ? 'आवाज से उत्तर दें' : 'Speak Answer Flow'}
                </p>
                <p className="text-sm sm:text-base font-bold text-[#102A43]">
                  {isListening
                    ? language === 'hi'
                      ? 'सुन रही हूँ... कृपया बोलें'
                      : 'Listening... Please speak your answer'
                    : isMatchingVoice
                    ? language === 'hi'
                      ? 'Gemini AI मिलान कर रहा है...'
                      : 'Gemini AI matching option...'
                    : language === 'hi'
                    ? 'बोलकर उत्तर चुनें (Gemini AI संचालित)'
                    : 'Speak your answer naturally (Gemini AI matched)'}
                </p>
              </div>
            </div>

            {/* Speak Mic Action Button */}
            <button
              id="btn-trigger-speak-answer"
              type="button"
              onClick={handleToggleVoiceAnswer}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer transition-all border-2 shadow-xs shrink-0 ${
                isListening
                  ? 'bg-red-500 hover:bg-red-600 text-white border-red-600 animate-pulse'
                  : 'bg-white hover:bg-slate-50 text-[#102A43] border-slate-300 hover:border-[#102A43]'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-5 h-5" />
                  <span>{language === 'hi' ? 'सुनना बंद करें' : 'Stop Listening'}</span>
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5 text-red-500" />
                  <span>{language === 'hi' ? 'बोलकर बताएं' : 'Speak Answer'}</span>
                </>
              )}
            </button>
          </div>

          {/* Voice Live Transcript & Feedback Pill */}
          {(voiceTranscript || voiceFeedback) && (
            <div
              id="voice-transcript-feedback-box"
              className={`p-3.5 rounded-xl border flex items-start gap-3 text-sm font-medium transition-all ${
                voiceFeedback?.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : voiceFeedback?.type === 'warning'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}
            >
              {voiceFeedback?.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : voiceFeedback?.type === 'warning' ? (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                {voiceTranscript && (
                  <p className="text-xs text-slate-600">
                    <span className="font-bold">{language === 'hi' ? 'सुना गया:' : 'Heard:'}</span>{' '}
                    "{voiceTranscript}"
                  </p>
                )}
                {voiceFeedback && (
                  <p className="font-bold text-sm leading-tight">{voiceFeedback.text}</p>
                )}
              </div>
            </div>
          )}

          {/* Options Grid: repeat(auto-fit, minmax(220px, 1fr)) */}
          {currentQuestion.input_type !== 'free_text' ? (
            <div
              className="grid gap-3.5 sm:gap-4 w-full"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
            >
              {currentQuestion.options.map((opt, idx) => (
                <OptionChip
                  key={opt.id}
                  option={opt}
                  index={idx}
                  isMultiSelect={currentQuestion.input_type === 'multi_select'}
                  isSelected={
                    currentQuestion.input_type === 'multi_select'
                      ? selectedOptionIds.includes(opt.id)
                      : currentSelected === opt.id
                  }
                  onSelect={handleSelectOption}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3 bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs">
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
                className="w-full p-4 rounded-xl border-2 border-slate-300 focus:border-[#102A43] focus:ring-4 focus:ring-slate-100 text-base sm:text-lg font-medium text-slate-900"
              />
            </div>
          )}

          {/* Clinical Rationale Hint */}
          {currentQuestion.clinical_rationale && (
            <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-start gap-2.5 text-xs text-slate-600 shadow-2xs">
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

        {/* Aside / Doctor's Real-Time Summary Sidebar (Relative ~28-30% Width) */}
        <aside className="w-full lg:w-[31%] xl:w-[30%] bg-white border border-slate-200 rounded-2xl p-5 xl:p-6 flex flex-col space-y-4 xl:space-y-5 shadow-2xs shrink-0 lg:sticky lg:top-4">
          {/* Doctor Real-time View Header */}
          <div className="pb-3 border-b border-slate-100 space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Doctor's Real-time View / चिकित्सक पूर्वावलोकन
            </h3>

            {/* Critical Red Flag Box if present */}
            {hasActiveRedFlag ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 space-y-1">
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
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 flex items-center gap-2 text-xs font-bold text-emerald-800">
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
          <div className="p-3.5 bg-[#F2F5F7] rounded-2xl border border-slate-200 space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Department Mode / विभाग
            </p>
            <div className="flex p-1 bg-white rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setDepartment('general')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
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
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
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
      <footer className="w-full bg-white border border-slate-200 rounded-2xl px-6 sm:px-10 py-3.5 sm:py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        {/* Left: Back & Repeat Voice Actions */}
        <div className="flex items-center space-x-6 sm:space-x-8">
          <button
            type="button"
            onClick={handlePreviousQuestion}
            className="flex items-center space-x-3 group cursor-pointer text-left"
          >
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition-colors">
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-[#102A43]" />
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
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition-colors">
              <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 text-[#102A43]" />
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
            disabled={isNextDisabled}
            onClick={handleConfirmNext}
            className={`px-8 sm:px-10 py-3.5 sm:py-4 rounded-2xl font-black text-base sm:text-lg shadow-xl shadow-yellow-100/50 border-b-4 border-yellow-600 active:border-b-0 active:translate-y-1 transition-all cursor-pointer flex items-center gap-2 ${
              isNextDisabled
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

export default Step4Interview;
