import React from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { QuestionOption } from '../types';
import { useApp } from '../context/AppContext';

interface OptionChipProps {
  option: QuestionOption;
  isSelected: boolean;
  onSelect: (option: QuestionOption) => void;
  index: number;
  isMultiSelect?: boolean;
}

export const OptionChip: React.FC<OptionChipProps> = ({
  option,
  isSelected,
  onSelect,
  isMultiSelect = false,
}) => {
  const { language } = useApp();

  return (
    <button
      id={`option-chip-${option.id}`}
      type="button"
      role={isMultiSelect ? 'checkbox' : 'radio'}
      aria-checked={isSelected}
      onClick={() => onSelect(option)}
      className={`w-full flex flex-col justify-between p-4 sm:p-5 bg-white border-2 shadow-2xs rounded-2xl text-left transition-all group cursor-pointer hover:shadow-md active:scale-[0.99] select-none min-h-[110px] ${
        isSelected
          ? 'border-[#102A43] bg-slate-50/90 shadow-xs ring-2 ring-[#102A43]/20'
          : option.red_flag
          ? 'border-red-200 bg-red-50/30 hover:border-red-400'
          : 'border-slate-200 hover:border-[#102A43]'
      }`}
    >
      <div className="w-full flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1">
          {/* Primary Language Text */}
          <span className="text-base sm:text-lg font-bold text-[#102A43] block leading-tight">
            {language === 'hi' ? option.text_hi : option.text_en}
          </span>

          {/* Secondary Language Sub-text */}
          <span className="text-xs sm:text-sm text-slate-500 font-medium block leading-snug">
            {language === 'hi' ? option.text_en : option.text_hi}
          </span>
        </div>

        {/* Critical Red Flag badge */}
        {option.red_flag && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-red-100 text-red-700 border border-red-300 shrink-0">
            <AlertTriangle className="w-3 h-3" />
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

      {/* Selector Indicator at bottom */}
      <div className="mt-3 flex items-center justify-between w-full">
        {isMultiSelect ? (
          /* Multi-Select Square Checkbox */
          <div
            className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg border-2 flex items-center justify-center transition-all ${
              isSelected
                ? 'bg-[#102A43] border-[#102A43] text-white shadow-2xs'
                : 'border-slate-300 bg-white group-hover:border-[#102A43]'
            }`}
          >
            {isSelected && <Check className="w-4 h-4 text-white stroke-[3]" />}
          </div>
        ) : (
          /* Single-Select Radio Circle Indicator */
          <div
            className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 flex items-center justify-center transition-all ${
              isSelected
                ? 'border-[#102A43] bg-white'
                : 'border-slate-300 bg-white group-hover:border-[#102A43]'
            }`}
          >
            <div
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                isSelected ? 'bg-[#102A43]' : 'bg-transparent'
              }`}
            />
          </div>
        )}

        {isMultiSelect && (
          <span className="text-[11px] font-bold text-slate-400">
            {isSelected
              ? language === 'hi'
                ? 'चयनित (Selected)'
                : 'Selected'
              : language === 'hi'
              ? 'चुनें (Tap to check)'
              : 'Tap to check'}
          </span>
        )}
      </div>
    </button>
  );
};
