import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Department,
  AppLanguage,
  InputMode,
  PatientRecord,
  ScannedDocument,
  RedFlagAlert,
  DoctorUser,
  SectionKey,
  DoctorSummaryData,
} from '../types';
import { initialMockPatients, initialRedFlagAlerts, mockDoctors } from '../data/mockData';
import { speechService } from '../utils/speech';
import { themes, ThemeTokens } from '../themes/tokens';
import {
  buildDeterministicDoctorSummary,
  generateDoctorSummaryFromGemini,
} from '../utils/summaryService';

export type AppView = 'kiosk' | 'doctor';

interface AppContextType {
  // Current App View & Theme
  appView: AppView;
  setAppView: (view: AppView) => void;
  department: Department;
  setDepartment: (dept: Department) => void;
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  inputMode: InputMode;
  setInputMode: (mode: InputMode) => void;
  theme: ThemeTokens;

  // Patient Kiosk Flow State
  currentKioskStep: number; // 1 to 8
  setCurrentKioskStep: (step: number) => void;
  kioskPatient: Partial<PatientRecord>;
  updateKioskPatient: (updates: Partial<PatientRecord>) => void;
  saveKioskAnswer: (
    questionId: string,
    questionEn: string,
    questionHi: string,
    section: SectionKey,
    answerEn: string,
    answerHi: string,
    isRedFlag?: boolean,
    redFlagReason?: string
  ) => void;
  addScannedDocument: (doc: ScannedDocument) => void;
  removeScannedDocument: (docId: string) => void;
  resetKioskFlow: () => void;
  completeKioskFlow: () => PatientRecord;
  isGeneratingSummary: boolean;
  regenerateDoctorSummary: (patientId: string) => Promise<DoctorSummaryData | null>;

  // Emergency Modal
  isEmergencyModalOpen: boolean;
  setIsEmergencyModalOpen: (open: boolean) => void;
  triggerEmergencyHelp: (type?: string) => void;

  // Audio / Speech Narration
  isSpeaking: boolean;
  speakText: (text: string, lang?: AppLanguage) => void;
  stopSpeaking: () => void;
  autoVoiceEnabled: boolean;
  setAutoVoiceEnabled: (enabled: boolean) => void;

  // Doctor Dashboard State
  loggedInDoctor: DoctorUser | null;
  setLoggedInDoctor: (doc: DoctorUser | null) => void;
  patients: PatientRecord[];
  activeDoctorPatient: PatientRecord | null;
  setActiveDoctorPatient: (patient: PatientRecord | null) => void;
  updatePatientRecord: (patientId: string, updates: Partial<PatientRecord>) => void;
  redFlagAlerts: RedFlagAlert[];
  acknowledgeAlert: (alertId: string) => void;
  dismissAlert: (alertId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appView, setAppView] = useState<AppView>('kiosk');
  const [department, setDepartment] = useState<Department>('general');
  const [language, setLanguage] = useState<AppLanguage>('hi');
  const [inputMode, setInputMode] = useState<InputMode>('touch');
  const [currentKioskStep, setCurrentKioskStep] = useState<number>(1);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [autoVoiceEnabled, setAutoVoiceEnabled] = useState<boolean>(true);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState<boolean>(false);

  // Doctors & Patient Database
  const [loggedInDoctor, setLoggedInDoctor] = useState<DoctorUser | null>(mockDoctors[0]);
  const [patients, setPatients] = useState<PatientRecord[]>(initialMockPatients);
  const [activeDoctorPatient, setActiveDoctorPatient] = useState<PatientRecord | null>(initialMockPatients[0]);
  const [redFlagAlerts, setRedFlagAlerts] = useState<RedFlagAlert[]>(initialRedFlagAlerts);

  // Current Patient being onboarded on Kiosk
  const [kioskPatient, setKioskPatient] = useState<Partial<PatientRecord>>({
    id: `pat_${Date.now()}`,
    tokenNumber: `OPD-${Math.floor(100 + Math.random() * 900)}`,
    department: 'general',
    language: 'hi',
    inputMode: 'touch',
    name: '',
    age: '',
    gender: 'male',
    phone: '',
    abhaId: '',
    redFlags: [],
    chiefComplaints: [],
    historyAnswers: {},
    scannedDocs: [],
    status: 'in_interview',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    roomNumber: 'OPD Room 104',
    waitTimeMin: 10,
    doctorAssigned: 'Dr. Rajesh Sharma, MD',
  });

  const theme = themes[department];

  // Sync theme when department changes
  useEffect(() => {
    setKioskPatient((prev) => ({ ...prev, department }));
  }, [department]);

  const updateKioskPatient = (updates: Partial<PatientRecord>) => {
    setKioskPatient((prev) => ({ ...prev, ...updates }));
  };

  const saveKioskAnswer = (
    questionId: string,
    questionEn: string,
    questionHi: string,
    section: SectionKey,
    answerEn: string,
    answerHi: string,
    isRedFlag?: boolean,
    redFlagReason?: string
  ) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setKioskPatient((prev) => {
      const updatedAnswers = {
        ...prev.historyAnswers,
        [questionId]: {
          question_en: questionEn,
          question_hi: questionHi,
          section,
          answer_en: answerEn,
          answer_hi: answerHi,
          timestamp,
          is_red_flag: isRedFlag,
        },
      };

      const updatedRedFlags = [...(prev.redFlags || [])];
      if (isRedFlag && redFlagReason && !updatedRedFlags.includes(redFlagReason)) {
        updatedRedFlags.push(redFlagReason);
      }

      // If chief complaint
      const updatedComplaints = [...(prev.chiefComplaints || [])];
      if (section === 'chief_complaint' && !updatedComplaints.includes(answerEn)) {
        updatedComplaints.push(`${answerEn} (${answerHi})`);
      }

      return {
        ...prev,
        historyAnswers: updatedAnswers,
        redFlags: updatedRedFlags,
        chiefComplaints: updatedComplaints.length > 0 ? updatedComplaints : prev.chiefComplaints,
      };
    });

    // If red flag triggered in real time, emit alert to Doctor dashboard
    if (isRedFlag && redFlagReason) {
      speechService.playChime('alert');
      const newAlert: RedFlagAlert = {
        id: `alert_${Date.now()}`,
        patientId: kioskPatient.id || `pat_temp`,
        patientName: kioskPatient.name || 'Kiosk Patient (In Progress)',
        tokenNumber: kioskPatient.tokenNumber || 'OPD-NEW',
        flagReason: redFlagReason,
        department,
        severity: 'critical',
        timestamp,
        acknowledged: false,
      };
      setRedFlagAlerts((prev) => [newAlert, ...prev]);
    }
  };

  const addScannedDocument = (doc: ScannedDocument) => {
    setKioskPatient((prev) => ({
      ...prev,
      scannedDocs: [...(prev.scannedDocs || []), doc],
    }));
  };

  const removeScannedDocument = (docId: string) => {
    setKioskPatient((prev) => ({
      ...prev,
      scannedDocs: (prev.scannedDocs || []).filter((d) => d.id !== docId),
    }));
  };

  const resetKioskFlow = () => {
    speechService.stop();
    const tokenPrefix = department === 'ayush' ? 'AYUSH' : 'OPD';
    const randomToken = `${tokenPrefix}-${Math.floor(200 + Math.random() * 800)}`;
    setKioskPatient({
      id: `pat_${Date.now()}`,
      tokenNumber: randomToken,
      department,
      language,
      inputMode,
      name: '',
      age: '',
      gender: 'male',
      phone: '',
      abhaId: '',
      redFlags: [],
      chiefComplaints: [],
      historyAnswers: {},
      scannedDocs: [],
      status: 'in_interview',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      roomNumber: department === 'ayush' ? 'AYUSH Room 202' : 'OPD Room 104',
      waitTimeMin: 12,
      doctorAssigned: department === 'ayush' ? 'Dr. Ananya Vaidya, MD (Ayur)' : 'Dr. Rajesh Sharma, MD',
    });
    setCurrentKioskStep(1);
  };

  const completeKioskFlow = (): PatientRecord => {
    const initialSummary = buildDeterministicDoctorSummary(kioskPatient);

    const finalRecord: PatientRecord = {
      id: kioskPatient.id || `pat_${Date.now()}`,
      tokenNumber: kioskPatient.tokenNumber || 'OPD-300',
      name: kioskPatient.name || (language === 'hi' ? 'नाम दर्ज नहीं' : 'Anonymous Patient'),
      age: kioskPatient.age || 45,
      gender: kioskPatient.gender || 'male',
      phone: kioskPatient.phone || '+91 98000 00000',
      abhaId: kioskPatient.abhaId || '',
      department: department,
      language: language,
      inputMode: inputMode,
      redFlags: kioskPatient.redFlags || [],
      chiefComplaints: kioskPatient.chiefComplaints && kioskPatient.chiefComplaints.length > 0
        ? kioskPatient.chiefComplaints
        : ['Routine Consultation'],
      historyAnswers: kioskPatient.historyAnswers || {},
      scannedDocs: kioskPatient.scannedDocs || [],
      status: 'waiting',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      roomNumber: department === 'ayush' ? 'AYUSH Room 202' : 'OPD Room 104',
      waitTimeMin: (kioskPatient.redFlags && kioskPatient.redFlags.length > 0) ? 2 : 12,
      doctorAssigned: department === 'ayush' ? 'Dr. Ananya Vaidya, MD (Ayur)' : 'Dr. Rajesh Sharma, MD',
      vitals: {
        bp: '128/82 mmHg',
        pulse: '78 bpm',
        temp: '98.6 °F',
        spo2: '98%',
      },
      doctorSummary: initialSummary,
    };

    setPatients((prev) => [finalRecord, ...prev]);

    // Asynchronously call Gemini (gemini-2.5-flash) to generate high-fidelity physician summary
    setIsGeneratingSummary(true);
    generateDoctorSummaryFromGemini(finalRecord)
      .then((aiSummary) => {
        if (aiSummary) {
          updatePatientRecord(finalRecord.id, { doctorSummary: aiSummary });
        }
      })
      .catch((err) => {
        console.warn('Gemini summary background generation notice:', err);
      })
      .finally(() => {
        setIsGeneratingSummary(false);
      });

    return finalRecord;
  };

  const regenerateDoctorSummary = async (patientId: string): Promise<DoctorSummaryData | null> => {
    const targetPatient = patients.find((p) => p.id === patientId) || activeDoctorPatient;
    if (!targetPatient) return null;

    setIsGeneratingSummary(true);
    try {
      const summary = await generateDoctorSummaryFromGemini(targetPatient);
      updatePatientRecord(patientId, { doctorSummary: summary });
      return summary;
    } catch (e) {
      console.error('Failed to regenerate doctor summary:', e);
      return null;
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const triggerEmergencyHelp = (type: string = 'general') => {
    speechService.playChime('alert');
    setIsEmergencyModalOpen(true);
    // Auto-alert doctor
    const alert: RedFlagAlert = {
      id: `alert_emer_${Date.now()}`,
      patientId: kioskPatient.id || 'kiosk_active',
      patientName: kioskPatient.name || 'Emergency Button Pressed at Kiosk',
      tokenNumber: kioskPatient.tokenNumber || 'EMERGENCY',
      flagReason: `Patient pressed 'I Need Help Now' (Type: ${type}). Immediate Nurse/Triage dispatched.`,
      department,
      severity: 'critical',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      acknowledged: false,
    };
    setRedFlagAlerts((prev) => [alert, ...prev]);
  };

  const speakText = (text: string, lang: AppLanguage = language) => {
    if (!autoVoiceEnabled) return;
    setIsSpeaking(true);
    speechService.speak(
      text,
      lang,
      () => setIsSpeaking(true),
      () => setIsSpeaking(false),
      () => setIsSpeaking(false)
    );
  };

  const stopSpeaking = () => {
    speechService.stop();
    setIsSpeaking(false);
  };

  const updatePatientRecord = (patientId: string, updates: Partial<PatientRecord>) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === patientId ? { ...p, ...updates } : p))
    );
    if (activeDoctorPatient && activeDoctorPatient.id === patientId) {
      setActiveDoctorPatient((prev) => (prev ? { ...prev, ...updates } : null));
    }
  };

  const acknowledgeAlert = (alertId: string) => {
    setRedFlagAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
    );
  };

  const dismissAlert = (alertId: string) => {
    setRedFlagAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  return (
    <AppContext.Provider
      value={{
        appView,
        setAppView,
        department,
        setDepartment,
        language,
        setLanguage,
        inputMode,
        setInputMode,
        theme,
        currentKioskStep,
        setCurrentKioskStep,
        kioskPatient,
        updateKioskPatient,
        saveKioskAnswer,
        addScannedDocument,
        removeScannedDocument,
        resetKioskFlow,
        completeKioskFlow,
        isGeneratingSummary,
        regenerateDoctorSummary,
        isEmergencyModalOpen,
        setIsEmergencyModalOpen,
        triggerEmergencyHelp,
        isSpeaking,
        speakText,
        stopSpeaking,
        autoVoiceEnabled,
        setAutoVoiceEnabled,
        loggedInDoctor,
        setLoggedInDoctor,
        patients,
        activeDoctorPatient,
        setActiveDoctorPatient,
        updatePatientRecord,
        redFlagAlerts,
        acknowledgeAlert,
        dismissAlert,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
