import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Mic,
  MicOff,
  Loader2,
  CheckCircle2,
  Activity,
  HeartPulse,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { OptionChip } from '../../components/OptionChip';
import { BackendQuestionContract, QuestionOption, SectionKey } from '../../types';
import { speechService } from '../../utils/speech';
import { matchVoiceToOptions, matchSemanticsLocally } from '../../utils/aiMatcher';
import {
  fetchNextInterviewTurn,
  StructuredAccumulatorState,
  StructuredTurnRecord,
} from '../../utils/interviewService';
import { evaluateRedFlagRules } from '../../utils/redFlagRules';

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

  // Dynamic Turn-by-Turn Interview State (Gemini-Powered History Engine)
  const [currentTurnNumber, setCurrentTurnNumber] = useState<number>(1);
  const [isLoadingTurn, setIsLoadingTurn] = useState<boolean>(false);
  const [turnHistory, setTurnHistory] = useState<
    Array<{
      question: BackendQuestionContract;
      answerEn: string;
      answerHi: string;
      selectedIds: string[];
      symptomTags: string[];
      isRedFlag: boolean;
      redFlagReason?: string;
    }>
  >([]);

  // Running Structured Accumulator State passed into Gemini on every turn
  const [structuredState, setStructuredState] = useState<StructuredAccumulatorState>(() => {
    return {
      chief_complaint: kioskPatient.chiefComplaints?.[0],
      turns: [],
      all_symptom_tags: [],
      completed_sections: [],
      current_section: 'chief_complaint',
      patient_demographics: {
        name: kioskPatient.name,
        age: kioskPatient.age,
        gender: kioskPatient.gender,
      },
    };
  });

  // Current active question dynamically elicited from Gemini
  const [currentQuestion, setCurrentQuestion] = useState<BackendQuestionContract>({
    id: 'turn_1_chief_complaint',
    question_en: 'What is the main reason for your hospital visit today?',
    question_hi: 'आज अस्पताल आने का आपका मुख्य कारण क्या है?',
    input_type: 'single_select',
    options: [
      { id: 'fever', text_en: 'Fever & Body Shivers', text_hi: 'बुखार एवं शरीर में कंपकंपी' },
      {
        id: 'chest_pain',
        text_en: 'Chest Pain or Heavy Pressure',
        text_hi: 'सीने में दर्द या भारीपन',
        red_flag: true,
        red_flag_reason: 'Suspected Acute Coronary Syndrome / Angina (Immediate ECG & Cardiac Triage)',
      },
      { id: 'cough_breath', text_en: 'Cough or Difficulty Breathing', text_hi: 'खांसी या सांस लेने में तकलीफ' },
      { id: 'stomach_pain', text_en: 'Stomach Ache, Gas or Vomiting', text_hi: 'पेट दर्द, गैस या उल्टी' },
      { id: 'joint_pain', text_en: 'Joint Pain, Backache or Body Weakness', text_hi: 'जोड़ों का दर्द, कमर दर्द या कमजोरी' },
      { id: 'other', text_en: 'Other symptom / Let me speak', text_hi: 'अन्य तकलीफ / बोलकर बताएं' },
    ],
    section: 'chief_complaint',
    symptom_tags: ['primary_concern'],
    section_complete: false,
    interview_complete: false,
    audio_prompt_en: 'Please select what troubles you the most today.',
    audio_prompt_hi: 'कृपया बताएं कि आज आपको सबसे ज्यादा क्या तकलीफ है?',
  });

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

  // Sync active question ref
  useEffect(() => {
    activeQuestionIdRef.current = currentQuestion.id;
  }, [currentQuestion.id]);

  // Initial load of turn 1 from backend Gemini engine if starting fresh
  const initialLoadRef = useRef(false);
  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      setIsLoadingTurn(true);
      const departmentTitle =
        department === 'ayush'
          ? 'AYUSH & Integrative Medicine OPD'
          : 'General Internal Medicine OPD';

      fetchNextInterviewTurn({
        mode: department,
        language,
        department: departmentTitle,
        structuredState,
      })
        .then((nextTurn) => {
          const loadedQ: BackendQuestionContract = {
            id: `turn_1_${nextTurn.section}`,
            question_en: nextTurn.question_en,
            question_hi: nextTurn.question_hi,
            input_type: nextTurn.input_type,
            options: nextTurn.options,
            section: nextTurn.section,
            symptom_tags: nextTurn.symptom_tags,
            section_complete: nextTurn.section_complete,
            interview_complete: nextTurn.interview_complete,
            audio_prompt_en: nextTurn.audio_prompt_en || nextTurn.question_en,
            audio_prompt_hi: nextTurn.audio_prompt_hi || nextTurn.question_hi,
          };
          setCurrentQuestion(loadedQ);
          if (autoVoiceEnabled) {
            const prompt = language === 'hi' ? loadedQ.audio_prompt_hi! : loadedQ.audio_prompt_en!;
            speakText(prompt, language);
          }
        })
        .catch((err) => {
          console.warn('Initial turn fetch error:', err);
        })
        .finally(() => {
          setIsLoadingTurn(false);
        });
    }
  }, [department, language, autoVoiceEnabled, speakText, structuredState]);

  // Clean voice state when question changes and auto-speak prompt
  useEffect(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    }
    setVoiceTranscript('');
    setVoiceFeedback(null);
    setIsListening(false);
    setIsMatchingVoice(false);

    if (autoVoiceEnabled && currentQuestion.question_en) {
      const audioPrompt =
        language === 'hi'
          ? currentQuestion.audio_prompt_hi || currentQuestion.question_hi
          : currentQuestion.audio_prompt_en || currentQuestion.question_en;
      speakText(audioPrompt, language);
    }
  }, [currentQuestion.id, language, autoVoiceEnabled, speakText]);

  // Option selection handler
  const handleSelectOption = useCallback(
    (option: QuestionOption) => {
      if (currentQuestion.input_type === 'multi_select') {
        const isNoneOption =
          option.id.includes('none') ||
          option.id.includes('no') ||
          option.id === 'surg_no';

        if (isNoneOption) {
          setSelectedOptionIds((prev) => (prev.includes(option.id) ? [] : [option.id]));
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
    },
    [currentQuestion.input_type]
  );

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

    if (
      typeof window !== 'undefined' &&
      ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
    ) {
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

          if (activeQuestionIdRef.current !== targetQuestionId) return;

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

          // Instant Local Match
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

          if (!instantMatchedOption) {
            if (activeQuestionIdRef.current !== targetQuestionId) return;
            setIsMatchingVoice(true);
            setVoiceFeedback({
              text:
                language === 'hi'
                  ? `Gemini AI सटीक उत्तर खोज रहा है... ("${rawTranscript}")`
                  : `Matching precise option via Gemini AI... ("${rawTranscript}")`,
              type: 'info',
            });
          }

          // Rapid Gemini Matcher
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

            if (activeQuestionIdRef.current !== targetQuestionId) return;
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
      // Fallback simulation if SpeechRecognition unsupported
      const targetQuestionId = currentQuestion.id;
      setIsListening(true);
      setTimeout(async () => {
        if (activeQuestionIdRef.current !== targetQuestionId) return;
        setIsListening(false);
        const sampleMatch = currentQuestion.options[0];
        if (sampleMatch) {
          const simulatedText = language === 'hi' ? sampleMatch.text_hi : sampleMatch.text_en;
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
            const found = currentQuestion.options.find((o) => o.id === matchResult.matchedIds[0]);
            if (found) {
              handleSelectOption(found);
              setVoiceFeedback({
                text: language === 'hi' ? `चयनित: ${found.text_hi}` : `Selected: ${found.text_en}`,
                type: 'success',
              });
              speechService.playChime('success');
            }
          }
        }
      }, 1500);
    }
  };

  const handleRepeatVoice = () => {
    const audioPrompt =
      language === 'hi'
        ? currentQuestion.audio_prompt_hi || currentQuestion.question_hi
        : currentQuestion.audio_prompt_en || currentQuestion.question_en;
    speakText(audioPrompt, language);
  };

  // Submit current answer and advance to next Gemini conversational turn
  const handleConfirmNext = async () => {
    if (isLoadingTurn) return;

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
    let isOptionRedFlag = false;
    let optionRedFlagReason: string | undefined = undefined;

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
        isOptionRedFlag = true;
        optionRedFlagReason = rfOption.red_flag_reason;
      }
    } else {
      const chosen = currentQuestion.options.find((o) => o.id === currentSelected);
      if (!chosen) return;
      textEn = chosen.text_en;
      textHi = chosen.text_hi;
      isOptionRedFlag = !!chosen.red_flag;
      optionRedFlagReason = chosen.red_flag_reason;
    }

    // Run deterministic red-flag evaluation engine on returned symptom_tags + patient answer
    const redFlagResult = evaluateRedFlagRules(
      currentQuestion.symptom_tags,
      `${textEn} ${textHi}`,
      isOptionRedFlag,
      optionRedFlagReason
    );

    const hasRedFlag = redFlagResult.isRedFlag;
    const activeReason = redFlagResult.redFlagReasons[0] || optionRedFlagReason;

    // Save answer into global context for real-time physician viewing
    saveKioskAnswer(
      currentQuestion.id,
      currentQuestion.question_en,
      currentQuestion.question_hi,
      currentQuestion.section,
      textEn,
      textHi,
      hasRedFlag,
      activeReason
    );

    // Record turn in structured history
    const newTurnRecord: StructuredTurnRecord = {
      turn_number: currentTurnNumber,
      section: currentQuestion.section,
      question_en: currentQuestion.question_en,
      question_hi: currentQuestion.question_hi,
      answer_en: textEn,
      answer_hi: textHi,
      symptom_tags: currentQuestion.symptom_tags,
      is_red_flag: hasRedFlag,
    };

    const updatedTurnHistory = [
      ...turnHistory,
      {
        question: currentQuestion,
        answerEn: textEn,
        answerHi: textHi,
        selectedIds:
          currentQuestion.input_type === 'multi_select'
            ? selectedOptionIds
            : currentSelected
            ? [currentSelected]
            : [],
        symptomTags: currentQuestion.symptom_tags,
        isRedFlag: hasRedFlag,
        redFlagReason: activeReason,
      },
    ];
    setTurnHistory(updatedTurnHistory);

    // Update structured accumulator state
    const allTags = Array.from(
      new Set([...structuredState.all_symptom_tags, ...currentQuestion.symptom_tags])
    );
    const completedSecs = currentQuestion.section_complete
      ? Array.from(new Set([...structuredState.completed_sections, currentQuestion.section]))
      : structuredState.completed_sections;

    const updatedState: StructuredAccumulatorState = {
      ...structuredState,
      chief_complaint:
        currentQuestion.section === 'chief_complaint' && !structuredState.chief_complaint
          ? textEn
          : structuredState.chief_complaint,
      turns: [...structuredState.turns, newTurnRecord],
      all_symptom_tags: allTags,
      completed_sections: completedSecs,
      current_section: currentQuestion.section,
    };
    setStructuredState(updatedState);

    // Check if interview is marked complete by Gemini engine or reached terminal depth
    if (currentQuestion.interview_complete || currentTurnNumber >= 9) {
      setCurrentKioskStep(5);
      return;
    }

    // Call live Conversational History Engine for the next adaptive turn
    setIsLoadingTurn(true);
    try {
      const departmentTitle =
        department === 'ayush'
          ? 'AYUSH & Integrative Medicine OPD'
          : 'General Internal Medicine OPD';

      const nextTurnData = await fetchNextInterviewTurn({
        mode: department,
        language,
        department: departmentTitle,
        structuredState: updatedState,
      });

      if (nextTurnData.interview_complete) {
        setCurrentKioskStep(5);
        return;
      }

      const nextTurnNumber = currentTurnNumber + 1;
      const nextQ: BackendQuestionContract = {
        id: `turn_${nextTurnNumber}_${nextTurnData.section}`,
        question_en: nextTurnData.question_en,
        question_hi: nextTurnData.question_hi,
        input_type: nextTurnData.input_type,
        options: nextTurnData.options,
        section: nextTurnData.section,
        symptom_tags: nextTurnData.symptom_tags,
        section_complete: nextTurnData.section_complete,
        interview_complete: nextTurnData.interview_complete,
        audio_prompt_en: nextTurnData.audio_prompt_en || nextTurnData.question_en,
        audio_prompt_hi: nextTurnData.audio_prompt_hi || nextTurnData.question_hi,
      };

      setCurrentTurnNumber(nextTurnNumber);
      setCurrentQuestion(nextQ);
      setCurrentSelected(undefined);
      setSelectedOptionIds([]);
      setCustomFreeText('');
    } catch (err) {
      console.error('Failed to load next interview turn:', err);
    } finally {
      setIsLoadingTurn(false);
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

    if (turnHistory.length > 0) {
      const prevTurn = turnHistory[turnHistory.length - 1];
      const newHistory = turnHistory.slice(0, -1);
      setTurnHistory(newHistory);
      setCurrentTurnNumber((prev) => Math.max(1, prev - 1));
      setCurrentQuestion(prevTurn.question);

      if (prevTurn.question.input_type === 'multi_select') {
        setSelectedOptionIds(prevTurn.selectedIds);
        setCurrentSelected(undefined);
        setCustomFreeText('');
      } else if (prevTurn.question.input_type === 'single_select') {
        setCurrentSelected(prevTurn.selectedIds[0]);
        setSelectedOptionIds([]);
        setCustomFreeText('');
      } else {
        setCustomFreeText(prevTurn.answerEn);
        setCurrentSelected(undefined);
        setSelectedOptionIds([]);
      }

      // Roll back structured state
      setStructuredState((prev) => ({
        ...prev,
        turns: prev.turns.slice(0, -1),
      }));
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
      ? currentQuestion.options.find((o) => selectedOptionIds.includes(o.id) && o.red_flag)
          ?.red_flag_reason
      : currentQuestion.options.find((o) => o.id === currentSelected)?.red_flag_reason) ||
    kioskPatient.redFlags?.[0] ||
    'Patient reports urgent acute discomfort requiring fast-track triage.';

  const isNextDisabled =
    isLoadingTurn ||
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
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#102A43]/10 text-[#102A43] text-xs font-black uppercase tracking-wider rounded-lg border border-[#102A43]/15">
                  <Activity className="w-3.5 h-3.5 text-[#102A43]" />
                  Section: {currentQuestion.section.replace(/_/g, ' ')}
                </span>
                <span className="text-xs font-semibold text-slate-500 hidden sm:inline">
                  {language === 'hi' ? 'लाइव नैदानिक पूछताछ' : 'Live Clinical Intake'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {currentQuestion.input_type === 'multi_select' && (
                  <span className="text-[11px] font-extrabold px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-md border border-blue-200">
                    {language === 'hi' ? 'एक से अधिक चुनें' : 'Multi-Select'}
                  </span>
                )}
                <span className="text-xs font-extrabold px-3 py-1 bg-slate-200 text-slate-700 rounded-md">
                  Turn {currentTurnNumber}
                </span>
              </div>
            </div>

            {/* Dynamic Question Title */}
            {isLoadingTurn ? (
              <div className="py-8 flex items-center justify-center gap-3 bg-white/80 rounded-2xl border border-slate-200 shadow-2xs">
                <Loader2 className="w-6 h-6 text-[#102A43] animate-spin" />
                <p className="text-base font-bold text-slate-700">
                  {language === 'hi'
                    ? 'Gemini AI अगला क्लिनिकल प्रश्न तैयार कर रहा है...'
                    : 'Gemini AI formulating next clinical question...'}
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-2xl sm:text-3xl lg:text-3.5xl font-extrabold leading-tight text-[#102A43]">
                  {language === 'hi' ? currentQuestion.question_hi : currentQuestion.question_en}
                </h2>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-600 leading-snug">
                  {language === 'hi' ? currentQuestion.question_en : currentQuestion.question_hi}
                </h3>
              </>
            )}
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
          {!isLoadingTurn && currentQuestion.input_type !== 'free_text' ? (
            <div
              className="grid gap-3.5 sm:gap-4 w-full"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
            >
              {currentQuestion.options.map((opt, idx) => (
                <OptionChip
                  key={opt.id || `opt_${idx}`}
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
          ) : !isLoadingTurn ? (
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
          ) : null}
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
                    Primary Chief Concern
                  </p>
                  <p className="text-sm font-bold text-slate-900 leading-tight">
                    {structuredState.chief_complaint ||
                      kioskPatient.chiefComplaints?.[0] ||
                      'Clinical Intake in progress...'}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-1.5 h-10 bg-[#102A43] rounded-full mt-1 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Active Section</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {currentQuestion.section.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>

              {/* Symptom Tags Accumulated from Gemini turns */}
              <div className="flex items-start space-x-3 pt-1">
                <div className="w-1.5 h-10 bg-slate-300 rounded-full mt-1 shrink-0" />
                <div className="w-full">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Extracted Symptom Tags ({structuredState.all_symptom_tags.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1 max-h-24 overflow-y-auto">
                    {structuredState.all_symptom_tags.length > 0 ? (
                      structuredState.all_symptom_tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-700"
                        >
                          #{tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">No tags extracted yet</span>
                    )}
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

      {/* Footer Navigation Bar */}
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
            <div
              className={`w-1 bg-blue-400 rounded-full transition-all duration-200 ${
                isSpeaking ? 'h-5 animate-pulse' : 'h-3'
              }`}
            />
            <div
              className={`w-1 bg-blue-500 rounded-full transition-all duration-200 ${
                isSpeaking ? 'h-8 animate-pulse' : 'h-6'
              }`}
            />
            <div
              className={`w-1 bg-blue-400 rounded-full transition-all duration-200 ${
                isSpeaking ? 'h-6 animate-pulse' : 'h-4'
              }`}
            />
            <div
              className={`w-1 bg-blue-600 rounded-full transition-all duration-200 ${
                isSpeaking ? 'h-10 animate-pulse' : 'h-7'
              }`}
            />
            <div
              className={`w-1 bg-blue-400 rounded-full transition-all duration-200 ${
                isSpeaking ? 'h-5 animate-pulse' : 'h-3'
              }`}
            />
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
            {isLoadingTurn ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{language === 'hi' ? 'लोड हो रहा है...' : 'PROCESSING...'}</span>
              </>
            ) : (
              <span>
                {currentQuestion.interview_complete || currentTurnNumber >= 8
                  ? language === 'hi'
                    ? 'पूर्ण करें | FINISH'
                    : 'FINISH | पूर्ण करें'
                  : language === 'hi'
                  ? 'NEXT | अगला'
                  : 'NEXT | अगला'}
              </span>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Step4Interview;
