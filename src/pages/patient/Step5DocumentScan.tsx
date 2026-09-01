import React, { useState, useEffect } from 'react';
import { Camera, Upload, FileText, Plus, CheckCircle2, ArrowRight, ArrowLeft, RefreshCw, Sparkles, Image as ImageIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { VoicePrompter } from '../../components/VoicePrompter';
import { DocumentExtractedCard } from '../../components/DocumentExtractedCard';
import { mockSampleDocuments } from '../../data/mockData';
import { ScannedDocument } from '../../types';

export const Step5DocumentScan: React.FC = () => {
  const {
    language,
    theme,
    speakText,
    kioskPatient,
    addScannedDocument,
    removeScannedDocument,
    setCurrentKioskStep,
  } = useApp();

  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractProgress, setExtractProgress] = useState<number>(0);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  const docPromptHi =
    'यदि आपके पास कोई पुरानी डॉक्टर की पर्ची, खून की जांच या अस्पताल की डिस्चार्ज रिपोर्ट है, तो कैमरे के सामने रखें या अपलोड करें।';
  const docPromptEn =
    'If you have past prescriptions, blood test reports, or discharge summaries, place them before the camera or upload.';

  useEffect(() => {
    speakText(language === 'hi' ? docPromptHi : docPromptEn, language);
  }, [language]);

  const handleScanSample = (sampleDoc: ScannedDocument) => {
    setIsExtracting(true);
    setExtractProgress(25);

    setTimeout(() => setExtractProgress(65), 300);
    setTimeout(() => setExtractProgress(90), 600);

    setTimeout(() => {
      setIsExtracting(false);
      setExtractProgress(0);
      addScannedDocument({
        ...sampleDoc,
        id: `doc_${Date.now()}`,
      });
    }, 900);
  };

  const handleSimulateCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setExtractProgress(40);
    setTimeout(() => setExtractProgress(85), 400);

    setTimeout(() => {
      setIsExtracting(false);
      setExtractProgress(0);
      const customDoc: ScannedDocument = {
        id: `doc_${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        type: 'prescription',
        date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        facility: 'City Health OPD & Diagnostics',
        doctorName: 'Dr. S. K. Gupta, MBBS',
        confidence: 96,
        extractedData: {
          diagnoses: ['Upper Respiratory Infection', 'Mild Hypertension'],
          medicines: [
            { name: 'Tab. Azithromycin', dosage: '500 mg', frequency: 'Once daily for 3 days' },
            { name: 'Tab. Levocetirizine', dosage: '5 mg', frequency: 'Once daily at night' },
            { name: 'Syp. Ascoril D', dosage: '10 ml', frequency: 'Thrice daily' },
          ],
          notesSummary: 'Prescription digitized from patient upload. Clear dosage schedule extracted with 96% OCR confidence.',
        },
      };
      addScannedDocument(customDoc);
    }, 850);
  };

  const scannedList = kioskPatient.scannedDocs || [];

  return (
    <div
      id="step-5-document-scan-screen"
      className="w-full max-w-4xl mx-auto space-y-6 animate-fadeIn text-left"
    >
      <VoicePrompter
        promptEn={docPromptEn}
        promptHi={docPromptHi}
      />

      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2
            className="text-2xl sm:text-3xl font-extrabold"
            style={{ color: theme.colors.textPrimary }}
          >
            {language === 'hi'
              ? 'दवा पर्ची व मेडिकल रिपोर्ट स्कैन'
              : 'Past Prescriptions & Document Scan'}
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-medium">
            {language === 'hi'
              ? 'दस्तावेज अपलोड करें — हमारा ए.आई. दवाइयां और जांच स्वतः पढ़ लेगा'
              : 'Our OCR automatically extracts medicine names, dosages, and abnormal lab values'}
          </p>
        </div>

        {/* Counter Badge */}
        <div className="flex items-center gap-2">
          <span
            className="px-4 py-2 rounded-xl text-sm font-extrabold"
            style={{
              backgroundColor: theme.colors.primaryLight,
              color: theme.colors.primaryDark,
            }}
          >
            {language === 'hi'
              ? `${scannedList.length} दस्तावेज़ संलग्न`
              : `${scannedList.length} Docs Attached`}
          </span>
        </div>
      </div>

      {/* Scanner / Upload Card */}
      <div
        className="p-6 sm:p-8 rounded-2xl border-2 bg-white space-y-6 shadow-sm"
        style={{ borderColor: theme.colors.borderDefault }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Option A: Kiosk Camera Scanner */}
          <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-center space-y-3 hover:bg-slate-100 transition-colors">
            <div
              className="p-4 rounded-2xl text-white shadow-md"
              style={{ backgroundColor: theme.colors.primary }}
            >
              <Camera className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-slate-900">
                {language === 'hi' ? 'कियोस्क कैमरा स्कैनर' : 'Kiosk Optical Camera'}
              </h4>
              <p className="text-xs text-slate-600 font-medium mt-1">
                {language === 'hi'
                  ? 'पर्ची को कियोस्क के शीशे के सामने रखें'
                  : 'Hold prescription or report in front of scanner'}
              </p>
            </div>

            <button
              id="btn-trigger-camera-scan"
              type="button"
              onClick={() => handleScanSample(mockSampleDocuments[0])}
              className="px-5 py-2.5 rounded-xl font-bold text-sm text-white shadow-sm cursor-pointer"
              style={{ backgroundColor: theme.colors.primary }}
            >
              {language === 'hi' ? 'फोटो खींचें (Snap Document)' : 'Capture Document'}
            </button>
          </div>

          {/* Option B: File / Mobile Upload */}
          <label
            htmlFor="file-upload-input"
            className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-center space-y-3 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <div className="p-4 bg-amber-100 text-amber-900 rounded-2xl shadow-md">
              <Upload className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-slate-900">
                {language === 'hi' ? 'फ़ाइल / फोटो अपलोड करें' : 'Upload Image / PDF'}
              </h4>
              <p className="text-xs text-slate-600 font-medium mt-1">
                {language === 'hi'
                  ? 'मोबाइल गैलरी या पीडीएफ चुनें'
                  : 'JPEG, PNG or PDF lab reports'}
              </p>
            </div>

            <span className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-sm shadow-sm">
              {language === 'hi' ? 'फ़ाइल चुनें' : 'Choose File'}
            </span>
            <input
              id="file-upload-input"
              type="file"
              accept="image/*,.pdf"
              onChange={handleSimulateCustomUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Quick Demo Sample Documents Presets for instant testing */}
        <div className="p-4 bg-slate-100 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>
              {language === 'hi'
                ? 'त्वरित डेमो पर्चियां जोड़ें (1-Click Presets for Evaluation)'
                : '1-Click Sample Clinical Presets'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              id="btn-sample-discharge"
              type="button"
              onClick={() => handleScanSample(mockSampleDocuments[0])}
              className="p-2.5 bg-white hover:bg-cyan-50 border border-slate-300 rounded-lg text-left text-xs font-bold text-slate-800 flex items-center gap-2 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-cyan-700 shrink-0" />
              <span className="truncate">Max Hospital Discharge (Rx)</span>
            </button>

            <button
              id="btn-sample-lab"
              type="button"
              onClick={() => handleScanSample(mockSampleDocuments[1])}
              className="p-2.5 bg-white hover:bg-rose-50 border border-slate-300 rounded-lg text-left text-xs font-bold text-slate-800 flex items-center gap-2 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-rose-700 shrink-0" />
              <span className="truncate">Dr Lal PathLabs HbA1c Panel</span>
            </button>

            <button
              id="btn-sample-ayush-doc"
              type="button"
              onClick={() => handleScanSample(mockSampleDocuments[2])}
              className="p-2.5 bg-white hover:bg-emerald-50 border border-slate-300 rounded-lg text-left text-xs font-bold text-slate-800 flex items-center gap-2 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="truncate">Ayurvedic Nadi Pariksha Sheet</span>
            </button>
          </div>
        </div>

        {/* OCR Processing Banner */}
        {isExtracting && (
          <div className="p-4 bg-cyan-50 border-2 border-cyan-400 rounded-xl space-y-2 animate-pulse">
            <div className="flex items-center justify-between text-sm font-bold text-cyan-900">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                {language === 'hi'
                  ? 'ए.आई. दस्तावेज़ से दवाइयां और रोग निकाल रहा है...'
                  : 'AI extracting clinical entities & OCR text...'}
              </span>
              <span>{extractProgress}%</span>
            </div>
            <div className="w-full bg-cyan-200 h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-700 transition-all duration-300"
                style={{ width: `${extractProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Extracted Document List */}
      {scannedList.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900">
            {language === 'hi'
              ? 'डिजिटाइज्ड एवं सत्यापित दस्तावेज़:'
              : 'Digitized & Verified Document Previews:'}
          </h3>

          <div className="space-y-4">
            {scannedList.map((doc) => (
              <DocumentExtractedCard
                key={doc.id}
                document={doc}
                onRemove={removeScannedDocument}
              />
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={() => setCurrentKioskStep(4)}
          className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-slate-300 text-slate-700 font-bold flex items-center justify-center gap-2 hover:bg-slate-100 cursor-pointer text-base"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>{language === 'hi' ? 'पीछे जाएं' : 'Back'}</span>
        </button>

        <button
          id="btn-proceed-to-summary"
          type="button"
          onClick={() => setCurrentKioskStep(6)}
          className="w-full sm:w-auto px-10 py-4 rounded-2xl font-extrabold text-xl text-white shadow-xl flex items-center justify-center gap-3 transition-all transform active:scale-95 cursor-pointer min-h-[64px]"
          style={{ backgroundColor: theme.colors.primary }}
        >
          <span>
            {scannedList.length === 0
              ? language === 'hi'
                ? 'कोई पर्ची नहीं — आगे बढ़ें (Skip & Review)'
                : 'No Docs to Add — Continue'
              : language === 'hi'
              ? 'सारांश जांचें (Review Summary)'
              : 'Review Summary'}
          </span>
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
