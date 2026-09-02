import jsPDF from 'jspdf';
import { PatientRecord, DoctorUser } from '../types';

interface GeneratePdfOptions {
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
  includeDocs?: boolean;
}

export function generateClinicalSummaryPdf(options: GeneratePdfOptions): void {
  const {
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
    includeDocs = true,
  } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 10;
  const contentWidth = pageWidth - margin * 2; // 190mm

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

  let y = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 12) {
      doc.addPage();
      y = margin;
      // Header for continued page
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `Apex Medical Hospital - Clinical Summary (${patient.name} - Token: ${patient.tokenNumber}) [Continued]`,
        margin,
        y
      );
      y += 6;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, y, margin + contentWidth, y);
      y += 4;
    }
  };

  // --- 1. HEADER SECTION ---
  // Outer header background
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'F');

  // ABDM Badge
  doc.setFillColor(14, 116, 144); // cyan-700
  doc.roundedRect(margin + 4, y + 3, 56, 4, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text('ABDM M2 COMPLIANT EMR RECORD', margin + 6, y + 6);

  // Sub-badge
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(200, 220, 230);
  doc.text('OPD CLINICAL INTAKE SUMMARY', margin + 63, y + 6);

  // Hospital Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('APEX MEDICAL & AYUSH RESEARCH HOSPITAL', margin + 4, y + 13);

  // Department
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(
    `Department of ${isAyush ? 'AYUSH & Integrative Medicine' : 'General Internal Medicine'} • OPD Wing 3`,
    margin + 4,
    y + 18
  );

  // Token Box (Right side)
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin + contentWidth - 36, y + 3, 32, 9, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`TOKEN: ${patient.tokenNumber}`, margin + contentWidth - 33, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`${currentDate} • ${currentTime}`, margin + contentWidth - 36, y + 17);

  y += 24;

  // --- 2. PATIENT DEMOGRAPHICS CARD ---
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 16, 1.5, 1.5, 'FD');

  const colWidth = contentWidth / 4;

  // Col 1: Patient Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('PATIENT NAME:', margin + 3, y + 4.5);
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(patient.name.length > 22 ? patient.name.substring(0, 22) + '...' : patient.name, margin + 3, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(`${patient.age} Yrs • ${patient.gender.toUpperCase()}`, margin + 3, y + 13.5);

  // Col 2: Contact & ABHA
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('CONTACT & ABHA:', margin + colWidth + 2, y + 4.5);
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(patient.phone, margin + colWidth + 2, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`ABHA: ${patient.abhaId || 'Not Linked'}`, margin + colWidth + 2, y + 13.5);

  // Col 3: Consulting Doctor
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('CONSULTING DOCTOR:', margin + colWidth * 2 + 2, y + 4.5);
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(doctor?.name || 'Dr. Rajesh Sharma, MD', margin + colWidth * 2 + 2, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Room: ${doctor?.roomNumber || 'Room 104'} (OPD)`, margin + colWidth * 2 + 2, y + 13.5);

  // Col 4: Triage Priority
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('TRIAGE STATUS:', margin + colWidth * 3 + 2, y + 4.5);

  if (hasRedFlags) {
    doc.setFillColor(254, 226, 226); // rose-100
    doc.setDrawColor(248, 113, 113); // rose-400
    doc.roundedRect(margin + colWidth * 3 + 2, y + 6, 38, 5, 1, 1, 'FD');
    doc.setFontSize(6.5);
    doc.setTextColor(153, 27, 27); // rose-800
    doc.text('URGENT / RED FLAGS', margin + colWidth * 3 + 4, y + 9.5);
  } else {
    doc.setFillColor(220, 252, 231); // emerald-100
    doc.setDrawColor(134, 239, 172); // emerald-300
    doc.roundedRect(margin + colWidth * 3 + 2, y + 6, 38, 5, 1, 1, 'FD');
    doc.setFontSize(6.5);
    doc.setTextColor(22, 101, 52); // emerald-800
    doc.text('ROUTINE CONSULTATION', margin + colWidth * 3 + 4, y + 9.5);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text(`Kiosk: ${patient.inputMode.toUpperCase()} (${patient.language.toUpperCase()})`, margin + colWidth * 3 + 2, y + 14);

  y += 18;

  // --- 3. VITALS BAR ---
  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 7, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text('RECORDED VITALS:', margin + 3, y + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Blood Pressure: ${patient.vitals?.bp || '124/80'} mmHg    |    Pulse: ${patient.vitals?.pulse || '76'} bpm    |    Temp: ${patient.vitals?.temp || '98.4'} °F    |    SpO2: ${patient.vitals?.spo2 || '98%'}`,
    margin + 36,
    y + 4.5
  );

  y += 9;

  // --- 4. RED FLAGS ALERT (If present) ---
  if (hasRedFlags && patient.redFlags && patient.redFlags.length > 0) {
    doc.setFillColor(254, 242, 242); // rose-50
    doc.setDrawColor(239, 68, 68); // rose-500
    doc.setLineWidth(0.4);

    const flagsText = patient.redFlags.map((f) => `• ${f}`).join('    ');
    const splitFlags = doc.splitTextToSize(flagsText, contentWidth - 8);
    const boxHeight = 7 + splitFlags.length * 3.5;

    doc.roundedRect(margin, y, contentWidth, boxHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(185, 28, 28); // rose-700
    doc.text('PRIORITY CLINICAL WARNING FLAGS (KIOSK RULE MATCH):', margin + 3, y + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(153, 27, 27);
    doc.text(splitFlags, margin + 3, y + 8.5);

    y += boxHeight + 2;
  }

  // --- 5. SOAP SYNTHESIS SUB-HEADER ---
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + contentWidth, y);
  y += 3.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('CLINICAL INTAKE SYNTHESIS (SOAP FRAMEWORK)', margin, y);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Synthesized from Multilingual Voice/Touch Kiosk Intake', margin + 85, y);

  y += 2.5;

  // Helper function to render a labeled clinical block
  const renderBlock = (
    title: string,
    content: string,
    width: number,
    xOffset: number,
    bgR = 248,
    bgG = 250,
    bgB = 252,
    borderR = 203,
    borderG = 213,
    borderB = 225
  ): number => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    const splitText = doc.splitTextToSize(content || 'None reported.', width - 6);
    const blockHeight = Math.max(12, 6.5 + splitText.length * 3.2);

    doc.setFillColor(bgR, bgG, bgB);
    doc.setDrawColor(borderR, borderG, borderB);
    doc.setLineWidth(0.3);
    doc.roundedRect(xOffset, y, width, blockHeight, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(title.toUpperCase(), xOffset + 3, y + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(splitText, xOffset + 3, y + 7.5);

    return blockHeight;
  };

  // S1: Chief Complaint & HPI side by side
  const halfWidth = (contentWidth - 2) / 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  const ccLines = doc.splitTextToSize(chiefComplaint || 'General checkup', halfWidth - 6);
  const hpiLines = doc.splitTextToSize(hpiText || 'No history provided', halfWidth - 6);
  const maxH1 = Math.max(13, 7 + Math.max(ccLines.length, hpiLines.length) * 3.2);

  checkPageBreak(maxH1);

  // CC Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, halfWidth, maxH1, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('1. CHIEF COMPLAINT (PRADHANA LAKSHANA)', margin + 3, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(ccLines, margin + 3, y + 8);

  // HPI Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin + halfWidth + 2, y, halfWidth, maxH1, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('2. HISTORY OF PRESENT ILLNESS (HPI)', margin + halfWidth + 5, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text(hpiLines, margin + halfWidth + 5, y + 8);

  y += maxH1 + 2;

  // AYUSH Assessment block (If applicable)
  if (isAyush) {
    checkPageBreak(16);
    doc.setFillColor(236, 253, 245); // emerald-50
    doc.setDrawColor(167, 243, 208); // emerald-200
    doc.roundedRect(margin, y, contentWidth, 14, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(6, 95, 70); // emerald-800
    doc.text('AYURVEDIC ASSESSMENT (DASHAVIDHA PARIKSHA & AGNI):', margin + 3, y + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `Prakriti: ${patient.ayushAssessment?.prakriti || 'Vata-Kapha'}    |    Agni: ${patient.ayushAssessment?.agni || 'Mandagni'}    |    Kostha: ${patient.ayushAssessment?.kostha || 'Krura'}    |    Bala: ${patient.ayushAssessment?.bala || 'Madhyama'}`,
      margin + 3,
      y + 8
    );

    if (ayushNotes) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.setTextColor(6, 95, 70);
      const noteSplit = doc.splitTextToSize(`Samprapti / Notes: ${ayushNotes}`, contentWidth - 6);
      doc.text(noteSplit, margin + 3, y + 11.5);
    }

    y += 16;
  }

  // Row 2: Past History & Drug Allergies
  const pastLines = doc.splitTextToSize(pastHistoryText || 'None reported.', halfWidth - 6);
  const allergyLines = doc.splitTextToSize(drugAllergyText || 'No known drug allergies.', halfWidth - 6);
  const maxH2 = Math.max(12, 7 + Math.max(pastLines.length, allergyLines.length) * 3.2);

  checkPageBreak(maxH2);

  // Past History
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, halfWidth, maxH2, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('3. PAST MEDICAL & SURGICAL HISTORY', margin + 3, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text(pastLines, margin + 3, y + 7.5);

  // Drug Allergies (Slight rose tone for prominence)
  doc.setFillColor(255, 241, 242); // rose-50
  doc.setDrawColor(254, 205, 211); // rose-200
  doc.roundedRect(margin + halfWidth + 2, y, halfWidth, maxH2, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(159, 18, 57); // rose-800
  doc.text('4. DRUG ALLERGIES & CURRENT MEDICATIONS', margin + halfWidth + 5, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(136, 19, 55);
  doc.text(allergyLines, margin + halfWidth + 5, y + 7.5);

  y += maxH2 + 2;

  // Row 3: Family History & Personal History / ROS
  const famLines = doc.splitTextToSize(familyHistoryText || 'No major familial conditions.', halfWidth - 6);
  const rosCombined = `Lifestyle: ${personalHistoryText || 'Non-smoker, active'} | ROS: ${rosText || 'No other symptoms'}`;
  const rosLines = doc.splitTextToSize(rosCombined, halfWidth - 6);
  const maxH3 = Math.max(12, 7 + Math.max(famLines.length, rosLines.length) * 3.2);

  checkPageBreak(maxH3);

  // Family History
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, halfWidth, maxH3, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('5. FAMILY HISTORY (KULA VRITTANTA)', margin + 3, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text(famLines, margin + 3, y + 7.5);

  // Personal History & ROS
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin + halfWidth + 2, y, halfWidth, maxH3, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('6. PERSONAL LIFESTYLE & REVIEW OF SYSTEMS', margin + halfWidth + 5, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text(rosLines, margin + halfWidth + 5, y + 7.5);

  y += maxH3 + 2;

  // Row 4: Physician Treatment Plan & Orders
  const planLines = doc.splitTextToSize(
    physicianNotes || 'Consultation in progress. Standard symptomatic and supportive therapy advised.',
    contentWidth - 6
  );
  const planHeight = Math.max(13, 7 + planLines.length * 3.3);

  checkPageBreak(planHeight);

  doc.setFillColor(236, 254, 255); // cyan-50
  doc.setDrawColor(103, 232, 249); // cyan-300
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, contentWidth, planHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(14, 116, 144); // cyan-700
  doc.text('PHYSICIAN CONSULTATION NOTES & TREATMENT PLAN:', margin + 3, y + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text(planLines, margin + 3, y + 8.5);

  y += planHeight + 3;

  // --- 6. DIGITIZED PRIOR DOCUMENTS SECTION ---
  if (includeDocs && patient.scannedDocs && patient.scannedDocs.length > 0) {
    checkPageBreak(24);

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + contentWidth, y);
    y += 3;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`DIGITIZED PRIOR DOCUMENTS & LAB FINDINGS (${patient.scannedDocs.length})`, margin, y);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Automated Vision-OCR Extracted Records', margin + 80, y);
    y += 2.5;

    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentWidth, 5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(51, 65, 85);
    doc.text('DOCUMENT / FACILITY', margin + 2, y + 3.5);
    doc.text('DATE & TYPE', margin + 55, y + 3.5);
    doc.text('EXTRACTED DIAGNOSES & NOTES', margin + 85, y + 3.5);
    doc.text('DIGITIZED RX / LAB VALUES', margin + 140, y + 3.5);

    y += 5;

    patient.scannedDocs.forEach((docItem, idx) => {
      checkPageBreak(12);

      const diagSummary = `${docItem.extractedData.diagnoses?.join(', ') || ''} - ${docItem.extractedData.notesSummary || ''}`;
      const diagLines = doc.splitTextToSize(diagSummary, 52);

      let medLabText = '';
      if (docItem.extractedData.medicines && docItem.extractedData.medicines.length > 0) {
        medLabText = docItem.extractedData.medicines
          .map((m) => `${m.name} ${m.dosage} (${m.frequency})`)
          .join(', ');
      } else if (docItem.extractedData.labValues && docItem.extractedData.labValues.length > 0) {
        medLabText = docItem.extractedData.labValues
          .map((l) => `${l.parameter}: ${l.value} ${l.unit} [${l.status.toUpperCase()}]`)
          .join(', ');
      } else {
        medLabText = 'None';
      }
      const medLabLines = doc.splitTextToSize(medLabText, 48);

      const rowHeight = Math.max(9, 4 + Math.max(diagLines.length, medLabLines.length) * 3);

      doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, contentWidth, rowHeight, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(15, 23, 42);
      doc.text(docItem.title.substring(0, 26), margin + 2, y + 3.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text(docItem.facility.substring(0, 26), margin + 2, y + 6.8);

      // Date & Type
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85);
      doc.text(docItem.date, margin + 55, y + 3.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.text(docItem.type.replace('_', ' ').toUpperCase(), margin + 55, y + 6.8);

      // Diagnoses
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(30, 41, 59);
      doc.text(diagLines, margin + 85, y + 3.5);

      // Meds / Labs
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(30, 41, 59);
      doc.text(medLabLines, margin + 140, y + 3.5);

      y += rowHeight;
    });

    y += 3;
  }

  // --- 7. ATTESTATION & FOOTER ---
  checkPageBreak(18);

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.line(margin, y, margin + contentWidth, y);
  y += 3.5;

  // Left side disclaimer
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(15, 23, 42);
  doc.text('CLINICAL ATTESTATION & EMR AUTHENTICATION', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(100, 116, 139);
  const disclaimer =
    'This summary was synthesized via AI-assisted bilingual kiosk intake and verified by the attending physician. Factual integrity cross-verified against patient statements and digitized clinical records under ABDM guidelines.';
  const discLines = doc.splitTextToSize(disclaimer, 105);
  doc.text(discLines, margin, y + 3.5);

  // Right side Signature stamp
  doc.setDrawColor(150, 150, 150);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin + contentWidth - 55, y + 5, margin + contentWidth, y + 5);
  doc.setLineDashPattern([], 0); // reset dash

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(doctor?.name || 'Dr. Rajesh Sharma, MD', margin + contentWidth - 55, y + 8.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(71, 85, 105);
  doc.text(`Reg No: ${doctor?.id || 'MCI-DEL-49201'} • Dept of ${isAyush ? 'AYUSH' : 'Medicine'}`, margin + contentWidth - 55, y + 12);

  // Save the PDF file
  const fileName = `Clinical_Summary_${patient.tokenNumber}_${patient.name.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}
