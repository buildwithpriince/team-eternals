import React from 'react';
import { Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SectionKey } from '../types';

interface SectionProgressBarProps {
  currentSection: SectionKey;
  currentStepIndex: number;
  totalSteps: number;
  sectionComplete?: boolean;
}

const sectionDisplayMap: Record<SectionKey, { en: string; hi: string; stepNumber: number }> = {
  chief_complaint: { en: 'Chief Complaint', hi: 'मुख्य लक्षण / समस्या', stepNumber: 1 },
  hpi: { en: 'History of Present Illness', hi: 'वर्तमान बीमारी का विवरण', stepNumber: 2 },
  past_history: { en: 'Past Medical History', hi: 'पुरानी बीमारी व ऑपरेशन', stepNumber: 3 },
  drug_allergy: { en: 'Drug & Allergies', hi: 'दवाइयां एवं एलर्जी', stepNumber: 4 },
  personal_history: { en: 'Personal & Family', hi: 'व्यक्तिगत व पारिवारिक इतिहास', stepNumber: 5 },
  family_history: { en: 'Family History', hi: 'पारिवारिक इतिहास', stepNumber: 5 },
  ros: { en: 'Review of Systems', hi: 'अन्य लक्षण (सर्वांगीण समीक्षा)', stepNumber: 6 },
  ahara_vihara: { en: 'Ahara & Jatharagni', hi: 'आहार एवं जठराग्नि परीक्षा', stepNumber: 2 },
  dashavidha_pariksha: { en: 'Dashavidha Pariksha & Prakriti', hi: 'दशविध परीक्षा एवं प्रकृति', stepNumber: 3 },
};

export const SectionProgressBar: React.FC<SectionProgressBarProps> = ({
  currentSection,
  currentStepIndex,
  totalSteps,
}) => {
  const { language, theme } = useApp();
  const sectionMeta = sectionDisplayMap[currentSection] || {
    en: 'Clinical Interview',
    hi: 'नैदानिक पूछताछ',
    stepNumber: currentStepIndex + 1,
  };

  const currentStep = currentStepIndex + 1;
  const progressPercent = Math.min(100, Math.round((currentStep / totalSteps) * 100));

  return (
    <div
      id="section-progress-bar-container"
      className="w-full bg-white rounded-xl p-4 sm:p-5 border shadow-sm space-y-3"
      style={{ borderColor: theme.colors.borderDefault }}
    >
      {/* Top row: Section Name + Step Number */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-extrabold text-white"
            style={{ backgroundColor: theme.colors.primary }}
          >
            {currentStep}
          </span>
          <div>
            <h3
              className="text-base sm:text-lg font-bold leading-tight"
              style={{ color: theme.colors.textPrimary }}
            >
              {language === 'hi' ? sectionMeta.hi : sectionMeta.en}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {language === 'hi' ? sectionMeta.en : sectionMeta.hi}
            </p>
          </div>
        </div>

        {/* Badge: Step X of Y */}
        <div className="flex items-center gap-2">
          <span
            className="px-3 py-1 rounded-full text-xs sm:text-sm font-extrabold"
            style={{
              backgroundColor: theme.colors.primaryLight,
              color: theme.colors.primaryDark,
            }}
          >
            {language === 'hi'
              ? `चरण ${currentStep} / ${totalSteps}`
              : `Step ${currentStep} of ${totalSteps}`}
          </span>
          <span className="text-xs font-bold text-slate-600">
            {progressPercent}%
          </span>
        </div>
      </div>

      {/* Visual Progress Bar Track */}
      <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${progressPercent}%`,
            backgroundColor: theme.colors.primary,
          }}
        />
      </div>

      {/* Step dots */}
      <div className="flex items-center justify-between px-1">
        {Array.from({ length: totalSteps }).map((_, idx) => {
          const stepNum = idx + 1;
          const isDone = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;

          return (
            <div
              key={idx}
              className="flex flex-col items-center gap-1"
            >
              <div
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                  isDone
                    ? 'bg-emerald-600 text-white'
                    : isCurrent
                    ? 'border-2 text-white scale-110 shadow-sm'
                    : 'bg-slate-300 text-slate-600'
                }`}
                style={{
                  backgroundColor: isCurrent ? theme.colors.primary : isDone ? '#059669' : '#CBD5E1',
                  borderColor: isCurrent ? theme.colors.accent : 'transparent',
                }}
              >
                {isDone && <Check className="w-2.5 h-2.5 stroke-[3]" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
