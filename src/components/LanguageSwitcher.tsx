import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AppLanguage } from '../types';

interface LanguageSwitcherProps {
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  size = 'sm',
  showIcon = true,
  className = '',
}) => {
  const { language, setLanguage } = useApp();

  const handleSelectLanguage = (lang: AppLanguage) => {
    if (lang !== language) {
      setLanguage(lang);
    }
  };

  const isSmall = size === 'sm';

  return (
    <div
      id="language-switcher-container"
      role="group"
      aria-label="Language Switcher"
      className={`relative inline-flex items-center bg-slate-100/90 hover:bg-slate-100 p-1 rounded-lg border border-slate-200/90 shadow-2xs backdrop-blur-xs select-none transition-all ${className}`}
    >
      {showIcon && (
        <div className="pl-1.5 pr-1 text-slate-400 flex items-center justify-center pointer-events-none">
          <Globe className={isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        </div>
      )}

      {/* Hindi Button */}
      <button
        id="btn-lang-hi"
        type="button"
        role="radio"
        aria-checked={language === 'hi'}
        onClick={() => handleSelectLanguage('hi')}
        className={`relative z-10 rounded-md font-bold transition-colors duration-200 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
          isSmall ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
        } ${
          language === 'hi'
            ? 'text-[#102A43] font-black'
            : 'text-slate-600 hover:text-slate-900 font-medium'
        }`}
      >
        {/* Animated Background Pill */}
        {language === 'hi' && (
          <motion.div
            layoutId="active-language-pill"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              type: 'spring',
              stiffness: 450,
              damping: 32,
              mass: 0.8,
            }}
            className="absolute inset-0 bg-white rounded-md shadow-xs border border-slate-200/70"
            style={{ zIndex: -1 }}
          />
        )}

        {/* Text with subtle fade-in / fade-out effect on state transition */}
        <AnimatePresence mode="wait">
          <motion.span
            key={`hi-${language === 'hi' ? 'active' : 'inactive'}`}
            initial={{ opacity: 0.7, y: language === 'hi' ? 1 : 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0.7, y: language === 'hi' ? 0 : 1 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="relative z-10 block tracking-tight"
          >
            हिंदी
          </motion.span>
        </AnimatePresence>
      </button>

      {/* English Button */}
      <button
        id="btn-lang-en"
        type="button"
        role="radio"
        aria-checked={language === 'en'}
        onClick={() => handleSelectLanguage('en')}
        className={`relative z-10 rounded-md font-bold transition-colors duration-200 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
          isSmall ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
        } ${
          language === 'en'
            ? 'text-[#102A43] font-black'
            : 'text-slate-600 hover:text-slate-900 font-medium'
        }`}
      >
        {/* Animated Background Pill */}
        {language === 'en' && (
          <motion.div
            layoutId="active-language-pill"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              type: 'spring',
              stiffness: 450,
              damping: 32,
              mass: 0.8,
            }}
            className="absolute inset-0 bg-white rounded-md shadow-xs border border-slate-200/70"
            style={{ zIndex: -1 }}
          />
        )}

        {/* Text with subtle fade-in / fade-out effect on state transition */}
        <AnimatePresence mode="wait">
          <motion.span
            key={`en-${language === 'en' ? 'active' : 'inactive'}`}
            initial={{ opacity: 0.7, y: language === 'en' ? 1 : 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0.7, y: language === 'en' ? 0 : 1 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="relative z-10 block tracking-tight"
          >
            English
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  );
};
