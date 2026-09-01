export type Department = 'general' | 'ayush';
export type AppLanguage = 'hi' | 'en';
export type InputMode = 'voice' | 'touch';

export type SectionKey =
  | 'chief_complaint'
  | 'hpi'
  | 'past_history'
  | 'drug_allergy'
  | 'family_history'
  | 'personal_history'
  | 'ros'
  | 'dashavidha_pariksha'
  | 'ahara_vihara';

export interface QuestionOption {
  id: string;
  text_en: string;
  text_hi: string;
  red_flag?: boolean;
  red_flag_reason?: string;
  symptom_detail?: string;
}

export interface BackendQuestionContract {
  id: string;
  question_en: string;
  question_hi: string;
  input_type: 'single_select' | 'multi_select' | 'free_text';
  options: QuestionOption[];
  section: SectionKey;
  symptom_tags: string[];
  section_complete: boolean;
  interview_complete: boolean;
  audio_prompt_en?: string;
  audio_prompt_hi?: string;
  ayush_only?: boolean;
  clinical_rationale?: string;
}

export interface ScannedDocument {
  id: string;
  title: string;
  type: 'prescription' | 'lab_report' | 'discharge_summary' | 'imaging';
  date: string;
  facility: string;
  doctorName?: string;
  confidence: number;
  extractedData: {
    medicines?: Array<{ name: string; dosage: string; frequency: string }>;
    vitals?: Record<string, string>;
    diagnoses?: string[];
    labValues?: Array<{ parameter: string; value: string; unit: string; status: 'normal' | 'high' | 'low' }>;
    notesSummary: string;
  };
  fileUrl?: string;
}

export interface PatientHistoryAnswer {
  question_en: string;
  question_hi: string;
  section: SectionKey;
  answer_en: string;
  answer_hi: string;
  timestamp: string;
  is_red_flag?: boolean;
}

export interface DoctorSummaryData {
  chiefComplaint: string;
  hpi: string;
  pastMedicalSurgicalHistory: string;
  drugAndAllergyHistory: string;
  familyHistory: string;
  personalHistory: string;
  reviewOfSystems: string;
  priorityClinicalWarningFlags: string[];
  ayushAssessment?: {
    prakriti?: string;
    agni?: string;
    kostha?: string;
    bala?: string;
    clinicalNotes?: string;
  };
  generatedAt?: string;
  modelUsed?: string;
}

export interface PatientRecord {
  id: string;
  tokenNumber: string;
  name: string;
  age: number | string;
  gender: 'male' | 'female' | 'other';
  phone: string;
  abhaId?: string;
  department: Department;
  language: AppLanguage;
  inputMode: InputMode;
  redFlags: string[];
  chiefComplaints: string[];
  historyAnswers: Record<string, PatientHistoryAnswer>;
  scannedDocs: ScannedDocument[];
  status: 'in_interview' | 'waiting' | 'in_consultation' | 'completed';
  timestamp: string;
  roomNumber: string;
  waitTimeMin: number;
  doctorAssigned: string;
  liveAlertSent?: boolean;
  vitals?: {
    bp?: string;
    pulse?: string;
    temp?: string;
    spo2?: string;
  };
  ayushAssessment?: {
    prakriti?: string;
    agni?: string;
    kostha?: string;
    bala?: string;
  };
  doctorSummary?: DoctorSummaryData;
  physicianNotes?: string;
  doctorApproved?: boolean;
}

export interface RedFlagAlert {
  id: string;
  patientId: string;
  patientName: string;
  tokenNumber: string;
  flagReason: string;
  department: Department;
  severity: 'critical' | 'urgent';
  timestamp: string;
  acknowledged: boolean;
}

export interface DoctorUser {
  id: string;
  name: string;
  title: string;
  department: Department;
  specialization: string;
  regNumber: string;
  avatarUrl: string;
  roomNumber: string;
}
