import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface EmergencyButtonProps {
  id?: string;
}

export const EmergencyButton: React.FC<EmergencyButtonProps> = ({ id = 'btn-emergency-help' }) => {
  const { language, triggerEmergencyHelp } = useApp();

  return (
    <button
      id={id}
      type="button"
      onClick={() => triggerEmergencyHelp('general')}
      className="bg-[#D64545] text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm shadow-lg shadow-red-200 hover:bg-[#C23B3B] flex items-center space-x-2 uppercase tracking-wide cursor-pointer transition-all active:scale-95 focus:outline-none focus:ring-4 focus:ring-red-200"
      aria-label={language === 'hi' ? 'आपातकालीन सहायता (Emergency Help)' : 'Emergency Help'}
    >
      <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 animate-pulse text-white" />
      <span className="font-extrabold tracking-wide whitespace-nowrap">
        {language === 'hi' ? 'आपातकालीन | Emergency' : 'Emergency | आपातकालीन'}
      </span>
    </button>
  );
};
