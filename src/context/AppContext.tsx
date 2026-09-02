import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
import { mockDoctors } from '../data/mockData';
import { speechService } from '../utils/speech';
import { themes, ThemeTokens } from '../themes/tokens';
import {
  buildDeterministicDoctorSummary,
  generateDoctorSummaryFromGemini,
} from '../utils/summaryService';
import { supabase } from '../lib/supabaseClient';
import {
  syncInterviewTurnToBackend,
  updateRedFlagInBackend,
  finalizeInterviewInBackend,
  uploadDocumentToBackend,
  fetchQueueFromBackend,
  fetchNextSequentialToken,
  updateInterviewStatusInBackend,
} from '../utils/supabaseSync';
import { generateUUID } from '../utils/uuid';

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
  completeKioskFlow: (identityOverrides?: Partial<PatientRecord>) => PatientRecord;
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
  doctorDarkMode: boolean;
  setDoctorDarkMode: (val: boolean) => void;
  toggleDoctorDarkMode: () => void;
  patients: PatientRecord[];
  refreshQueue: () => Promise<void>;
  activeDoctorPatient: PatientRecord | null;
  setActiveDoctorPatient: (patient: PatientRecord | null) => void;
  updatePatientRecord: (patientId: string, updates: Partial<PatientRecord>) => void;
  markPatientAsDiagnosed: (
    patientId: string,
    options?: {
      outcome?: string;
      notes?: string;
      summary?: DoctorSummaryData;
    }
  ) => Promise<boolean>;
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

  // Doctors & Patient Database (Strictly initialized empty, populated from real Supabase records)
  const [loggedInDoctor, setLoggedInDoctor] = useState<DoctorUser | null>(mockDoctors[0]);
  const [doctorDarkMode, setDoctorDarkModeState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('doctor_dark_mode');
      return saved !== null ? saved === 'true' : true; // Default to true (high contrast dark mode enabled for doctor night shifts)
    } catch {
      return true;
    }
  });

  const setDoctorDarkMode = useCallback((val: boolean) => {
    setDoctorDarkModeState(val);
    try {
      localStorage.setItem('doctor_dark_mode', String(val));
    } catch {
      // ignore
    }
  }, []);

  const toggleDoctorDarkMode = useCallback(() => {
    setDoctorDarkModeState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('doctor_dark_mode', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [activeDoctorPatient, setActiveDoctorPatient] = useState<PatientRecord | null>(null);
  const [redFlagAlerts, setRedFlagAlerts] = useState<RedFlagAlert[]>([]);

  // Current Patient being onboarded on Kiosk
  const [kioskPatient, setKioskPatient] = useState<Partial<PatientRecord>>({
    id: generateUUID(),
    tokenNumber: 'OPD-001',
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

  // Fetch all live patient queue records from backend/Supabase
  const refreshQueue = useCallback(async () => {
    try {
      const serverPatients = await fetchQueueFromBackend('all');
      if (Array.isArray(serverPatients)) {
        setPatients(serverPatients);
        // Keep active patient in sync with server data
        setActiveDoctorPatient((currentActive) => {
          if (!currentActive) return null;
          const matched = serverPatients.find(
            (p) => p.id === currentActive.id || (p as any).patientId === currentActive.id
          );
          return matched || currentActive;
        });
      }
    } catch (e) {
      console.warn('[AppContext] Failed to refresh queue from Supabase backend:', e);
    }
  }, []);

  // Sync theme and next sequential token when department changes
  useEffect(() => {
    setKioskPatient((prev) => ({ ...prev, department }));
    fetchNextSequentialToken(department).then((tok) => {
      setKioskPatient((prev) => {
        // Only update token if it hasn't been locked in or is default
        if (!prev.tokenNumber || prev.tokenNumber.startsWith('OPD-') || prev.tokenNumber.startsWith('AYUSH-')) {
          return { ...prev, tokenNumber: tok };
        }
        return prev;
      });
    });
  }, [department]);

  // Load live patient queue from Supabase on mount and poll periodically
  useEffect(() => {
    refreshQueue();
    const interval = setInterval(() => {
      refreshQueue();
    }, 4000);
    return () => clearInterval(interval);
  }, [refreshQueue]);

  // Set up Supabase Realtime subscription on interviews table for live queue & red-flag alerts
  useEffect(() => {
    try {
      const channel = supabase
        .channel('realtime-interviews-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'interviews' },
          (payload) => {
            // Check for red flag alert
            const record = payload.new as any;
            if (record && record.red_flag && record.red_flag_reason) {
              speechService.playChime('alert');
              const newAlert: RedFlagAlert = {
                id: `alert_${record.id || Date.now()}`,
                patientId: record.patient_id || record.id,
                patientName: 'Kiosk Patient (Realtime Triage)',
                tokenNumber: record.opd_token || 'OPD-REALTIME',
                flagReason: record.red_flag_reason,
                department: record.department || 'general',
                severity: 'critical',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                acknowledged: false,
              };

              setRedFlagAlerts((prev) => {
                if (prev.some((a) => a.flagReason === newAlert.flagReason && a.tokenNumber === newAlert.tokenNumber)) {
                  return prev;
                }
                return [newAlert, ...prev];
              });
            }

            // Live queue refresh from backend
            refreshQueue();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (realtimeErr) {
      console.warn('Supabase Realtime subscription notice:', realtimeErr);
    }
  }, [refreshQueue]);

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

    let updatedPatientSnapshot: Partial<PatientRecord> | null = null;

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

      const snapshot: Partial<PatientRecord> = {
        ...prev,
        historyAnswers: updatedAnswers,
        redFlags: updatedRedFlags,
        chiefComplaints: updatedComplaints.length > 0 ? updatedComplaints : prev.chiefComplaints,
      };
      updatedPatientSnapshot = snapshot;
      return snapshot;
    });

    // Asynchronously write turn to Supabase persistence
    const currentInterviewId = kioskPatient.id || generateUUID();
    const currentAnswers = {
      ...(kioskPatient.historyAnswers || {}),
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

    syncInterviewTurnToBackend({
      interviewId: currentInterviewId,
      patientId: currentInterviewId,
      patientData: {
        name: kioskPatient.name,
        age: kioskPatient.age,
        gender: kioskPatient.gender,
        phone: kioskPatient.phone,
        abhaId: kioskPatient.abhaId,
        language: kioskPatient.language || language,
        department: kioskPatient.department || department,
      },
      department,
      status: 'in_interview',
      structuredState: {
        chief_complaint: kioskPatient.chiefComplaints?.[0],
        current_section: section,
        historyAnswers: currentAnswers,
      },
      transcript: Object.values(currentAnswers),
      symptomTags: kioskPatient.redFlags || [],
      redFlag: !!isRedFlag,
      redFlagReason,
      opdToken: kioskPatient.tokenNumber,
    }).catch((err) => {
      console.warn('[Supabase Sync] Turn write warning:', err);
    });

    // If red flag triggered in real time, emit alert to Doctor dashboard and update backend
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

      updateRedFlagInBackend(currentInterviewId, true, redFlagReason).catch((rfErr) => {
        console.warn('[Supabase Sync] Red flag sync warning:', rfErr);
      });
    }
  };

  const addScannedDocument = (doc: ScannedDocument) => {
    setKioskPatient((prev) => ({
      ...prev,
      scannedDocs: [...(prev.scannedDocs || []), doc],
    }));

    // Asynchronously upload to Supabase documents table & storage
    if (kioskPatient.id) {
      uploadDocumentToBackend(kioskPatient.id, doc).catch((docErr) => {
        console.warn('[Supabase Sync] Document upload warning:', docErr);
      });
    }
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
    setKioskPatient({
      id: generateUUID(),
      tokenNumber: `${tokenPrefix}-001`,
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
    fetchNextSequentialToken(department).then((tok) => {
      setKioskPatient((prev) => ({ ...prev, tokenNumber: tok }));
    });
    setCurrentKioskStep(1);
  };

  const completeKioskFlow = (identityOverrides?: Partial<PatientRecord>): PatientRecord => {
    const mergedPatient: Partial<PatientRecord> = {
      ...kioskPatient,
      ...(identityOverrides || {}),
    };

    setKioskPatient(mergedPatient);

    const initialSummary = buildDeterministicDoctorSummary(mergedPatient);

    const patientId = mergedPatient.id || kioskPatient.id || generateUUID();

    const rawAge = mergedPatient.age;
    const parsedAge =
      typeof rawAge === 'number'
        ? rawAge
        : rawAge && String(rawAge).trim() !== ''
        ? parseInt(String(rawAge).trim(), 10) || null
        : null;

    const tokenPrefix = (mergedPatient.department || department) === 'ayush' ? 'AYUSH' : 'OPD';
    const initialToken = mergedPatient.tokenNumber || `${tokenPrefix}-001`;

    const finalRecord: PatientRecord = {
      id: patientId,
      tokenNumber: initialToken,
      name:
        mergedPatient.name && mergedPatient.name.trim() !== ''
          ? mergedPatient.name.trim()
          : (language === 'hi' ? 'मरीज' : 'Patient'),
      age: parsedAge !== null ? parsedAge : (language === 'hi' ? 45 : 45),
      gender: mergedPatient.gender || 'male',
      phone: mergedPatient.phone ? String(mergedPatient.phone).trim() : '',
      abhaId: mergedPatient.abhaId ? String(mergedPatient.abhaId).trim() : '',
      department: mergedPatient.department || department,
      language: mergedPatient.language || language,
      inputMode: mergedPatient.inputMode || inputMode,
      redFlags: mergedPatient.redFlags || [],
      chiefComplaints:
        mergedPatient.chiefComplaints && mergedPatient.chiefComplaints.length > 0
          ? mergedPatient.chiefComplaints
          : ['Routine Consultation'],
      historyAnswers: mergedPatient.historyAnswers || {},
      scannedDocs: mergedPatient.scannedDocs || [],
      status: 'waiting',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      roomNumber: (mergedPatient.department || department) === 'ayush' ? 'AYUSH Room 202' : 'OPD Room 104',
      waitTimeMin: (mergedPatient.redFlags && mergedPatient.redFlags.length > 0) ? 2 : 12,
      doctorAssigned:
        (mergedPatient.department || department) === 'ayush'
          ? 'Dr. Ananya Vaidya, MD (Ayur)'
          : 'Dr. Rajesh Sharma, MD',
      vitals: {
        bp: '128/82 mmHg',
        pulse: '78 bpm',
        temp: '98.6 °F',
        spo2: '98%',
      },
      doctorSummary: initialSummary,
    };

    console.log('[AppContext] completeKioskFlow generated finalRecord for Supabase:', {
      patientId: finalRecord.id,
      name: finalRecord.name,
      age: finalRecord.age,
      gender: finalRecord.gender,
      phone: finalRecord.phone,
      abhaId: finalRecord.abhaId,
      tokenNumber: finalRecord.tokenNumber,
      overridesPassed: identityOverrides,
    });

    setPatients((prev) => [finalRecord, ...prev.filter((p) => p.id !== finalRecord.id)]);

    // Asynchronously finalize interview in Supabase backend & update confirmed token
    finalizeInterviewInBackend(finalRecord.id, finalRecord)
      .then((res) => {
        if (res?.opdToken && res.opdToken !== finalRecord.tokenNumber) {
          console.log('[AppContext] Updating patient with server-confirmed token:', res.opdToken);
          updatePatientRecord(finalRecord.id, { tokenNumber: res.opdToken });
          setKioskPatient((prev) => ({ ...prev, tokenNumber: res.opdToken }));
        }
      })
      .catch((finErr) => {
        console.warn('[Supabase Sync] Finalize interview warning:', finErr);
      });

    // Asynchronously call Gemini (gemini-2.5-flash) to generate high-fidelity physician summary
    setIsGeneratingSummary(true);
    generateDoctorSummaryFromGemini(finalRecord)
      .then((aiSummary) => {
        if (aiSummary) {
          updatePatientRecord(finalRecord.id, { doctorSummary: aiSummary });
          // Update summary in Supabase
          finalizeInterviewInBackend(finalRecord.id, {
            ...finalRecord,
            doctorSummary: aiSummary,
          }).catch(() => {});
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

  const speakText = useCallback((text: string, lang: AppLanguage = language) => {
    if (!autoVoiceEnabled) return;
    setIsSpeaking(true);
    speechService.speak(
      text,
      lang,
      () => setIsSpeaking(true),
      () => setIsSpeaking(false),
      () => setIsSpeaking(false)
    );
  }, [autoVoiceEnabled, language]);

  const stopSpeaking = useCallback(() => {
    speechService.stop();
    setIsSpeaking(false);
  }, []);

  const updatePatientRecord = (patientId: string, updates: Partial<PatientRecord>) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === patientId ? { ...p, ...updates } : p))
    );
    if (activeDoctorPatient && activeDoctorPatient.id === patientId) {
      setActiveDoctorPatient((prev) => (prev ? { ...prev, ...updates } : null));
    }

    // If status or doctor approval or summary was updated, sync to backend
    if (updates.status || updates.doctorApproved || updates.doctorSummary || updates.physicianNotes) {
      updateInterviewStatusInBackend(patientId, updates.status || 'waiting', {
        physicianNotes: updates.physicianNotes,
        consultationOutcome: updates.consultationOutcome,
        consultationTime: updates.consultationTime,
        doctorSummary: updates.doctorSummary,
        doctorApproved: updates.doctorApproved,
      }).catch((err) => {
        console.warn('[AppContext] Sync update to backend warning:', err);
      });
    }
  };

  const markPatientAsDiagnosed = async (
    patientId: string,
    options?: {
      outcome?: string;
      notes?: string;
      summary?: DoctorSummaryData;
    }
  ): Promise<boolean> => {
    const consultTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const outcomeText = options?.outcome || options?.notes || 'Consultation & Clinical Treatment Plan Completed';

    const updates: Partial<PatientRecord> = {
      status: 'completed',
      doctorApproved: true,
      consultationTime: consultTime,
      consultationOutcome: outcomeText,
      physicianNotes: options?.notes,
    };
    if (options?.summary) {
      updates.doctorSummary = options.summary;
    }

    updatePatientRecord(patientId, updates);

    const success = await updateInterviewStatusInBackend(patientId, 'completed', {
      physicianNotes: options?.notes,
      consultationOutcome: outcomeText,
      consultationTime: consultTime,
      doctorSummary: options?.summary,
      doctorApproved: true,
    });

    return success;
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
        doctorDarkMode,
        setDoctorDarkMode,
        toggleDoctorDarkMode,
        patients,
        refreshQueue,
        activeDoctorPatient,
        setActiveDoctorPatient,
        updatePatientRecord,
        markPatientAsDiagnosed,
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
