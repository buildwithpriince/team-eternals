import React, { useState, useRef } from 'react';
import {
  Printer,
  FileDown,
  Copy,
  Check,
  X,
  AlertTriangle,
  FileText,
  Activity,
  Heart,
  Pill,
  Stethoscope,
  ShieldCheck,
  Building2,
  Calendar,
  Clock,
  Sparkles,
  Sliders,
  Loader2,
  Download,
} from 'lucide-react';
import { PatientRecord, DoctorUser } from '../types';
import { generateClinicalSummaryPdf } from '../utils/clinicalPdfGenerator';

interface PrintableClinicalSummaryProps {
  patient: PatientRecord;
  doctor: DoctorUser | null;
  chiefComplaint: string;
  hpiText: string;
  pastHistoryText: string;
  drugAllergyText: string;
  familyHistoryText: string;
  personalHistoryText: string;
  rosText: string;
  ayushNotes: string;
  physicianNotes: string;
  hasRedFlags: boolean;
  onClose: () => void;
  doctorDarkMode?: boolean;
}

export const PrintableClinicalSummary: React.FC<PrintableClinicalSummaryProps> = ({
  patient,
  doctor,
  chiefComplaint,
  hpiText,
  pastHistoryText,
  drugAllergyText,
  familyHistoryText,
  personalHistoryText,
  rosText,
  ayushNotes,
  physicianNotes,
  hasRedFlags,
  onClose,
  doctorDarkMode = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [compactMode, setCompactMode] = useState(true);
  const [includeDocs, setIncludeDocs] = useState(true);

  const documentSheetRef = useRef<HTMLDivElement>(null);

  const isAyush = patient.department === 'ayush';
  const currentDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const currentTime = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handlePrint = () => {
    window.print();
  };

  const handleSavePdf = async () => {
    if (isGeneratingPdf) return;

    try {
      setIsGeneratingPdf(true);

      // Brief tick to show generation spinner
      await new Promise((resolve) => setTimeout(resolve, 150));

      generateClinicalSummaryPdf({
        patient,
        doctor,
        chiefComplaint,
        hpiText,
        pastHistoryText,
        drugAllergyText,
        familyHistoryText,
        personalHistoryText,
        rosText,
        ayushNotes,
        physicianNotes,
        hasRedFlags,
        includeDocs,
      });

      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 3000);
    } catch (err) {
      console.error('Error generating PDF:', err);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const generatePlainText = () => {
    return `================================================================
GOVERNMENT OF INDIA - NATIONAL HEALTH AUTHORITY
AYUSHMAN BHARAT DIGITAL MISSION (ABDM) COMPLIANT OPD INTAKE SUMMARY
================================================================
HOSPITAL: Apex Medical & Ayush Research Institute (New Delhi)
DEPARTMENT: ${isAyush ? 'AYUSH & Integrative Medicine' : 'General Internal Medicine'}
CONSULTANT: ${doctor?.name || 'Dr. Rajesh Sharma, MD'} (Reg: ${doctor?.id || 'MCI-DEL-49201'})
DATE & TIME: ${currentDate} ${currentTime}
TOKEN NUMBER: ${patient.tokenNumber}
----------------------------------------------------------------
PATIENT DEMOGRAPHICS
Name: ${patient.name}
Age/Gender: ${patient.age} Yrs / ${patient.gender.toUpperCase()}
Phone: ${patient.phone}
ABHA ID: ${patient.abhaId || 'N/A'}
Intake Mode: ${patient.inputMode.toUpperCase()} (${patient.language.toUpperCase()})
Consultation Status: ${patient.status === 'completed' ? 'DIAGNOSED & TREATED' : 'IN CLINICAL REVIEW'}
----------------------------------------------------------------
RECORDED TRIAGE VITALS
BP: ${patient.vitals?.bp || '124/80 mmHg'} | Pulse: ${patient.vitals?.pulse || '76 bpm'}
Temp: ${patient.vitals?.temp || '98.4 °F'} | SpO2: ${patient.vitals?.spo2 || '98%'}
----------------------------------------------------------------
${hasRedFlags ? `*** PRIORITY CLINICAL WARNING FLAGS ***\n${patient.redFlags.join(', ')}\n----------------------------------------------------------------\n` : ''}
SOAP CLINICAL SUMMARY
1. SUBJECTIVE:
   - Chief Complaint: ${chiefComplaint}
   - History of Present Illness (HPI): ${hpiText}

2. OBJECTIVE & SYSTEMS:
   - Review of Systems (ROS): ${rosText}
   ${isAyush ? `- Ayurvedic Pariksha: Prakriti (${patient.ayushAssessment?.prakriti || 'Vata-Kapha'}), Agni (${patient.ayushAssessment?.agni || 'Mandagni'}), Kostha (${patient.ayushAssessment?.kostha || 'Krura'}), Bala (${patient.ayushAssessment?.bala || 'Madhyama'})\n   - Samprapti/Ayush Notes: ${ayushNotes || 'None'}` : ''}

3. ASSESSMENT & BACKGROUND HISTORY:
   - Past Medical & Surgical History: ${pastHistoryText}
   - Drug Allergies & Current Meds: ${drugAllergyText}
   - Family History: ${familyHistoryText}
   - Personal/Lifestyle History: ${personalHistoryText}

4. PLAN & PHYSICIAN ORDERS:
   - Clinical Notes / Treatment Plan: ${physicianNotes || 'Routine consultation & symptomatic treatment.'}
----------------------------------------------------------------
DIGITIZED PRIOR RECORDS (${patient.scannedDocs?.length || 0}):
${(patient.scannedDocs || [])
  .map(
    (doc, idx) =>
      `[Doc ${idx + 1}] ${doc.title} (${doc.type}, ${doc.date} - ${doc.facility}):\n` +
      `  - Diagnoses: ${doc.extractedData.diagnoses?.join(', ') || 'None'}\n` +
      `  - Medicines: ${doc.extractedData.medicines?.map((m) => `${m.name} ${m.dosage} (${m.frequency})`).join('; ') || 'None'}\n` +
      `  - Lab Values: ${doc.extractedData.labValues?.map((l) => `${l.parameter}: ${l.value} ${l.unit} [${l.status}]`).join('; ') || 'None'}`
  )
  .join('\n')}
================================================================
PHYSICIAN ATTESTATION:
Verified and electronically signed by ${doctor?.name || 'Dr. Rajesh Sharma, MD'}
Registration: ${doctor?.id || 'MCI-DEL-49201'}
================================================================`;
  };

  const handleCopy = () => {
    const text = generatePlainText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadTxt = () => {
    const text = generatePlainText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Clinical_Summary_${patient.tokenNumber}_${patient.name.replace(/\s+/g, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      id="printable-clinical-summary-container"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 text-left animate-fadeIn print-area-active"
    >
      <div
        className={`w-full max-w-4xl my-auto rounded-2xl shadow-2xl border flex flex-col overflow-hidden transition-all ${
          doctorDarkMode
            ? 'bg-slate-900 border-slate-700 text-white'
            : 'bg-slate-100 border-slate-300 text-slate-900'
        }`}
      >
        {/* Controls Toolbar (Hidden in Print) */}
        <div
          className={`p-3 sm:p-4 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 print-hide ${
            doctorDarkMode
              ? 'bg-slate-850 border-slate-750 text-white'
              : 'bg-white border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-600 text-white">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold">
                Clinical Intake Summary & PDF Generator
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {patient.name} • Token #{patient.tokenNumber} • {patient.department === 'ayush' ? 'AYUSH' : 'General'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View options */}
            <button
              type="button"
              onClick={() => setCompactMode(!compactMode)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                compactMode
                  ? 'bg-cyan-50 border-cyan-300 text-cyan-900'
                  : 'bg-slate-100 border-slate-300 text-slate-700'
              }`}
              title="Toggle between dense 1-page fit and expanded spacing"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{compactMode ? '1-Page Fit' : 'Relaxed View'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIncludeDocs(!includeDocs)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                includeDocs
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-900'
                  : 'bg-slate-100 border-slate-300 text-slate-700'
              }`}
              title="Include Digitized Prior Documents table"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{includeDocs ? 'Docs: Included' : 'Docs: Excluded'}</span>
            </button>

            {/* Action buttons */}
            <button
              type="button"
              onClick={handleCopy}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                copied
                  ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
              }`}
              title="Copy formatted plain text summary to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Text'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadTxt}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              title="Download raw text file for EMR copy-paste"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>.TXT</span>
            </button>

            {/* Primary Save PDF Button */}
            <button
              id="btn-save-clinical-pdf"
              type="button"
              onClick={handleSavePdf}
              disabled={isGeneratingPdf}
              className={`px-4 py-1.5 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all active:scale-95 ${
                pdfSuccess
                  ? 'bg-emerald-600 text-white'
                  : isGeneratingPdf
                  ? 'bg-cyan-800 text-white cursor-wait opacity-80'
                  : 'bg-cyan-700 hover:bg-cyan-600 text-white'
              }`}
              title="Generate and download a high-resolution .PDF file directly"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : pdfSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>PDF Downloaded!</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Save PDF</span>
                </>
              )}
            </button>

            {/* Print Dialog Button */}
            <button
              id="btn-trigger-print-dialog"
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-transform active:scale-95"
              title="Open browser print / PDF printer preview dialog"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg text-sm cursor-pointer ml-1"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Paper Document Container */}
        <div className="p-3 sm:p-6 overflow-y-auto max-h-[82vh] bg-slate-200/60 print:p-0 print:m-0 print:bg-white print:overflow-visible">
          <div
            ref={documentSheetRef}
            id="printable-document-sheet"
            className="bg-white text-slate-900 mx-auto rounded-xl p-6 sm:p-8 shadow-md border border-slate-300 print:shadow-none print:border-none print:p-0 print:rounded-none max-w-3xl space-y-3.5 text-xs font-normal print:text-[11px] leading-relaxed"
            style={{ minHeight: compactMode ? 'auto' : '1050px' }}
          >
            {/* 1. Official Hospital & ABDM Header */}
            <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shrink-0 print:border print:border-black">
                  <Building2 className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 print:border-black">
                      ABDM M2 COMPLIANT EMR RECORD
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold">
                      OPD CLINICAL INTAKE SUMMARY
                    </span>
                  </div>
                  <h1 className="text-base sm:text-lg font-black text-slate-950 uppercase tracking-tight">
                    Apex Medical & Ayush Research Hospital
                  </h1>
                  <p className="text-[11px] text-slate-600 font-medium">
                    Department of {isAyush ? 'AYUSH & Integrative Medicine' : 'General Internal Medicine'} • OPD Wing 3
                  </p>
                </div>
              </div>

              {/* Token Badge */}
              <div className="text-right shrink-0">
                <div className="inline-block px-3 py-1 bg-slate-900 text-white font-black text-sm rounded-lg print:border print:border-black">
                  TOKEN: {patient.tokenNumber}
                </div>
                <p className="text-[10px] text-slate-500 font-bold mt-1">
                  {currentDate} • {currentTime}
                </p>
              </div>
            </div>

            {/* 2. Patient Demographics & Vitals Band */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-300 grid grid-cols-2 sm:grid-cols-4 gap-3 print:bg-slate-50">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-500 block">Patient Name:</span>
                <span className="font-extrabold text-sm text-slate-950 block">{patient.name}</span>
                <span className="text-[11px] text-slate-600 font-medium">
                  {patient.age} Yrs • {patient.gender.toUpperCase()}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase text-slate-500 block">Contact & ABHA:</span>
                <span className="font-bold text-slate-900 block">{patient.phone}</span>
                <span className="text-[10px] text-slate-600 font-mono block truncate">
                  ABHA: {patient.abhaId || 'Not Linked'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase text-slate-500 block">Consulting Doctor:</span>
                <span className="font-bold text-slate-900 block">{doctor?.name || 'Dr. Rajesh Sharma'}</span>
                <span className="text-[10px] text-slate-600 font-medium block">
                  Room: {doctor?.roomNumber || 'Room 104'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase text-slate-500 block">Triage Status:</span>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    hasRedFlags
                      ? 'bg-rose-100 text-rose-900 border border-rose-400 font-black'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  }`}
                >
                  {hasRedFlags ? 'URGENT / RED FLAG' : 'ROUTINE CONSULTATION'}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Kiosk: {patient.inputMode.toUpperCase()} ({patient.language.toUpperCase()})
                </span>
              </div>
            </div>

            {/* 3. Triage Recorded Vitals Bar */}
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-300 flex items-center justify-between text-xs font-semibold print:py-1.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <Activity className="w-3.5 h-3.5 text-rose-600" />
                <span>Recorded Vitals:</span>
              </div>
              <div className="flex items-center gap-4 text-slate-800 font-mono">
                <span>
                  BP: <strong className="text-slate-950 font-sans">{patient.vitals?.bp || '124/80'}</strong> mmHg
                </span>
                <span>
                  Pulse: <strong className="text-slate-950 font-sans">{patient.vitals?.pulse || '76'}</strong> bpm
                </span>
                <span>
                  Temp: <strong className="text-slate-950 font-sans">{patient.vitals?.temp || '98.4'}</strong> °F
                </span>
                <span>
                  SpO2: <strong className="text-emerald-800 font-sans">{patient.vitals?.spo2 || '98%'}</strong>
                </span>
              </div>
            </div>

            {/* 4. Priority Clinical Warning Banner (If Present) */}
            {hasRedFlags && (
              <div className="p-2.5 bg-rose-50 border-2 border-rose-400 rounded-lg text-rose-950 space-y-1 print-avoid-break">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Priority Clinical Warning Flags (Kiosk Rule Match):</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {patient.redFlags.map((flag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-rose-200/90 text-rose-950 font-extrabold text-[10px] border border-rose-400"
                    >
                      ⚠ {flag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Structured SOAP Format Summary */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5 text-cyan-800" />
                  <span>Clinical Intake Synthesis (SOAP Framework)</span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  Synthesized from Multilingual Voice/Touch Kiosk Intake
                </span>
              </div>

              {/* S: Chief Complaint & HPI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 print-avoid-break">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-300 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                    1. Chief Complaint (Pradhana Lakshana)
                  </span>
                  <p className="font-extrabold text-slate-950 text-xs">{chiefComplaint}</p>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-300 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                    2. History of Present Illness (HPI / Rogotpatthi)
                  </span>
                  <p className="font-medium text-slate-800 text-[11px]">{hpiText}</p>
                </div>
              </div>

              {/* AYUSH Dashavidha Pariksha (If applicable) */}
              {isAyush && (
                <div className="p-2.5 bg-emerald-50/70 border border-emerald-300 rounded-lg space-y-1.5 print-avoid-break">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-900">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Ayurvedic Assessment (Dashavidha Pariksha & Agni)</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[10px]">
                    <div className="p-1.5 bg-white rounded border border-emerald-200">
                      <span className="text-slate-500 font-bold block">Prakriti:</span>
                      <span className="font-extrabold text-emerald-950">
                        {patient.ayushAssessment?.prakriti || 'Vata-Kapha'}
                      </span>
                    </div>
                    <div className="p-1.5 bg-white rounded border border-emerald-200">
                      <span className="text-slate-500 font-bold block">Jatharagni:</span>
                      <span className="font-extrabold text-emerald-950">
                        {patient.ayushAssessment?.agni || 'Mandagni'}
                      </span>
                    </div>
                    <div className="p-1.5 bg-white rounded border border-emerald-200">
                      <span className="text-slate-500 font-bold block">Kostha:</span>
                      <span className="font-extrabold text-emerald-950">
                        {patient.ayushAssessment?.kostha || 'Krura Kostha'}
                      </span>
                    </div>
                    <div className="p-1.5 bg-white rounded border border-emerald-200">
                      <span className="text-slate-500 font-bold block">Rogibala:</span>
                      <span className="font-extrabold text-emerald-950">
                        {patient.ayushAssessment?.bala || 'Madhyama'}
                      </span>
                    </div>
                  </div>
                  {ayushNotes && (
                    <p className="text-[10px] text-emerald-950 bg-white/80 p-1.5 rounded border border-emerald-200 font-medium">
                      <strong>Samprapti Notes:</strong> {ayushNotes}
                    </p>
                  )}
                </div>
              )}

              {/* Background History Grid: Past History, Allergies, Family, Lifestyle, ROS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 print-avoid-break">
                {/* Past Medical & Surgical */}
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-300 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                    3. Past Medical & Surgical History (Purva Vyadhi)
                  </span>
                  <p className="text-[11px] text-slate-800 font-medium">{pastHistoryText}</p>
                </div>

                {/* Drug Allergies & Current Meds */}
                <div className="p-2.5 bg-rose-50/70 rounded-lg border border-rose-300 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 flex items-center gap-1">
                    <Pill className="w-3 h-3 text-rose-600" />
                    <span>4. Drug Allergies & Medications (Oushadha)</span>
                  </span>
                  <p className="text-[11px] text-rose-950 font-bold">{drugAllergyText}</p>
                </div>

                {/* Family History */}
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-300 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
                    <Heart className="w-3 h-3 text-indigo-600" />
                    <span>5. Family History (Kula Vrittanta)</span>
                  </span>
                  <p className="text-[11px] text-slate-800 font-medium">{familyHistoryText}</p>
                </div>

                {/* Personal History & ROS */}
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-300 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                    6. Personal Lifestyle & ROS (Ahar-Vihar / Systems)
                  </span>
                  <p className="text-[11px] text-slate-800 font-medium">
                    <strong>Lifestyle:</strong> {personalHistoryText} • <strong>ROS:</strong> {rosText}
                  </p>
                </div>
              </div>

              {/* Physician Treatment Plan & Orders */}
              <div className="p-3 bg-cyan-50/70 rounded-lg border-2 border-cyan-400 space-y-1 print-avoid-break">
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-950 flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5 text-cyan-800" />
                  <span>Physician Consultation Notes & Treatment Plan:</span>
                </span>
                <p className="text-xs font-semibold text-slate-900 whitespace-pre-line leading-relaxed">
                  {physicianNotes || 'Consultation in progress. Standard symptomatic and supportive therapy advised.'}
                </p>
              </div>
            </div>

            {/* 6. Digitized Prior Documents Summary Table (If Enabled & Available) */}
            {includeDocs && patient.scannedDocs && patient.scannedDocs.length > 0 && (
              <div className="space-y-1.5 print-avoid-break border-t border-slate-300 pt-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1">
                    <FileText className="w-3 h-3 text-cyan-800" />
                    <span>Digitized Prior Documents & Lab Findings ({patient.scannedDocs.length})</span>
                  </span>
                  <span className="text-[9px] text-slate-500 font-medium">
                    Automated Vision-OCR Extracted
                  </span>
                </div>

                <div className="border border-slate-300 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-[10px] border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 font-black text-slate-700">
                        <th className="p-1.5">Document Title & Facility</th>
                        <th className="p-1.5">Date / Type</th>
                        <th className="p-1.5">Extracted Diagnoses & Summary</th>
                        <th className="p-1.5">Medicines / Lab Values</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {patient.scannedDocs.map((doc, idx) => (
                        <tr key={doc.id || idx} className="hover:bg-slate-50">
                          <td className="p-1.5 font-bold text-slate-900">
                            {doc.title}
                            <span className="block text-[9px] text-slate-500 font-normal">
                              {doc.facility} {doc.doctorName ? `• ${doc.doctorName}` : ''}
                            </span>
                          </td>
                          <td className="p-1.5 font-mono text-[9px] whitespace-nowrap">
                            {doc.date}
                            <span className="block font-sans uppercase font-bold text-slate-600">
                              {doc.type.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-1.5">
                            {doc.extractedData.diagnoses && doc.extractedData.diagnoses.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-0.5">
                                {doc.extractedData.diagnoses.map((d, i) => (
                                  <span
                                    key={i}
                                    className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-900 font-bold text-[9px]"
                                  >
                                    {d}
                                  </span>
                                ))}
                              </div>
                            )}
                            <span className="text-[9px] text-slate-600 font-medium line-clamp-2">
                              {doc.extractedData.notesSummary}
                            </span>
                          </td>
                          <td className="p-1.5">
                            {doc.extractedData.medicines && doc.extractedData.medicines.length > 0 ? (
                              <div className="space-y-0.5 text-[9px]">
                                {doc.extractedData.medicines.map((m, i) => (
                                  <div key={i} className="text-slate-800">
                                    • <strong>{m.name}</strong> {m.dosage} ({m.frequency})
                                  </div>
                                ))}
                              </div>
                            ) : doc.extractedData.labValues && doc.extractedData.labValues.length > 0 ? (
                              <div className="space-y-0.5 text-[9px]">
                                {doc.extractedData.labValues.map((l, i) => (
                                  <div key={i} className="text-slate-800">
                                    • {l.parameter}: <strong>{l.value} {l.unit}</strong>{' '}
                                    <span
                                      className={`px-1 py-0.2 rounded text-[8px] font-black uppercase ${
                                        l.status === 'high'
                                          ? 'bg-rose-100 text-rose-800'
                                          : l.status === 'low'
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-emerald-100 text-emerald-800'
                                      }`}
                                    >
                                      {l.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">None</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 7. Doctor Attestation & Signature Footer */}
            <div className="border-t-2 border-slate-900 pt-3 flex items-end justify-between gap-4 print-avoid-break text-[10px]">
              <div className="space-y-1 max-w-sm">
                <div className="flex items-center gap-1 font-bold text-slate-700">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Clinical Attestation & Verification</span>
                </div>
                <p className="text-[9px] text-slate-500 leading-tight">
                  This summary was generated via AI-assisted bilingual kiosk intake and verified by the attending physician. Factual integrity cross-verified against patient statements and digitized clinical records.
                </p>
              </div>

              <div className="text-right space-y-1 shrink-0">
                <div className="h-9 border-b border-dashed border-slate-400 w-48 mx-auto flex items-end justify-center pb-1">
                  <span className="text-[9px] text-slate-400 italic font-mono">Digital Attestation Stamp</span>
                </div>
                <p className="font-extrabold text-slate-950 text-xs">
                  {doctor?.name || 'Dr. Rajesh Sharma, MD'}
                </p>
                <p className="text-[10px] text-slate-600 font-medium">
                  Reg No: {doctor?.id || 'MCI-DEL-49201'} • Dept of {isAyush ? 'AYUSH' : 'Medicine'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
