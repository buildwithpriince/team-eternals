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
  FileSpreadsheet,
} from 'lucide-react';
import { PatientRecord, DoctorSummaryData } from '../../types';
import { useApp } from '../../context/AppContext';
import { DocumentExtractedCard } from '../../components/DocumentExtractedCard';
import { PrintableClinicalSummary } from '../../components/PrintableClinicalSummary';
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
    doctorDarkMode,
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
  const [isPrintSummaryOpen, setIsPrintSummaryOpen] = useState<boolean>(false);
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
      <div
        className={`rounded-2xl p-5 sm:p-6 border-2 shadow-sm space-y-4 transition-colors ${
          doctorDarkMode
            ? 'bg-slate-900 border-slate-700 text-white'
            : 'bg-white border-slate-300 text-slate-900'
        }`}
      >
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Back button + Patient Header */}
          <div className="flex items-start sm:items-center gap-4">
            <button
              id="btn-back-to-queue"
              type="button"
              onClick={onBackToQueue}
              className={`p-2.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer text-sm shrink-0 transition-colors ${
                doctorDarkMode
                  ? 'bg-slate-800 hover:bg-slate-750 text-white border border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span
                  className={`px-3 py-1 font-black text-sm rounded-lg tracking-wider ${
                    doctorDarkMode
                      ? 'bg-slate-800 text-cyan-300 border border-slate-700'
                      : 'bg-slate-900 text-white'
                  }`}
                >
                  {patient.tokenNumber}
                </span>
                <h1
                  className={`text-2xl sm:text-3xl font-black ${
                    doctorDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {patient.name}
                </h1>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                    doctorDarkMode
                      ? 'bg-slate-800 text-slate-300'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {patient.age} Yrs • {patient.gender.toUpperCase()}
                </span>
                <span
                  className={`text-xs font-extrabold uppercase px-2.5 py-1 rounded-md ${
                    isAyush
                      ? doctorDarkMode
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-emerald-100 text-emerald-900'
                      : doctorDarkMode
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                      : 'bg-cyan-100 text-cyan-900'
                  }`}
                >
                  {isAyush ? 'AYUSH & Ayurveda OPD' : 'General Internal Medicine'}
                </span>

                {isCompleted && (
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-black uppercase px-3 py-1 rounded-md shadow-xs ${
                      doctorDarkMode
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-800 text-white'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Diagnosed & Treated</span>
                  </span>
                )}
              </div>

              <div
                className={`flex items-center gap-4 text-xs font-medium mt-1 flex-wrap ${
                  doctorDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                <span>Phone: {patient.phone}</span>
                {patient.abhaId && <span>ABHA: {patient.abhaId}</span>}
                <span>Kiosk Mode: {patient.inputMode.toUpperCase()} ({patient.language.toUpperCase()})</span>
                <span>Intake: {patient.timestamp}</span>
                {patient.consultationTime && (
                  <span className={doctorDarkMode ? 'font-bold text-emerald-400' : 'font-bold text-emerald-800'}>
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
              className={`px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60 border ${
                doctorDarkMode
                  ? 'bg-indigo-950/80 hover:bg-indigo-900/90 text-indigo-200 border-indigo-700'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
              }`}
              title="Re-query Gemini with interview transcript & extracted document JSON"
            >
              <RotateCw className={`w-4 h-4 ${doctorDarkMode ? 'text-indigo-400' : 'text-indigo-700'} ${isGeneratingSummary ? 'animate-spin' : ''}`} />
              <span>{isGeneratingSummary ? 'Generating AI Summary...' : 'Regenerate Summary'}</span>
            </button>

            <button
              id="btn-toggle-inline-edit"
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className={`px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 border cursor-pointer transition-colors ${
                isEditing
                  ? doctorDarkMode
                    ? 'bg-amber-950 text-amber-200 border-amber-500'
                    : 'bg-amber-100 text-amber-900 border-amber-400'
                  : doctorDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              <Edit3 className="w-4 h-4" />
              <span>{isEditing ? 'Editing Active' : 'Edit Summary'}</span>
            </button>

            <button
              id="btn-print-summary-pdf"
              type="button"
              onClick={() => setIsPrintSummaryOpen(true)}
              className={`px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer border transition-colors shadow-xs ${
                doctorDarkMode
                  ? 'bg-cyan-950/90 hover:bg-cyan-900 text-cyan-200 border-cyan-700'
                  : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border-cyan-300'
              }`}
              title="Generate a print-ready 1-page clinical intake summary & PDF export"
            >
              <Printer className={`w-4 h-4 ${doctorDarkMode ? 'text-cyan-400' : 'text-cyan-700'}`} />
              <span>Print / PDF Summary</span>
            </button>

            <button
              id="btn-print-opd-rx"
              type="button"
              onClick={() => setIsRxModalOpen(true)}
              className={`px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer border ${
                doctorDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
              }`}
            >
              <FileSpreadsheet className={`w-4 h-4 ${doctorDarkMode ? 'text-slate-400' : 'text-slate-700'}`} />
              <span>Print Rx Slip</span>
            </button>

            {/* Accept & Save to EMR Button */}
            <button
              id="btn-accept-save-emr"
              type="button"
              onClick={handleSaveEMR}
              className={`px-4 py-2.5 font-bold text-xs sm:text-sm rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-transform active:scale-95 ${
                doctorDarkMode
                  ? 'bg-cyan-700 hover:bg-cyan-600 text-white ring-1 ring-cyan-400'
                  : 'bg-slate-800 hover:bg-slate-900 text-white'
              }`}
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
                  className={`px-3 py-2 font-bold text-xs rounded-xl border flex items-center gap-1 cursor-pointer ${
                    doctorDarkMode
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-750'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
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
        <div
          className={`p-3 border rounded-xl flex items-center justify-between gap-3 text-xs font-semibold flex-wrap ${
            doctorDarkMode
              ? 'bg-slate-950/80 border-slate-800 text-slate-300'
              : 'bg-gradient-to-r from-cyan-50 to-indigo-50 border-cyan-200/80 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className={`w-4 h-4 ${doctorDarkMode ? 'text-cyan-400' : 'text-indigo-600'} shrink-0`} />
            <span>
              <strong>Gemini-Powered Physician Summary</strong> ({modelUsed}): Strictly factual intake report synthesized from patient interview & uploaded records.
            </span>
          </div>
          <div
            className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md border ${
              doctorDarkMode
                ? 'bg-slate-900 border-slate-750 text-slate-300'
                : 'bg-white/80 border-slate-200 text-slate-500'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Clinical Rule: Zero Speculative Diagnoses</span>
          </div>
        </div>

        {/* Feedback Banners */}
        {savedSuccess && (
          <div
            className={`p-3 border rounded-xl flex items-center gap-2 text-xs sm:text-sm font-bold animate-fadeIn ${
              doctorDarkMode
                ? 'bg-blue-950/80 border-blue-700 text-blue-200'
                : 'bg-blue-50 border-blue-300 text-blue-900'
            }`}
          >
            <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0" />
            <span>Clinical history verified & committed to Hospital Electronic Medical Record (EMR).</span>
          </div>
        )}

        {diagnosedSuccess && (
          <div
            className={`p-3.5 border-2 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm font-bold animate-fadeIn ${
              doctorDarkMode
                ? 'bg-emerald-950/80 border-emerald-600 text-emerald-200'
                : 'bg-emerald-50 border-emerald-400 text-emerald-950'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>
                Patient consultation is marked as <strong>Diagnosed & Treated</strong> and moved to <strong>Today's Patients</strong> archive.
              </span>
            </div>
            <button
              type="button"
              onClick={onBackToQueue}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-black self-start sm:self-auto cursor-pointer"
            >
              Return to Queue
            </button>
          </div>
        )}

        {/* Priority Clinical Warning Flags Banner */}
        {hasRedFlags && (
          <div
            className={`p-4 border-2 rounded-xl flex items-start gap-3 ${
              doctorDarkMode
                ? 'bg-[#2A0E14] border-red-500 text-red-200'
                : 'bg-red-50 border-red-400 text-red-950'
            }`}
          >
            <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span
                className={`font-black text-sm uppercase tracking-wider block ${
                  doctorDarkMode ? 'text-red-400' : 'text-red-700'
                }`}
              >
                PRIORITY CLINICAL WARNING FLAGS (MATCHED RULE SET):
              </span>
              <p className={`text-xs font-medium ${doctorDarkMode ? 'text-red-300' : 'text-red-900'}`}>
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
          <div
            className={`rounded-2xl p-6 border-2 shadow-sm space-y-5 transition-colors ${
              doctorDarkMode
                ? 'bg-slate-900 border-slate-700 text-white'
                : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            <div
              className={`flex items-center justify-between pb-3 border-b ${
                doctorDarkMode ? 'border-slate-800' : 'border-slate-200'
              }`}
            >
              <div
                className={`flex items-center gap-2 text-base font-extrabold ${
                  doctorDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                <Stethoscope className={`w-5 h-5 ${doctorDarkMode ? 'text-cyan-400' : 'text-cyan-800'}`} />
                <span>Physician-Facing Intake Summary (SOAP Format)</span>
              </div>
              <span className={`text-xs font-medium ${doctorDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {isEditing ? 'Click any field to edit directly' : 'Inline fields locked (click Edit Summary to modify)'}
              </span>
            </div>

            {/* 1. Chief Complaint */}
            <div
              className={`p-4 rounded-xl space-y-1.5 border transition-colors ${
                doctorDarkMode
                  ? 'bg-slate-850 border-slate-750'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <label
                className={`text-xs font-black uppercase tracking-wider block ${
                  doctorDarkMode ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                1. Chief Complaint (Pradhana Lakshana)
              </label>
              {isEditing ? (
                <input
                  id="edit-field-chief-complaint"
                  type="text"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  className={`w-full p-2.5 border-2 rounded-lg text-sm font-bold ${
                    doctorDarkMode
                      ? 'bg-slate-900 border-cyan-500 text-white'
                      : 'bg-white border-cyan-600 text-slate-900'
                  }`}
                />
              ) : (
                <p className={`text-base font-extrabold ${doctorDarkMode ? 'text-white' : 'text-slate-950'}`}>
                  {chiefComplaint}
                </p>
              )}
            </div>

            {/* 2. History of Present Illness (HPI) */}
            <div
              className={`p-4 rounded-xl space-y-1.5 border transition-colors ${
                doctorDarkMode
                  ? 'bg-slate-850 border-slate-750'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <label
                className={`text-xs font-black uppercase tracking-wider block ${
                  doctorDarkMode ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                2. History of Present Illness (HPI / Rogotpatthi)
              </label>
              {isEditing ? (
                <textarea
                  id="edit-field-hpi"
                  rows={3}
                  value={hpiText}
                  onChange={(e) => setHpiText(e.target.value)}
                  className={`w-full p-2.5 border-2 rounded-lg text-sm font-medium ${
                    doctorDarkMode
                      ? 'bg-slate-900 border-cyan-500 text-white'
                      : 'bg-white border-cyan-600 text-slate-900'
                  }`}
                />
              ) : (
                <p className={`text-sm font-medium leading-relaxed ${doctorDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                  {hpiText}
                </p>
              )}
            </div>

            {/* AYUSH Specific Assessment if AYUSH department */}
            {isAyush && (
              <div
                className={`p-4 border-2 rounded-xl space-y-3 transition-colors ${
                  doctorDarkMode
                    ? 'bg-[#062018] border-emerald-800 text-emerald-200'
                    : 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                }`}
              >
                <div
                  className={`flex items-center gap-2 text-xs font-black uppercase tracking-wider ${
                    doctorDarkMode ? 'text-emerald-300' : 'text-emerald-900'
                  }`}
                >
                  <Sparkles className={`w-4 h-4 ${doctorDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`} />
                  <span>Ayurvedic Assessment (Dashavidha Pariksha & Agni)</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div
                    className={`p-2.5 rounded-lg border ${
                      doctorDarkMode
                        ? 'bg-slate-900 border-emerald-800'
                        : 'bg-white border-emerald-200'
                    }`}
                  >
                    <span className={doctorDarkMode ? 'text-slate-400 font-bold block' : 'text-slate-500 font-bold block'}>
                      Prakriti:
                    </span>
                    <span className={`font-extrabold ${doctorDarkMode ? 'text-emerald-300' : 'text-emerald-950'}`}>
                      {patient.ayushAssessment?.prakriti || 'Vata-Kapha Pradhana'}
                    </span>
                  </div>
                  <div
                    className={`p-2.5 rounded-lg border ${
                      doctorDarkMode
                        ? 'bg-slate-900 border-emerald-800'
                        : 'bg-white border-emerald-200'
                    }`}
                  >
                    <span className={doctorDarkMode ? 'text-slate-400 font-bold block' : 'text-slate-500 font-bold block'}>
                      Jatharagni:
                    </span>
                    <span className={`font-extrabold ${doctorDarkMode ? 'text-emerald-300' : 'text-emerald-950'}`}>
                      {patient.ayushAssessment?.agni || 'Mandagni (Sluggish Digestion)'}
                    </span>
                  </div>
                  <div
                    className={`p-2.5 rounded-lg border ${
                      doctorDarkMode
                        ? 'bg-slate-900 border-emerald-800'
                        : 'bg-white border-emerald-200'
                    }`}
                  >
                    <span className={doctorDarkMode ? 'text-slate-400 font-bold block' : 'text-slate-500 font-bold block'}>
                      Kostha:
                    </span>
                    <span className={`font-extrabold ${doctorDarkMode ? 'text-emerald-300' : 'text-emerald-950'}`}>
                      {patient.ayushAssessment?.kostha || 'Krura Kostha (Hard Bowels)'}
                    </span>
                  </div>
                  <div
                    className={`p-2.5 rounded-lg border ${
                      doctorDarkMode
                        ? 'bg-slate-900 border-emerald-800'
                        : 'bg-white border-emerald-200'
                    }`}
                  >
                    <span className={doctorDarkMode ? 'text-slate-400 font-bold block' : 'text-slate-500 font-bold block'}>
                      Rogibala:
                    </span>
                    <span className={`font-extrabold ${doctorDarkMode ? 'text-emerald-300' : 'text-emerald-950'}`}>
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
                    className={`w-full p-2.5 border rounded-lg text-xs font-medium ${
                      doctorDarkMode
                        ? 'bg-slate-900 border-emerald-600 text-white'
                        : 'bg-white border-emerald-300 text-slate-900'
                    }`}
                  />
                ) : ayushNotes ? (
                  <p
                    className={`text-xs p-2.5 rounded-lg border font-medium ${
                      doctorDarkMode
                        ? 'text-emerald-200 bg-slate-900/90 border-emerald-800'
                        : 'text-emerald-950 bg-white/70 border-emerald-200'
                    }`}
                  >
                    {ayushNotes}
                  </p>
                ) : null}
              </div>
            )}

            {/* 3. Past Medical & Surgical History */}
            <div
              className={`p-4 rounded-xl space-y-1.5 border transition-colors ${
                doctorDarkMode
                  ? 'bg-slate-850 border-slate-750'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <label
                className={`text-xs font-black uppercase tracking-wider block ${
                  doctorDarkMode ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                3. Past Medical & Surgical History (Purva Vyadhi)
              </label>
              {isEditing ? (
                <textarea
                  id="edit-field-past-history"
                  rows={2}
                  value={pastHistoryText}
                  onChange={(e) => setPastHistoryText(e.target.value)}
                  className={`w-full p-2.5 border-2 rounded-lg text-sm font-medium ${
                    doctorDarkMode
                      ? 'bg-slate-900 border-cyan-500 text-white'
                      : 'bg-white border-cyan-600 text-slate-900'
                  }`}
                />
              ) : (
                <p className={`text-sm font-medium leading-relaxed ${doctorDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                  {pastHistoryText}
                </p>
              )}
            </div>

            {/* 4. Drug & Allergies */}
            <div
              className={`p-4 rounded-xl space-y-1.5 border transition-colors ${
                doctorDarkMode
                  ? 'bg-slate-850 border-slate-750'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <label
                className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                  doctorDarkMode ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                <Pill className="w-4 h-4 text-rose-500" />
                <span>4. Drug Allergies & Current Medications (Oushadha)</span>
              </label>
              {isEditing ? (
                <textarea
                  id="edit-field-drug-allergy"
                  rows={2}
                  value={drugAllergyText}
                  onChange={(e) => setDrugAllergyText(e.target.value)}
                  className={`w-full p-2.5 border-2 rounded-lg text-sm font-medium ${
                    doctorDarkMode
                      ? 'bg-slate-900 border-rose-500 text-white'
                      : 'bg-white border-cyan-600 text-slate-900'
                  }`}
                />
              ) : (
                <p
                  className={`text-sm font-semibold leading-relaxed p-2.5 rounded-lg border ${
                    doctorDarkMode
                      ? 'bg-rose-950/60 text-rose-200 border-rose-800'
                      : 'bg-rose-50/60 text-rose-900 border-rose-200'
                  }`}
                >
                  {drugAllergyText}
                </p>
              )}
            </div>

            {/* 5. Family History */}
            <div
              className={`p-4 rounded-xl space-y-1.5 border transition-colors ${
                doctorDarkMode
                  ? 'bg-slate-850 border-slate-750'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <label
                className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                  doctorDarkMode ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                <Heart className="w-4 h-4 text-indigo-400" />
                <span>5. Family History (Kula Vrittanta)</span>
              </label>
              {isEditing ? (
                <textarea
                  id="edit-field-family-history"
                  rows={2}
                  value={familyHistoryText}
                  onChange={(e) => setFamilyHistoryText(e.target.value)}
                  className={`w-full p-2.5 border-2 rounded-lg text-sm font-medium ${
                    doctorDarkMode
                      ? 'bg-slate-900 border-cyan-500 text-white'
                      : 'bg-white border-cyan-600 text-slate-900'
                  }`}
                />
              ) : (
                <p className={`text-sm font-medium leading-relaxed ${doctorDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                  {familyHistoryText}
                </p>
              )}
            </div>

            {/* 6. Personal History */}
            <div
              className={`p-4 rounded-xl space-y-1.5 border transition-colors ${
                doctorDarkMode
                  ? 'bg-slate-850 border-slate-750'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <label
                className={`text-xs font-black uppercase tracking-wider block ${
                  doctorDarkMode ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                6. Personal & Lifestyle History (Swabhava & Ahar-Vihar)
              </label>
              {isEditing ? (
                <textarea
                  id="edit-field-personal-history"
                  rows={2}
                  value={personalHistoryText}
                  onChange={(e) => setPersonalHistoryText(e.target.value)}
                  className={`w-full p-2.5 border-2 rounded-lg text-sm font-medium ${
                    doctorDarkMode
                      ? 'bg-slate-900 border-cyan-500 text-white'
                      : 'bg-white border-cyan-600 text-slate-900'
                  }`}
                />
              ) : (
                <p className={`text-sm font-medium leading-relaxed ${doctorDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                  {personalHistoryText}
                </p>
              )}
            </div>

            {/* 7. Review of Systems (ROS) */}
            <div
              className={`p-4 rounded-xl space-y-1.5 border transition-colors ${
                doctorDarkMode
                  ? 'bg-slate-850 border-slate-750'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <label
                className={`text-xs font-black uppercase tracking-wider block ${
                  doctorDarkMode ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                7. Review of Systems (ROS / Sarva Anga Pariksha)
              </label>
              {isEditing ? (
                <textarea
                  id="edit-field-ros"
                  rows={2}
                  value={rosText}
                  onChange={(e) => setRosText(e.target.value)}
                  className={`w-full p-2.5 border-2 rounded-lg text-sm font-medium ${
                    doctorDarkMode
                      ? 'bg-slate-900 border-cyan-500 text-white'
                      : 'bg-white border-cyan-600 text-slate-900'
                  }`}
                />
              ) : (
                <p className={`text-sm font-medium leading-relaxed ${doctorDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                  {rosText}
                </p>
              )}
            </div>

            {/* Physician Consultation Clinical Notes */}
            <div
              className={`p-4 rounded-xl space-y-2 border-2 transition-colors ${
                doctorDarkMode
                  ? 'bg-[#0B2533] border-cyan-700'
                  : 'bg-cyan-50/60 border-cyan-300'
              }`}
            >
              <label
                className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                  doctorDarkMode ? 'text-cyan-300' : 'text-cyan-950'
                }`}
              >
                <UserCheck className={`w-4 h-4 ${doctorDarkMode ? 'text-cyan-400' : 'text-cyan-800'}`} />
                <span>Physician Consultation Notes & Treatment Plan:</span>
              </label>
              <textarea
                id="input-physician-treatment-notes"
                rows={3}
                value={physicianNotes}
                onChange={(e) => setPhysicianNotes(e.target.value)}
                placeholder="Type examination findings, Rx prescription, or diagnostic orders here..."
                className={`w-full p-3 rounded-lg border-2 text-sm font-medium ${
                  doctorDarkMode
                    ? 'bg-slate-900 border-cyan-500 text-white placeholder-slate-500 focus:ring-4 focus:ring-cyan-900/50'
                    : 'bg-white border-cyan-400 text-slate-900 focus:ring-4 focus:ring-cyan-100'
                }`}
              />

              <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                <span className={`text-[11px] font-medium ${doctorDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {isCompleted ? '✓ Consultation marked complete and archived in Today’s Patients' : 'Consultation in progress'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveEMR}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                      doctorDarkMode
                        ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-650'
                        : 'bg-slate-800 hover:bg-slate-900 text-white'
                    }`}
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
          <div
            className={`rounded-2xl p-5 border-2 shadow-sm space-y-3 transition-colors ${
              doctorDarkMode
                ? 'bg-slate-900 border-slate-700 text-white'
                : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            <div
              className={`flex items-center gap-2 text-sm font-extrabold ${
                doctorDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              <Activity className="w-5 h-5 text-rose-500" />
              <span>Triage Recorded Vitals</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2 text-xs">
              <div
                className={`p-3 rounded-xl border ${
                  doctorDarkMode
                    ? 'bg-slate-850 border-slate-750'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span className={doctorDarkMode ? 'text-slate-400 font-bold block' : 'text-slate-500 font-bold block'}>
                  Blood Pressure
                </span>
                <span className={`text-base font-black ${doctorDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {patient.vitals?.bp || '124/80 mmHg'}
                </span>
              </div>
              <div
                className={`p-3 rounded-xl border ${
                  doctorDarkMode
                    ? 'bg-slate-850 border-slate-750'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span className={doctorDarkMode ? 'text-slate-400 font-bold block' : 'text-slate-500 font-bold block'}>
                  Pulse Rate
                </span>
                <span className={`text-base font-black ${doctorDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {patient.vitals?.pulse || '76 bpm'}
                </span>
              </div>
              <div
                className={`p-3 rounded-xl border ${
                  doctorDarkMode
                    ? 'bg-slate-850 border-slate-750'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span className={doctorDarkMode ? 'text-slate-400 font-bold block' : 'text-slate-500 font-bold block'}>
                  Temperature
                </span>
                <span className={`text-base font-black ${doctorDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {patient.vitals?.temp || '98.4 °F'}
                </span>
              </div>
              <div
                className={`p-3 rounded-xl border ${
                  doctorDarkMode
                    ? 'bg-slate-850 border-slate-750'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span className={doctorDarkMode ? 'text-slate-400 font-bold block' : 'text-slate-500 font-bold block'}>
                  SpO2 Oxygen
                </span>
                <span className={`text-base font-black ${doctorDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  {patient.vitals?.spo2 || '98%'}
                </span>
              </div>
            </div>
          </div>

          {/* Document Timeline Alongside */}
          <div
            className={`rounded-2xl p-5 border-2 shadow-sm space-y-4 transition-colors ${
              doctorDarkMode
                ? 'bg-slate-900 border-slate-700 text-white'
                : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            <div
              className={`flex items-center justify-between pb-2 border-b ${
                doctorDarkMode ? 'border-slate-800' : 'border-slate-200'
              }`}
            >
              <div
                className={`flex items-center gap-2 text-sm font-extrabold ${
                  doctorDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                <FileText className={`w-5 h-5 ${doctorDarkMode ? 'text-cyan-400' : 'text-cyan-800'}`} />
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
              <div
                className={`p-8 border-2 border-dashed rounded-2xl text-center space-y-2 transition-colors ${
                  doctorDarkMode
                    ? 'bg-slate-850 border-slate-750'
                    : 'bg-slate-50 border-slate-300'
                }`}
              >
                <FileText className={`w-8 h-8 mx-auto ${doctorDarkMode ? 'text-slate-600' : 'text-slate-400'}`} />
                <p className={`text-xs font-medium ${doctorDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  No prior medical documents uploaded during kiosk intake.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rx Prescription Modal Dialog */}
      {isRxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div
            className={`w-full max-w-xl rounded-2xl p-6 border-2 space-y-4 shadow-2xl transition-colors ${
              doctorDarkMode
                ? 'bg-slate-900 border-slate-700 text-white'
                : 'bg-white border-slate-400 text-slate-900'
            }`}
          >
            <div
              className={`flex items-center justify-between border-b pb-3 ${
                doctorDarkMode ? 'border-slate-800' : 'border-slate-200'
              }`}
            >
              <h3
                className={`text-lg font-bold flex items-center gap-2 ${
                  doctorDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                <FileSpreadsheet className={`w-5 h-5 ${doctorDarkMode ? 'text-cyan-400' : 'text-cyan-800'}`} />
                <span>Print Official OPD Prescription Slip</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsRxModalOpen(false)}
                className={`text-sm font-bold cursor-pointer ${
                  doctorDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                ✕
              </button>
            </div>

            <div
              className={`p-4 rounded-xl space-y-2 text-xs font-medium ${
                doctorDarkMode
                  ? 'bg-slate-800 text-slate-200 border border-slate-700'
                  : 'bg-slate-50 text-slate-800'
              }`}
            >
              <p><strong>Hospital:</strong> Apex Medical & Ayush Research Hospital / OPD Wing</p>
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
                className={`px-4 py-2 font-bold rounded-lg text-xs cursor-pointer ${
                  doctorDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                  setIsRxModalOpen(false);
                }}
                className="px-5 py-2 bg-cyan-700 hover:bg-cyan-600 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Send to OPD Printer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive 1-Page Clinical Summary & PDF Print Modal */}
      {isPrintSummaryOpen && (
        <PrintableClinicalSummary
          patient={patient}
          doctor={loggedInDoctor}
          chiefComplaint={chiefComplaint}
          hpiText={hpiText}
          pastHistoryText={pastHistoryText}
          drugAllergyText={drugAllergyText}
          familyHistoryText={familyHistoryText}
          personalHistoryText={personalHistoryText}
          rosText={rosText}
          ayushNotes={ayushNotes}
          physicianNotes={physicianNotes}
          hasRedFlags={hasRedFlags}
          onClose={() => setIsPrintSummaryOpen(false)}
          doctorDarkMode={doctorDarkMode}
        />
      )}
    </div>
  );
};
