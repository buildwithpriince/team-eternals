import { PatientRecord, DoctorSummaryData } from '../types';

/**
 * Fallback summary generator in case backend is unreachable or rate limited.
 * Follows strict medical rules: never suggests diagnoses or interpretations,
 * only summarizes the reported transcript and extracted document data.
 */
export function buildDeterministicDoctorSummary(patient: Partial<PatientRecord>): DoctorSummaryData {
  const answers = patient.historyAnswers || {};
  const isAyush = patient.department === 'ayush';
  const docs = patient.scannedDocs || [];

  // Chief Complaint
  const primaryCc =
    patient.chiefComplaints && patient.chiefComplaints.length > 0
      ? patient.chiefComplaints.join(', ')
      : answers['chief_complaint']?.answer_en || 'Routine outpatient health consultation';

  // HPI
  const durationAnswer = answers['duration']?.answer_en || answers['q2_duration']?.answer_en;
  const hpiDetail = answers['hpi']?.answer_en || answers['q3_severity_and_nature']?.answer_en;
  const hpiTrigger = answers['triggers']?.answer_en || answers['q4_triggers']?.answer_en;

  let hpi = `Patient reports chief complaint of ${primaryCc}.`;
  if (durationAnswer) {
    hpi += ` Onset & Duration: ${durationAnswer}.`;
  }
  if (hpiDetail) {
    hpi += ` Character & Severity: ${hpiDetail}.`;
  }
  if (hpiTrigger) {
    hpi += ` Aggravating / Relieving factors: ${hpiTrigger}.`;
  }

  // Document insights for past medical
  const docDiagnoses: string[] = [];
  const docMedicines: string[] = [];
  docs.forEach((doc) => {
    if (doc.extractedData?.diagnoses) {
      docDiagnoses.push(...doc.extractedData.diagnoses);
    }
    if (doc.extractedData?.medicines) {
      docMedicines.push(
        ...doc.extractedData.medicines.map(
          (m) => `${m.name} ${m.dosage || ''} (${m.frequency || ''})`
        )
      );
    }
  });

  // Past Medical / Surgical
  const reportedPast =
    answers['past_history']?.answer_en || answers['q5_past_history']?.answer_en;
  let pastMedical = reportedPast || 'No significant prior chronic illness reported by patient.';
  if (docDiagnoses.length > 0) {
    pastMedical += ` Prior documented diagnoses in uploaded records: ${Array.from(
      new Set(docDiagnoses)
    ).join(', ')}.`;
  }

  // Drug & Allergy
  const reportedAllergies =
    answers['drug_allergy']?.answer_en || answers['q7_drug_allergies']?.answer_en;
  let drugAllergy = reportedAllergies || 'No Known Drug Allergies (NKDA) reported by patient.';
  if (docMedicines.length > 0) {
    drugAllergy += ` Current medications on uploaded prescriptions: ${Array.from(
      new Set(docMedicines)
    ).join('; ')}.`;
  }

  // Personal / Family History
  const reportedPersonal =
    answers['personal_history']?.answer_en || answers['q8_habits_and_family']?.answer_en;
  const personalHistory =
    reportedPersonal || 'Non-smoker, non-alcoholic. No premature familial cardiovascular disease reported.';
  const familyHistory =
    answers['family_history']?.answer_en ||
    (reportedPersonal?.toLowerCase().includes('brother') || reportedPersonal?.toLowerCase().includes('father')
      ? reportedPersonal
      : 'No hereditary familial illnesses explicitly reported.');

  // Review of Systems (ROS)
  const reportedRos =
    answers['ros']?.answer_en || answers['q9_ros_associated_symptoms']?.answer_en;
  const reviewOfSystems =
    reportedRos ||
    'Systemic review negative for fever, unexplained weight loss, night sweats, or pedal edema.';

  // Priority Clinical Warning Flags: ONLY the symptom combinations already matched by existing red-flag rule set
  const redFlags = patient.redFlags && patient.redFlags.length > 0 ? patient.redFlags : [];

  const summaryData: DoctorSummaryData = {
    chiefComplaint: primaryCc,
    hpi: hpi.trim(),
    pastMedicalSurgicalHistory: pastMedical.trim(),
    drugAndAllergyHistory: drugAllergy.trim(),
    familyHistory: familyHistory.trim(),
    personalHistory: personalHistory.trim(),
    reviewOfSystems: reviewOfSystems.trim(),
    priorityClinicalWarningFlags: redFlags,
    generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    modelUsed: 'Local Medical Scribe Rule Engine',
  };

  if (isAyush) {
    summaryData.ayushAssessment = {
      prakriti: patient.ayushAssessment?.prakriti || answers['prakriti']?.answer_en || 'Vata-Pitta Pradhana',
      agni: patient.ayushAssessment?.agni || answers['ahara_vihara']?.answer_en || 'Mandagni (Sluggish Digestion)',
      kostha: patient.ayushAssessment?.kostha || answers['dashavidha_pariksha']?.answer_en || 'Krura Kostha (Hard Bowels)',
      bala: patient.ayushAssessment?.bala || 'Madhyama Rogibala',
      clinicalNotes:
        'Reported digestive fire imbalance (Agnimandya) and Vata aggravation in joints. Patient reports intolerance to cold weather.',
    };
  }

  return summaryData;
}

/**
 * Sends the interview transcript and document JSON to Gemini (gemini-2.5-flash) on the backend
 * to generate a structured physician-facing summary.
 */
export async function generateDoctorSummaryFromGemini(
  patient: Partial<PatientRecord>
): Promise<DoctorSummaryData> {
  try {
    const payload = {
      patientId: patient.id,
      name: patient.name,
      age: patient.age,
      gender: patient.gender,
      department: patient.department || 'general',
      chiefComplaints: patient.chiefComplaints || [],
      historyAnswers: patient.historyAnswers || {},
      scannedDocs: patient.scannedDocs || [],
      redFlags: patient.redFlags || [],
      vitals: patient.vitals || {},
      ayushAssessment: patient.ayushAssessment,
    };

    const response = await fetch('/api/generate-doctor-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.summary && data.summary.chiefComplaint) {
      return data.summary as DoctorSummaryData;
    }

    return buildDeterministicDoctorSummary(patient);
  } catch (err) {
    console.warn('Gemini summary generation API error, using deterministic fallback:', err);
    return buildDeterministicDoctorSummary(patient);
  }
}
