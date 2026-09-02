import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Edit3,
  Save,
  Printer,
  Sparkles,
  ArrowLeft,
  Pill,
  Activity,
  Heart,
  UserCheck,
  RotateCw,
  Info,
  ShieldCheck,
  CheckSquare,
  Undo2,
} from 'lucide-react';
import { PatientRecord, DoctorSummaryData } from '../../types';
import { useApp } from '../../context/AppContext';
import { DocumentExtractedCard } from '../../components/DocumentExtractedCard';
import { buildDeterministicDoctorSummary } from '../../utils/summaryService';

interface DoctorSummaryDetailProps {
  patient: PatientRecord;
  onBackToQueue: () => void;
}

export const DoctorSummaryDetail: React.FC<DoctorSummaryDetailProps> = ({
  patient,
  onBackToQueue,
}) => {
  const {
    updatePatientRecord,
    markPatientAsDiagnosed,
    loggedInDoctor,
    isGeneratingSummary,
    regenerateDoctorSummary,
  } = useApp();

  // Initialize summary data from patient record or build deterministic fallback
  const initialSummary: DoctorSummaryData =
    patient.doctorSummary || buildDeterministicDoctorSummary(patient);

  // Local editable fields state for the structured SOAP history sections
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [chiefComplaint, setChiefComplaint] = useState<string>(initialSummary.chiefComplaint);
  const [hpiText, setHpiText] = useState<string>(initialSummary.hpi);
  const [pastHistoryText, setPastHistoryText] = useState<string>(initialSummary.pastMedicalSurgicalHistory);
  const [drugAllergyText, setDrugAllergyText] = useState<string>(initialSummary.drugAndAllergyHistory);
  const [familyHistoryText, setFamilyHistoryText] = useState<string>(initialSummary.familyHistory);
  const [personalHistoryText, setPersonalHistoryText] = useState<string>(initialSummary.personalHistory);
  const [rosText, setRosText] = useState<string>(initialSummary.reviewOfSystems);
  const [warningFlags, setWarningFlags] = useState<string[]>(
    initialSummary.priorityClinicalWarningFlags || patient.redFlags || []
  );
  const [ayushNotes, setAyushNotes] = useState<string>(
    initialSummary.ayushAssessment?.clinicalNotes || ''
  );
  const [physicianNotes, setPhysicianNotes] = useState<string>(
    patient.physicianNotes || ''
  );
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [diagnosedSuccess, setDiagnosedSuccess] = useState<boolean>(patient.status === 'completed');
  const [isMarkingDiagnosed, setIsMarkingDiagnosed] = useState<boolean>(false);
  const [isRxModalOpen, setIsRxModalOpen] = useState<boolean>(false);
  const [modelUsed, setModelUsed] = useState<string>(initialSummary.modelUsed || 'gemini-2.5-flash');

  // Keep state synchronized if patient prop or summary updates
  useEffect(() => {
    const summary = patient.doctorSummary || buildDeterministicDoctorSummary(patient);
    setChiefComplaint(summary.chiefComplaint);
    setHpiText(summary.hpi);
    setPastHistoryText(summary.pastMedicalSurgicalHistory);
    setDrugAllergyText(summary.drugAndAllergyHistory);
    setFamilyHistoryText(summary.familyHistory);
    setPersonalHistoryText(summary.personalHistory);
    setRosText(summary.reviewOfSystems);
    setWarningFlags(summary.priorityClinicalWarningFlags || patient.redFlags || []);
    if (summary.ayushAssessment?.clinicalNotes) {
      setAyushNotes(summary.ayushAssessment.clinicalNotes);
    }
    if (summary.modelUsed) {
      setModelUsed(summary.modelUsed);
    }
    if (patient.physicianNotes) {
      setPhysicianNotes(patient.physicianNotes);
    }
    setDiagnosedSuccess(patient.status === 'completed');
  }, [patient.doctorSummary, patient.id, patient.status, patient.physicianNotes]);

  const isAyush = patient.department === 'ayush';
  const hasRedFlags = warningFlags.length > 0;
  const isCompleted = patient.status === 'completed';

  const handleRegenerate = async () => {
    const freshSummary = await regenerateDoctorSummary(patient.id);
    if (freshSummary) {
      setChiefComplaint(freshSummary.chiefComplaint);
      setHpiText(freshSummary.hpi);
      setPastHistoryText(freshSummary.pastMedicalSurgicalHistory);
      setDrugAllergyText(freshSummary.drugAndAllergyHistory);
      setFamilyHistoryText(freshSummary.familyHistory);
      setPersonalHistoryText(freshSummary.personalHistory);
      setRosText(freshSummary.reviewOfSystems);
      setWarningFlags(freshSummary.priorityClinicalWarningFlags || []);
      if (freshSummary.ayushAssessment?.clinicalNotes) {
        setAyushNotes(freshSummary.ayushAssessment.clinicalNotes);
      }
      if (freshSummary.modelUsed) {
        setModelUsed(freshSummary.modelUsed);
      }
    }
  };

  const getUpdatedSummaryObject = (): DoctorSummaryData => ({
    chiefComplaint,
    hpi: hpiText,
    pastMedicalSurgicalHistory: pastHistoryText,
    drugAndAllergyHistory: drugAllergyText,
    familyHistory: familyHistoryText,
    personalHistory: personalHistoryText,
    reviewOfSystems: rosText,
    priorityClinicalWarningFlags: warningFlags,
    ayushAssessment: isAyush
      ? {
          prakriti: patient.ayushAssessment?.prakriti || 'Vata-Kapha Pradhana',
          agni: patient.ayushAssessment?.agni || 'Mandagni',
          kostha: patient.ayushAssessment?.kostha || 'Krura Kostha',
          bala: patient.ayushAssessment?.bala || 'Madhyama Rogibala',
          clinicalNotes: ayushNotes,
        }
      : undefined,
    generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    modelUsed,
  });

  const handleSaveEMR = () => {
    const updatedSummary = getUpdatedSummaryObject();

    updatePatientRecord(patient.id, {
      chiefComplaints: [chiefComplaint],
      doctorSummary: updatedSummary,
      physicianNotes,
      doctorApproved: true,
      status: patient.status === 'waiting' ? 'in_consultation' : patient.status,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
    setIsEditing(false);
  };

  const handleMarkDiagnosed = async () => {
    setIsMarkingDiagnosed(true);
    const updatedSummary = getUpdatedSummaryObject();
    const outcomeNote = physicianNotes || chiefComplaint || 'Consultation & treatment plan completed';

    await markPatientAsDiagnosed(patient.id, {
      outcome: outcomeNote,
      notes: physicianNotes,
      summary: updatedSummary,
    });

    setIsMarkingDiagnosed(false);
    setDiagnosedSuccess(true);
    setIsEditing(false);
  };

  const handleReopenToQueue = () => {
    updatePatientRecord(patient.id, {
      status: 'waiting',
    });
    setDiagnosedSuccess(false);
  };

  return (
    <div
      id="doctor-summary-detail-screen"
      className="w-full space-y-6 text-left animate-fadeIn"
    >
      {/* Top Bar: Back to Queue + Patient Banner + Actions */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border-2 border-slate-300 shadow-sm space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Back button + Patient Header */}
          <div className="flex items-start sm:items-center gap-4">
            <button
              id="btn-back-to-queue"
              type="button"
              onClick={onBackToQueue}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer text-sm shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-3 py-1 bg-slate-900 text-white font-black text-sm rounded-lg tracking-wider">
                  {patient.tokenNumber}
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
                  {patient.name}
                </h1>
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                  {patient.age} Yrs • {patient.gender.toUpperCase()}
                </span>
                <span
                  className={`text-xs font-extrabold uppercase px-2.5 py-1 rounded-md ${
                    isAyush
                      ? 'bg-emerald-100 text-emerald-900'
                      : 'bg-cyan-100 text-cyan-900'
                  }`}
                >
                  {isAyush ? 'AYUSH & Ayurveda OPD' : 'General Internal Medicine'}
                </span>

                {isCompleted && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase px-3 py-1 rounded-md bg-emerald-800 text-white shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Diagnosed & Treated</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500 font-medium mt-1 flex-wrap">
                <span>Phone: {patient.phone}</span>
                {patient.abhaId && <span>ABHA: {patient.abhaId}</span>}
                <span>Kiosk Mode: {patient.inputMode.toUpperCase()} ({patient.language.toUpperCase()})</span>
                <span>Intake: {patient.timestamp}</span>
                {patient.consultationTime && (
                  <span className="font-bold text-emerald-800">
                    • Consulted at {patient.consultationTime}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            <button
              id="btn-regenerate-ai-summary"
              type="button"
              disabled={isGeneratingSummary}
              onClick={handleRegenerate}
              className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60"
              title="Re-query Gemini with interview transcript & extracted document JSON"
            >
              <RotateCw className={`w-4 h-4 text-indigo-700 ${isGeneratingSummary ? 'animate-spin' : ''}`} />
              <span>{isGeneratingSummary ? 'Generating AI Summary...' : 'Regenerate Summary'}</span>
            </button>

            <button
              id="btn-toggle-inline-edit"
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className={`px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 border cursor-pointer transition-colors ${
                isEditing
                  ? 'bg-amber-100 text-amber-900 border-amber-400'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              <Edit3 className="w-4 h-4" />
              <span>{isEditing ? 'Editing Active' : 'Edit Summary'}</span>
            </button>

            <button
              id="btn-print-opd-rx"
              type="button"
              onClick={() => setIsRxModalOpen(true)}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-700" />
              <span>Print Rx Slip</span>
            </button>

            {/* Accept & Save to EMR Button */}
            <button
              id="btn-accept-save-emr"
              type="button"
              onClick={handleSaveEMR}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Accept & Save to EMR</span>
            </button>

            {/* Mark as Diagnosed / Treated Action Button */}
            {isCompleted ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-status-completed-indicator"
                  className="px-4 py-2.5 bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-xs flex items-center gap-2 cursor-default"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Diagnosed & Treated</span>
                </button>
                <button
                  type="button"
                  id="btn-reopen-to-queue"
                  onClick={handleReopenToQueue}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 flex items-center gap-1 cursor-pointer"
                  title="Move back to Active Queue"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Reopen</span>
                </button>
              </div>
            ) : (
              <button
                id="btn-mark-diagnosed-treated"
                type="button"
                onClick={handleMarkDiagnosed}
                disabled={isMarkingDiagnosed}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-transform active:scale-95 disabled:opacity-75"
              >
                <CheckSquare className="w-4 h-4" />
                <span>{isMarkingDiagnosed ? 'Marking Complete...' : 'Mark as Diagnosed / Treated'}</span>
              </button>
            )}
          </div>
        </div>

        {/* AI Generation Source & Safety Badge */}
        <div className="p-3 bg-gradient-to-r from-cyan-50 to-indigo-50 border border-cyan-200/80 rounded-xl flex items-center justify-between gap-3 text-xs text-slate-700 font-semibold flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              <strong>Gemini-Powered Physician Summary</strong> ({modelUsed}): Strictly factual intake report synthesized from patient interview & uploaded records.
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium bg-white/80 px-2.5 py-1 rounded-md border border-slate-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Clinical Rule: Zero Speculative Diagnoses</span>
          </div>
        </div>

        {/* Feedback Banners */}
        {savedSuccess && (
          <div className="p-3 bg-blue-50 border border-blue-300 rounded-xl flex items-center gap-2 text-xs sm:text-sm font-bold text-blue-900 animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-blue-700 shrink-0" />
            <span>Clinical history verified & committed to Hospital Electronic Medical Record (EMR).</span>
          </div>
        )}

        {diagnosedSuccess && (
          <div className="p-3.5 bg-emerald-50 border-2 border-emerald-400 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm font-bold text-emerald-950 animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>
                Patient consultation is marked as <strong>Diagnosed & Treated</strong> and moved to <strong>Today's Patients</strong> archive.
              </span>
            </div>
            <button
              type="button"
              onClick={onBackToQueue}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-black self-start sm:self-auto cursor-pointer"
            >
              Return to Queue
            </button>
          </div>
        )}

        {/* Priority Clinical Warning Flags Banner */}
        {hasRedFlags && (
          <div className="p-4 bg-red-50 border-2 border-red-400 rounded-xl flex items-start gap-3 text-red-950">
            <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-black text-sm uppercase tracking-wider text-red-700 block">
                PRIORITY CLINICAL WARNING FLAGS (MATCHED RULE SET):
              </span>
              <p className="text-xs text-red-900 font-medium">
                The following urgent symptom combination was matched by the clinical intake safety engine during interview:
              </p>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {warningFlags.map((rf, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 bg-red-600 text-white text-xs font-black rounded-md shadow-xs"
                  >
                    {rf}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Split Layout: Structured SOAP History on Left, Document Timeline on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Structured History (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl p-6 border-2 border-slate-300 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                <Stethoscope className="w-5 h-5 text-cyan-800" />
                <span>Physician-Facing Intake Summary (SOAP Format)</span>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {isEditing ? 'Click any field to edit directly' : 'Inline fields locked (click Edit Summary to modify)'}
              </span>
            </div>

            {/* 1. Chief Complaint */}
            <div className="p-4 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200">
              <label className="text-xs font-black uppercase tracking-wider text-slate-600 block">
                1. Chief Complaint (Pradhana Lakshana)
              </label>
              {isEditing ? (
                <input
                  id="edit-field-chief-complaint"
                  type="text"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-cyan-600 rounded-lg text-sm font-bold text-slate-900"
                />
              ) : (
                <p className="text-base font-extrabold text-slate-950">{chiefComplaint}</p>
              )}
            </div>

            {/* 2. History of Present Illness (HPI) */}
            <div className="p-4 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200">
              <label className="text-xs font-black uppercase tracking-wider text-slate-600 block">
                2. History of Present Illness (HPI / Rogotpatthi)
              </label>
              {isEditing ? (
                <textarea
                  id="edit-field-hpi"
                  rows={3}
                  value={hpiText}
                  onChange={(e) => setHpiText(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-cyan-600 rounded-lg text-sm font-medium text-slate-900"
                />
              ) : (
                <p className="text-sm font-medium text-slate-800 leading-relaxed">{hpiText}</p>
              )}
            </div>

            {/* AYUSH Specific Assessment if AYUSH department */}
            {isAyush && (
              <div className="p-4 bg-emerald-50/70 border-2 border-emerald-300 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-900">
                  <Sparkles className="w-4 h-4 text-emerald-700" />
                  <span>Ayurvedic Assessment (Dashavidha Pariksha & Agni)</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-200">
                    <span className="text-slate-500 font-bold block">Prakriti:</span>
                    <span className="font-extrabold text-emerald-950">
                      {patient.ayushAssessment?.prakriti || 'Vata-Kapha Pradhana'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-200">
                    <span className="text-slate-500 font-bold block">Jatharagni:</span>
                    <span className="font-extrabold text-emerald-950">
                      {patient.ayushAssessment?.agni || 'Mandagni (Sluggish Digestion)'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-200">
                    <span className="text-slate-500 font-bold block">Kostha:</span>
                    <span className="font-extrabold text-emerald-950">
                      {patient.ayushAssessment?.kostha || 'Krura Kostha (Hard Bowels)'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-200">
                    <span className="text-slate-500 font-bold block">Rogibala:</span>
                    <span className="font-extrabold text-emerald-950">
                      {patient.ayushAssessment?.bala || 'Madhyama Rogibala'}
                    </span>
                  </div>
                </div>
                {isEditing ? (
                  <textarea
                    rows={2}
                    value={ayushNotes}
                    onChange={(e) => setAyushNotes(e.target.value)}
                    placeholder="Ayurvedic clinical observations & Samprapti notes..."
                    className="w-full p-2.5 bg-white border border-emerald-300 rounded-lg text-xs font-medium text-slate-900"
                  />
                ) : ayushNotes ? (
                  <p className="text-xs text-emerald-950 bg-white/70 p-2.5 rounded-lg border border-emerald-200 font-medium">
                    {ayushNotes}
                  </p>
                ) : null}
              </div>
            )}

            {/* 3. Past Medical & Surgical History */}
            <div className="p-4 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200">
              <label className="text-xs font-black uppercase tracking-wider text-slate-600 block">
                3. Past Medical & Surgical History (Purva Vyadhi)
              </label>
              {isEditing ? (
                <textarea
                  id="edit-field-past-history"
                  rows={2}
                  value={pastHistoryText}
                  onChange={(e) => setPastHistoryText(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-cyan-600 rounded-lg text-sm font-medium text-slate-900"
                />
              ) : (
                <p className="text-sm font-medium text-slate-800 leading-relaxed">{pastHistoryText}</p>
              )}
            </div>

            {/* 4. Drug & Allergies */}
            <div className="p-4 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200">
              <label className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Pill className="w-4 h-4 text-rose-600" />
                <span>4. Drug Allergies & Current Medications (Oushadha)</span>
              </label>
              {isEditing ? (
                <textarea
                  id="edit-field-drug-allergy"
                  rows={2}
                  value={drugAllergyText}
                  onChange={(e) => setDrugAllergyText(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-cyan-600 rounded-lg text-sm font-medium text-slate-900"
                />
              ) : (
                <p className="text-sm font-semibold text-rose-900 leading-relaxed bg-rose-50/60 p-2.5 rounded-lg border border-rose-200">
                  {drugAllergyText}
                </p>
              )}
            </div>

            {/* 5. Family History */}
            <div className="p-4 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200">
              <label className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-indigo-600" />
                <span>5. Family History (Kula Vrittanta)</span>
              </label>
              {isEditing ? (
                <textarea
                  id="edit-field-family-history"
                  rows={2}
                  value={familyHistoryText}
                  onChange={(e) => setFamilyHistoryText(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-cyan-600 rounded-lg text-sm font-medium text-slate-900"
                />
              ) : (
                <p className="text-sm font-medium text-slate-800 leading-relaxed">{familyHistoryText}</p>
              )}
            </div>

            {/* 6. Personal History */}
            <div className="p-4 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200">
              <label className="text-xs font-black uppercase tracking-wider text-slate-600 block">
                6. Personal & Lifestyle History (Swabhava & Ahar-Vihar)
              </label>
              {isEditing ? (
                <textarea
                  id="edit-field-personal-history"
                  rows={2}
                  value={personalHistoryText}
                  onChange={(e) => setPersonalHistoryText(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-cyan-600 rounded-lg text-sm font-medium text-slate-900"
                />
              ) : (
                <p className="text-sm font-medium text-slate-800 leading-relaxed">{personalHistoryText}</p>
              )}
            </div>

            {/* 7. Review of Systems (ROS) */}
            <div className="p-4 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200">
              <label className="text-xs font-black uppercase tracking-wider text-slate-600 block">
                7. Review of Systems (ROS / Sarva Anga Pariksha)
              </label>
              {isEditing ? (
                <textarea
                  id="edit-field-ros"
                  rows={2}
                  value={rosText}
                  onChange={(e) => setRosText(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-cyan-600 rounded-lg text-sm font-medium text-slate-900"
                />
              ) : (
                <p className="text-sm font-medium text-slate-800 leading-relaxed">{rosText}</p>
              )}
            </div>

            {/* Physician Consultation Clinical Notes */}
            <div className="p-4 bg-cyan-50/60 rounded-xl space-y-2 border-2 border-cyan-300">
              <label className="text-xs font-black uppercase tracking-wider text-cyan-950 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-cyan-800" />
                <span>Physician Consultation Notes & Treatment Plan:</span>
              </label>
              <textarea
                id="input-physician-treatment-notes"
                rows={3}
                value={physicianNotes}
                onChange={(e) => setPhysicianNotes(e.target.value)}
                placeholder="Type examination findings, Rx prescription, or diagnostic orders here..."
                className="w-full p-3 bg-white rounded-lg border-2 border-cyan-400 text-sm font-medium text-slate-900 focus:ring-4 focus:ring-cyan-100"
              />

              <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                <span className="text-[11px] text-slate-500 font-medium">
                  {isCompleted ? '✓ Consultation marked complete and archived in Today’s Patients' : 'Consultation in progress'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveEMR}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Notes</span>
                  </button>
                  {!isCompleted && (
                    <button
                      type="button"
                      onClick={handleMarkDiagnosed}
                      disabled={isMarkingDiagnosed}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-75"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>{isMarkingDiagnosed ? 'Completing...' : 'Mark as Diagnosed / Treated'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Vitals + Digitized Document Timeline (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Vitals Summary Card */}
          <div className="bg-white rounded-2xl p-5 border-2 border-slate-300 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <Activity className="w-5 h-5 text-rose-600" />
              <span>Triage Recorded Vitals</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-bold block">Blood Pressure</span>
                <span className="text-base font-black text-slate-900">
                  {patient.vitals?.bp || '124/80 mmHg'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-bold block">Pulse Rate</span>
                <span className="text-base font-black text-slate-900">
                  {patient.vitals?.pulse || '76 bpm'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-bold block">Temperature</span>
                <span className="text-base font-black text-slate-900">
                  {patient.vitals?.temp || '98.4 °F'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-bold block">SpO2 Oxygen</span>
                <span className="text-base font-black text-emerald-700">
                  {patient.vitals?.spo2 || '98%'}
                </span>
              </div>
            </div>
          </div>

          {/* Document Timeline Alongside */}
          <div className="bg-white rounded-2xl p-5 border-2 border-slate-300 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                <FileText className="w-5 h-5 text-cyan-800" />
                <span>Digitized Document Timeline ({patient.scannedDocs?.length || 0})</span>
              </div>
            </div>

            {patient.scannedDocs && patient.scannedDocs.length > 0 ? (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                {patient.scannedDocs.map((doc) => (
                  <DocumentExtractedCard
                    key={doc.id}
                    document={doc}
                    showRemove={false}
                  />
                ))}
              </div>
            ) : (
              <div className="p-8 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl text-center space-y-2">
                <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-600 font-medium">
                  No prior medical documents uploaded during kiosk intake.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rx Prescription Modal Dialog */}
      {isRxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xl rounded-2xl p-6 border-2 border-slate-400 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Printer className="w-5 h-5 text-cyan-800" />
                <span>Print Official OPD Prescription Slip</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsRxModalOpen(false)}
                className="text-slate-500 hover:text-slate-800 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl space-y-2 text-xs text-slate-800 font-medium">
              <p><strong>Hospital:</strong> All India Institute of Medical Sciences / OPD Wing</p>
              <p><strong>Consultant:</strong> {loggedInDoctor?.name || 'Dr. Rajesh Sharma, MD'}</p>
              <p><strong>Patient:</strong> {patient.name} ({patient.age}Y/{patient.gender}) • Token: {patient.tokenNumber}</p>
              <p><strong>Chief Complaint:</strong> {chiefComplaint}</p>
              <p><strong>HPI Summary:</strong> {hpiText}</p>
              <p><strong>Rx Notes:</strong> {physicianNotes || 'Standard symptomatic therapy advised.'}</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRxModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                  setIsRxModalOpen(false);
                }}
                className="px-5 py-2 bg-cyan-800 hover:bg-cyan-900 text-white font-bold rounded-lg text-xs flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Send to OPD Printer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
