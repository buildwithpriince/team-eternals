import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ThemeSwitcherHeader } from './components/ThemeSwitcherHeader';
import { EmergencyModal } from './components/EmergencyModal';
import { Step1Greeting } from './pages/patient/Step1Greeting';
import { Step2Consent } from './pages/patient/Step2Consent';
import { Step3Preferences } from './pages/patient/Step3Preferences';
import { Step4Interview } from './pages/patient/Step4Interview';
import { Step5DocumentScan } from './pages/patient/Step5DocumentScan';
import { Step6SummaryConfirmation } from './pages/patient/Step6SummaryConfirmation';
import { Step7DeferredIdentity } from './pages/patient/Step7DeferredIdentity';
import { Step8QueueRouted } from './pages/patient/Step8QueueRouted';
import { DoctorLogin } from './pages/doctor/DoctorLogin';
import { DoctorQueue } from './pages/doctor/DoctorQueue';
import { DoctorSummaryDetail } from './pages/doctor/DoctorSummaryDetail';

const AppContent: React.FC = () => {
  const {
    appView,
    currentKioskStep,
    theme,
    loggedInDoctor,
    setLoggedInDoctor,
    activeDoctorPatient,
    setActiveDoctorPatient,
    doctorDarkMode,
  } = useApp();

  const isDoctorDark = appView === 'doctor' && doctorDarkMode;

  return (
    <div
      id="app-root-container"
      className={`min-h-screen flex flex-col font-sans transition-colors duration-300 antialiased ${
        isDoctorDark
          ? 'dark bg-[#0B0F17] text-slate-100 selection:bg-cyan-900 selection:text-cyan-200'
          : 'selection:bg-cyan-200 selection:text-cyan-900'
      }`}
      style={{
        backgroundColor: isDoctorDark ? '#0B0F17' : theme.colors.bgPage,
        color: isDoctorDark ? '#F8FAFC' : theme.colors.textPrimary,
        fontFamily: theme.fonts?.body || 'inherit',
      }}
    >
      {/* Universal Top Header */}
      <ThemeSwitcherHeader />

      {/* Main App Body */}
      <main
        id="main-app-viewport"
        className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col justify-start"
      >
        {/* KIOSK PATIENT FLOW */}
        {appView === 'kiosk' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center">
            {currentKioskStep === 1 && <Step1Greeting />}
            {currentKioskStep === 2 && <Step2Consent />}
            {currentKioskStep === 3 && <Step3Preferences />}
            {currentKioskStep === 4 && <Step4Interview />}
            {currentKioskStep === 5 && <Step5DocumentScan />}
            {currentKioskStep === 6 && <Step6SummaryConfirmation />}
            {currentKioskStep === 7 && <Step7DeferredIdentity />}
            {currentKioskStep === 8 && <Step8QueueRouted />}
          </div>
        )}

        {/* DOCTOR EMR DASHBOARD */}
        {appView === 'doctor' && (
          <div className="w-full flex-1">
            {!loggedInDoctor ? (
              <DoctorLogin onLoginSuccess={(doc) => setLoggedInDoctor(doc)} />
            ) : activeDoctorPatient ? (
              <DoctorSummaryDetail
                patient={activeDoctorPatient}
                onBackToQueue={() => setActiveDoctorPatient(null)}
              />
            ) : (
              <DoctorQueue
                onSelectPatient={(patient) => setActiveDoctorPatient(patient)}
              />
            )}
          </div>
        )}
      </main>

      {/* Emergency Modal overlay (fires immediately when triggered from anywhere) */}
      <EmergencyModal />

      {/* Footer Accessibility / OPD Compliance Strip */}
      <footer
        className={`w-full border-t py-3 px-4 text-center text-xs font-medium transition-colors ${
          isDoctorDark
            ? 'border-slate-800 bg-[#0F172A]/90 text-slate-400'
            : 'border-slate-200/80 bg-white/60 backdrop-blur-xs text-slate-500'
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Swasthya AI • Built by team eternals ♡
          </span>
          <span className="flex items-center gap-3">
            {isDoctorDark && (
              <span className="text-cyan-400 font-semibold flex items-center gap-1">
                <span>🌙 Night Ward Dark Theme Active</span>
              </span>
            )}
            <span>Bilingual Devanagari / English TTS Active</span>
            <span>•</span>
            <span>Fast-Track Red-Flag Triage Engine</span>
          </span>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
