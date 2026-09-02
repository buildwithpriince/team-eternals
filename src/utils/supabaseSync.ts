import { supabase } from '../lib/supabaseClient';
import { PatientRecord, ScannedDocument, DoctorSummaryData, Department } from '../types';
import { toValidUUID } from './uuid';

export interface TurnSyncPayload {
  interviewId: string;
  patientId: string;
  patientData: {
    name?: string;
    age?: number | string;
    gender?: string;
    phone?: string;
    abhaId?: string;
    language?: string;
    department?: string;
  };
  department: string;
  status?: string;
  structuredState: any;
  transcript: any;
  symptomTags: string[];
  redFlag?: boolean;
  redFlagReason?: string;
  opdToken?: string;
  summary?: any;
}

// Sync interview turn to backend and Supabase
export async function syncInterviewTurnToBackend(payload: TurnSyncPayload): Promise<boolean> {
  try {
    const res = await fetch('/api/interviews/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        interviewId: toValidUUID(payload.interviewId),
        patientId: toValidUUID(payload.patientId),
      }),
    });
    if (!res.ok) {
      console.warn('Sync interview turn HTTP error:', res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Failed to sync interview turn to backend:', err);
    return false;
  }
}

// Update red flag alert in Supabase
export async function updateRedFlagInBackend(
  interviewId: string,
  redFlag: boolean,
  redFlagReason?: string
): Promise<boolean> {
  try {
    const res = await fetch('/api/interviews/red-flag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interviewId: toValidUUID(interviewId),
        redFlag,
        redFlagReason,
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to update red flag on backend:', err);
    return false;
  }
}

// Fetch next sequential OPD/AYUSH token from backend atomic counter
export async function fetchNextSequentialToken(department: string = 'general'): Promise<string> {
  const prefix = department === 'ayush' ? 'AYUSH' : 'OPD';
  try {
    const res = await fetch(`/api/tokens/next?prefix=${prefix}`);
    if (res.ok) {
      const data = await res.json();
      if (data.tokenNumber) {
        return data.tokenNumber;
      }
    }
  } catch (err) {
    console.warn('[SupabaseSync] Error fetching next sequential token:', err);
  }
  return `${prefix}-001`;
}

// Complete interview and save final summary
export async function finalizeInterviewInBackend(
  interviewId: string,
  patientRecord: PatientRecord
): Promise<{ success: boolean; opdToken?: string }> {
  const validInterviewId = toValidUUID(interviewId);
  const validPatientId = toValidUUID(patientRecord.id || interviewId);

  const parsedAge =
    typeof patientRecord.age === 'number'
      ? patientRecord.age
      : patientRecord.age && String(patientRecord.age).trim() !== ''
      ? parseInt(String(patientRecord.age).trim(), 10) || null
      : null;

  const capturedName =
    patientRecord.name && String(patientRecord.name).trim() !== ''
      ? String(patientRecord.name).trim()
      : null;

  const payload = {
    interviewId: validInterviewId,
    patientId: validPatientId,
    status: 'waiting',
    summary: patientRecord.doctorSummary,
    patientData: {
      name: capturedName,
      age: parsedAge,
      gender: patientRecord.gender,
      phone: patientRecord.phone && String(patientRecord.phone).trim() !== '' ? String(patientRecord.phone).trim() : null,
      abhaId: patientRecord.abhaId && String(patientRecord.abhaId).trim() !== '' ? String(patientRecord.abhaId).trim() : null,
      language: patientRecord.language,
      department: patientRecord.department,
    },
    transcript: Object.values(patientRecord.historyAnswers || {}),
    redFlag: patientRecord.redFlags && patientRecord.redFlags.length > 0,
    redFlagReason: patientRecord.redFlags?.[0],
    opdToken: patientRecord.tokenNumber,
  };

  console.log('[SupabaseSync] finalizeInterviewInBackend payload prepared:', {
    nameCaptured: capturedName,
    ageCaptured: parsedAge,
    phoneCaptured: payload.patientData.phone,
    patientId: payload.patientId,
    interviewId: payload.interviewId,
    opdToken: payload.opdToken,
  });

  try {
    const res = await fetch('/api/interviews/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      console.log('[SupabaseSync] /api/interviews/summary response success:', data);
      return { success: true, opdToken: data.opdToken || payload.opdToken };
    } else {
      console.warn('[SupabaseSync] /api/interviews/summary HTTP error:', res.status, res.statusText);
      return { success: false, opdToken: payload.opdToken };
    }
  } catch (err) {
    console.warn('Failed to finalize interview on backend:', err);
    return { success: false, opdToken: payload.opdToken };
  }
}

// Upload document file to Supabase storage and documents table
export async function uploadDocumentToBackend(
  interviewId: string,
  document: ScannedDocument,
  fileBase64?: string
): Promise<ScannedDocument | null> {
  try {
    const res = await fetch('/api/documents/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interviewId: toValidUUID(interviewId),
        documentId: toValidUUID(document.id),
        title: document.title,
        docType: document.type,
        extractedData: document.extractedData,
        fileBase64: fileBase64 || null,
        confidence: document.confidence,
        date: document.date,
        facility: document.facility,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        ...document,
        id: data.document?.id || document.id,
        fileUrl: data.document?.storage_path || document.fileUrl,
      };
    }
    return document;
  } catch (err) {
    console.warn('Failed to upload document to backend:', err);
    return document;
  }
}

// Update interview status (e.g. mark as diagnosed / completed)
export async function updateInterviewStatusInBackend(
  interviewId: string,
  status: 'waiting' | 'in_consultation' | 'completed' | 'in_interview',
  options?: {
    physicianNotes?: string;
    consultationOutcome?: string;
    consultationTime?: string;
    doctorSummary?: any;
    doctorApproved?: boolean;
  }
): Promise<boolean> {
  try {
    const res = await fetch('/api/interviews/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interviewId: toValidUUID(interviewId),
        status,
        physicianNotes: options?.physicianNotes,
        consultationOutcome: options?.consultationOutcome,
        consultationTime: options?.consultationTime,
        doctorSummary: options?.doctorSummary,
        doctorApproved: options?.doctorApproved,
      }),
    });
    if (res.ok) {
      console.log(`[SupabaseSync] Interview ${interviewId} status updated to ${status}`);
      return true;
    }
  } catch (err) {
    console.warn('[SupabaseSync] Error updating interview status in backend:', err);
  }
  return false;
}

// Fetch all live patient queue records from backend/Supabase
export async function fetchQueueFromBackend(department?: string): Promise<PatientRecord[]> {
  try {
    const url = department && department !== 'all'
      ? `/api/doctor/queue?department=${department}`
      : '/api/doctor/queue';
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.patients)) {
        return data.patients;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch doctor queue from backend:', err);
  }
  return [];
}
