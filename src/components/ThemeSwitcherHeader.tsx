import React from 'react';
import { Stethoscope, Sparkles, UserCheck, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EmergencyButton } from './EmergencyButton';
import { LanguageSwitcher } from './LanguageSwitcher';

export const ThemeSwitcherHeader: React.FC = () => {
  const {
    appView,
    setAppView,
    department,
    language,
    setLanguage,
    theme,
    redFlagAlerts,
    resetKioskFlow,
    currentKioskStep,
    isSpeaking,
  } = useApp();

  const unacknowledgedAlerts = redFlagAlerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="w-full sticky top-0 z-40">
      <header
        id="main-app-header"
        className="w-full bg-white border-b border-slate-200 shadow-xs px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 transition-colors"
      >
        {/* Left: Brand Identity + Department Badge */}
        <div className="flex items-center space-x-3 text-left">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-xs shrink-0"
            style={{ backgroundColor: theme.colors.primary }}
          >
            {department === 'ayush' ? (
              <Sparkles className="w-6 h-6 text-amber-300" />
            ) : (
              <div className="w-6 h-6 border-3 border-white rounded-full border-t-transparent animate-spin-slow flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
            )}
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#102A43]">
              Swasthya AI{' '}
              <span className="text-slate-400 font-normal">
                | {language === 'hi' ? 'स्वास्थ्य कियोस्क' : 'MediKiosk'}
              </span>
            </h1>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
              {department === 'ayush' ? theme.displayNameEn : 'General Medicine OPD'}
            </p>
          </div>
        </div>

        {/* Center: Live Listening Badge & Evaluator Quick Nav */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Real-time Listening Pill */}
          <div className="flex items-center space-x-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
              {language === 'hi' ? 'सुन रहे हैं / Listening' : 'Listening / सक्रिय'}
            </span>
          </div>

          {/* Evaluator Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              id="nav-tab-kiosk"
              type="button"
              onClick={() => setAppView('kiosk')}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                appView === 'kiosk'
                  ? 'bg-[#102A43] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              <span>{language === 'hi' ? 'मरीज कियोस्क' : 'Patient Kiosk'}</span>
            </button>

            <button
              id="nav-tab-doctor"
              type="button"
              onClick={() => setAppView('doctor')}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer relative ${
                appView === 'doctor'
                  ? 'bg-[#102A43] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>{language === 'hi' ? 'डॉक्टर पोर्टल' : 'Doctor Portal'}</span>

              {unacknowledgedAlerts > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-black rounded-full bg-red-600 text-white animate-pulse">
                  {unacknowledgedAlerts}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Right: Language Selector + Reset Flow + Emergency Button */}
        <div className="flex items-center gap-2.5">
          {/* Language Toggle with Smooth Fade Animation */}
          <LanguageSwitcher size="sm" />

          {/* Reset Kiosk Button */}
          {appView === 'kiosk' && (
            <button
              id="btn-restart-kiosk-flow"
              type="button"
              onClick={resetKioskFlow}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer"
              title={language === 'hi' ? 'शुरुआत से शुरू करें' : 'Restart Kiosk Flow'}
              aria-label="Restart flow"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {/* Emergency Button */}
          <EmergencyButton />
        </div>
      </header>

      {/* Top Slim Step Progress Line for Kiosk */}
      {appView === 'kiosk' && (
        <div className="flex-none h-1.5 bg-slate-200 w-full">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${(currentKioskStep / 8) * 100}%`,
              backgroundColor: theme.colors.primary,
            }}
          />
        </div>
      )}
    </div>
  );
};
