import React from 'react';
import { Stethoscope, Sparkles, UserCheck, RefreshCw, Moon, Sun } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EmergencyButton } from './EmergencyButton';
import { LanguageSwitcher } from './LanguageSwitcher';

export const ThemeSwitcherHeader: React.FC = () => {
  const {
    appView,
    setAppView,
    department,
    language,
    theme,
    redFlagAlerts,
    resetKioskFlow,
    currentKioskStep,
    doctorDarkMode,
    toggleDoctorDarkMode,
  } = useApp();

  const unacknowledgedAlerts = redFlagAlerts.filter((a) => !a.acknowledged).length;
  const isDoctorDark = appView === 'doctor' && doctorDarkMode;

  return (
    <div className="w-full sticky top-0 z-40">
      <header
        id="main-app-header"
        className={`w-full border-b shadow-xs px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 transition-colors ${
          isDoctorDark
            ? 'bg-[#0F172A] border-slate-800 text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Left: Brand Identity + Department Badge */}
        <div className="flex items-center space-x-3 text-left">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-xs shrink-0"
            style={{ backgroundColor: isDoctorDark ? '#0284C7' : theme.colors.primary }}
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
            <h1
              className={`text-xl font-bold tracking-tight ${
                isDoctorDark ? 'text-white' : 'text-[#102A43]'
              }`}
            >
              Swasthya AI{' '}
              <span className={isDoctorDark ? 'text-slate-400 font-normal' : 'text-slate-400 font-normal'}>
                | {language === 'hi' ? 'स्वास्थ्य कियोस्क' : 'MediKiosk'}
              </span>
            </h1>
            <p
              className={`text-[10px] uppercase tracking-wider font-semibold ${
                isDoctorDark ? 'text-cyan-400' : 'text-slate-500'
              }`}
            >
              {appView === 'doctor'
                ? isDoctorDark
                  ? 'Doctor Clinical Portal • High-Contrast Night Ward'
                  : 'Doctor Clinical Portal • OPD EMR'
                : department === 'ayush'
                ? theme.displayNameEn
                : 'General Medicine OPD'}
            </p>
          </div>
        </div>

        {/* Center: Live Listening Badge & Evaluator Quick Nav */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Real-time Listening Pill */}
          <div
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border transition-colors ${
              isDoctorDark
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-bold uppercase tracking-wide">
              {language === 'hi' ? 'सुन रहे हैं / Listening' : 'Listening / सक्रिय'}
            </span>
          </div>

          {/* Evaluator Switcher */}
          <div
            className={`flex items-center p-1 rounded-xl border transition-colors ${
              isDoctorDark
                ? 'bg-slate-900 border-slate-700'
                : 'bg-slate-100 border-slate-200'
            }`}
          >
            <button
              id="nav-tab-kiosk"
              type="button"
              onClick={() => setAppView('kiosk')}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                appView === 'kiosk'
                  ? 'bg-[#102A43] text-white shadow-xs'
                  : isDoctorDark
                  ? 'text-slate-300 hover:text-white'
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
                  ? isDoctorDark
                    ? 'bg-cyan-700 text-white shadow-xs ring-1 ring-cyan-400'
                    : 'bg-[#102A43] text-white shadow-xs'
                  : isDoctorDark
                  ? 'text-slate-300 hover:text-white'
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

        {/* Right: Night Mode Toggle + Language Selector + Reset Flow + Emergency Button */}
        <div className="flex items-center gap-2.5">
          {/* Doctor Night Shift / Dark Mode High Contrast Toggle */}
          {appView === 'doctor' && (
            <button
              id="btn-toggle-doctor-dark-mode"
              type="button"
              onClick={toggleDoctorDarkMode}
              className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                doctorDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 border-cyan-500/80 text-cyan-300 ring-1 ring-cyan-500/30'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
              }`}
              title={
                doctorDarkMode
                  ? 'High-Contrast Night Ward Mode Active (Click for Day Light)'
                  : 'Switch to Night Shift Dark Theme (Low Glare for Dimly Lit Wards)'
              }
              aria-label="Toggle Night Shift Dark Mode"
            >
              {doctorDarkMode ? (
                <>
                  <Moon className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span className="hidden sm:inline">Night Ward</span>
                  <span className="text-[10px] bg-cyan-900/80 text-cyan-200 px-1.5 py-0.5 rounded font-mono">
                    DARK
                  </span>
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4 text-amber-600" />
                  <span className="hidden sm:inline">Day Mode</span>
                  <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                    LIGHT
                  </span>
                </>
              )}
            </button>
          )}

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
