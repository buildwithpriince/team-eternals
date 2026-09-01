import React from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { QuestionOption } from '../types';
import { useApp } from '../context/AppContext';

interface OptionChipProps {
  option: QuestionOption;
  isSelected: boolean;
  onSelect: (option: QuestionOption) => void;
  index: number;
}

export const OptionChip: React.FC<OptionChipProps> = ({
  option,
  isSelected,
  onSelect,
}) => {
  const { language, theme } = useApp();

  return (
    <button
      id={`option-chip-${option.id}`}
      type="button"
      onClick={() => onSelect(option)}
      className={`w-full flex flex-col items-start p-6 bg-white border-2 shadow-xs rounded-2xl text-left transition-all group cursor-pointer hover:shadow-md active:scale-[0.99] ${
        isSelected
          ? 'border-[#102A43] bg-slate-50/70 shadow-md ring-2 ring-[#102A43]/20'
          : option.red_flag
          ? 'border-red-200 bg-red-50/30 hover:border-red-400'
          : 'border-slate-200 hover:border-[#102A43]'
      }`}
      aria-pressed={isSelected}
    >
      <div className="w-full flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1">
          {/* Primary Language Text (English / Hindi depending on primary) */}
          <span className="text-xl sm:text-2xl font-bold text-[#102A43] block leading-tight">
            {language === 'hi' ? option.text_hi : option.text_en}
          </span>

          {/* Secondary Language Sub-text */}
          <span className="text-lg sm:text-xl text-slate-500 font-medium block leading-snug">
            {language === 'hi' ? option.text_en : option.text_hi}
          </span>
        </div>

        {/* Critical Red Flag badge */}
        {option.red_flag && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-red-100 text-red-700 border border-red-300 shrink-0">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{language === 'hi' ? 'गंभीर' : 'Alert'}</span>
          </span>
        )}
      </div>

      {option.red_flag_reason && isSelected && (
        <p className="text-xs text-red-700 font-bold bg-red-50 p-2 rounded-lg mt-2 border border-red-200 w-full">
          {language === 'hi'
            ? `क्लिनिकल अलर्ट: ${option.red_flag_reason}`
            : `Clinical Alert: ${option.red_flag_reason}`}
        </p>
      )}

      {/* Polish Radio Circle Selector Indicator at bottom */}
      <div className="mt-4 w-8 h-8 rounded-full border-2 border-slate-300 flex items-center justify-center group-hover:bg-[#102A43] group-hover:border-[#102A43] transition-colors">
        <div
          className={`w-2.5 h-2.5 rounded-full transition-colors ${
            isSelected
              ? 'bg-[#102A43] group-hover:bg-white'
              : 'bg-transparent group-hover:bg-white'
          }`}
        />
      </div>
    </button>
  );
};
