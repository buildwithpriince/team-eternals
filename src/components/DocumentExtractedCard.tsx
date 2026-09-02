import React from 'react';
import { FileText, CheckCircle2, Pill, Activity, Trash2, ShieldCheck, Stethoscope } from 'lucide-react';
import { ScannedDocument } from '../types';
import { useApp } from '../context/AppContext';

interface DocumentExtractedCardProps {
  document: ScannedDocument;
  onRemove?: (id: string) => void;
  showRemove?: boolean;
}

export const DocumentExtractedCard: React.FC<DocumentExtractedCardProps> = ({
  document,
  onRemove,
  showRemove = true,
}) => {
  const { language, theme, appView, doctorDarkMode } = useApp();
  const isDoctorDark = appView === 'doctor' && doctorDarkMode;

  return (
    <div
      id={`doc-card-${document.id}`}
      className={`w-full rounded-2xl p-5 sm:p-6 border-2 shadow-sm space-y-4 text-left transition-all ${
        isDoctorDark
          ? 'bg-slate-850 border-slate-700 text-white'
          : 'bg-white border-slate-300'
      }`}
      style={!isDoctorDark ? { borderColor: theme.colors.borderDefault } : undefined}
    >
      {/* Header with Title, Confidence & Delete */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b ${
          isDoctorDark ? 'border-slate-750' : 'border-slate-200'
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`p-3 rounded-xl shrink-0 ${
              isDoctorDark ? 'bg-cyan-950 text-cyan-300' : ''
            }`}
            style={
              !isDoctorDark
                ? {
                    backgroundColor: theme.colors.primaryLight,
                    color: theme.colors.primaryDark,
                  }
                : undefined
            }
          >
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4
                className={`text-lg font-bold leading-tight ${
                  isDoctorDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {document.title}
              </h4>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase border ${
                  isDoctorDark
                    ? 'bg-slate-800 text-slate-300 border-slate-700'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                {document.type.replace('_', ' ')}
              </span>
            </div>
            <p
              className={`text-xs font-medium mt-0.5 ${
                isDoctorDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              {document.facility} • {document.date}
              {document.doctorName ? ` • ${document.doctorName}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* OCR Confidence Tag */}
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              isDoctorDark
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                : 'bg-emerald-50 text-emerald-800 border-emerald-300'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>
              {language === 'hi' ? `सटीकता: ${document.confidence}%` : `OCR: ${document.confidence}%`}
            </span>
          </span>

          {showRemove && onRemove && (
            <button
              id={`btn-remove-doc-${document.id}`}
              onClick={() => onRemove(document.id)}
              className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
              title={language === 'hi' ? 'दस्तावेज़ हटाएं' : 'Remove Document'}
              aria-label="Remove document"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Extracted Content Preview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Diagnoses & Notes Summary */}
        <div
          className={`p-3.5 rounded-xl space-y-2 border ${
            isDoctorDark
              ? 'bg-slate-900 border-slate-750'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div
            className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${
              isDoctorDark ? 'text-cyan-400' : 'text-slate-700'
            }`}
          >
            <Stethoscope className="w-4 h-4 text-cyan-600" />
            <span>
              {language === 'hi' ? 'पहचाने गए रोग व सारांश' : 'Extracted Diagnosis & Summary'}
            </span>
          </div>

          {document.extractedData.diagnoses && document.extractedData.diagnoses.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {document.extractedData.diagnoses.map((diag, i) => (
                <span
                  key={i}
                  className={`px-2.5 py-0.5 rounded-md text-xs font-bold border shadow-2xs ${
                    isDoctorDark
                      ? 'bg-slate-800 text-white border-slate-700'
                      : 'bg-white text-slate-800 border-slate-300'
                  }`}
                >
                  {diag}
                </span>
              ))}
            </div>
          )}

          <p
            className={`text-xs leading-relaxed font-medium ${
              isDoctorDark ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            {document.extractedData.notesSummary}
          </p>
        </div>

        {/* Medicines Extracted OR Lab Values */}
        {document.extractedData.medicines && document.extractedData.medicines.length > 0 ? (
          <div
            className={`p-3.5 rounded-xl space-y-2 border ${
              isDoctorDark
                ? 'bg-slate-900 border-slate-750'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div
              className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${
                isDoctorDark ? 'text-emerald-400' : 'text-slate-700'
              }`}
            >
              <Pill className="w-4 h-4 text-emerald-500" />
              <span>
                {language === 'hi' ? 'पहचानी गई दवाइयां (Rx Digitized)' : 'Digitized Prescriptions'}
              </span>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {document.extractedData.medicines.map((med, i) => (
                <div
                  key={i}
                  className={`p-2 rounded-lg border text-xs flex justify-between items-center ${
                    isDoctorDark
                      ? 'bg-slate-850 border-slate-750'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div>
                    <span className={`font-bold ${isDoctorDark ? 'text-white' : 'text-slate-900'}`}>{med.name}</span>
                    <span className={`ml-1 ${isDoctorDark ? 'text-slate-400' : 'text-slate-500'}`}>({med.dosage})</span>
                  </div>
                  <span
                    className={`font-medium text-[11px] px-2 py-0.5 rounded ${
                      isDoctorDark
                        ? 'bg-slate-800 text-slate-300'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {med.frequency}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : document.extractedData.labValues && document.extractedData.labValues.length > 0 ? (
          <div
            className={`p-3.5 rounded-xl space-y-2 border ${
              isDoctorDark
                ? 'bg-slate-900 border-slate-750'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div
              className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${
                isDoctorDark ? 'text-rose-400' : 'text-slate-700'
              }`}
            >
              <Activity className="w-4 h-4 text-rose-500" />
              <span>
                {language === 'hi' ? 'जांच परिणाम (Lab Values)' : 'Digitized Lab Results'}
              </span>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {document.extractedData.labValues.map((lab, i) => (
                <div
                  key={i}
                  className={`p-2 rounded-lg border text-xs flex justify-between items-center ${
                    isDoctorDark
                      ? 'bg-slate-850 border-slate-750'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <span className={`font-semibold ${isDoctorDark ? 'text-slate-200' : 'text-slate-800'}`}>{lab.parameter}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold ${isDoctorDark ? 'text-white' : 'text-slate-950'}`}>
                      {lab.value} {lab.unit}
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                        lab.status === 'high'
                          ? 'bg-rose-100 text-rose-700'
                          : lab.status === 'low'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {lab.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Captured Image / File Thumbnail */}
      {document.fileUrl && (
        <div
          className={`p-3 rounded-xl flex items-center gap-3 border ${
            isDoctorDark
              ? 'bg-slate-900/60 border-slate-750'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <img
            src={document.fileUrl}
            alt={document.title}
            className="w-14 h-14 object-cover rounded-lg border border-slate-300 shrink-0 shadow-xs"
          />
          <div className="text-xs">
            <span className={`font-bold block ${isDoctorDark ? 'text-slate-200' : 'text-slate-800'}`}>
              {language === 'hi' ? 'कैमरा / अपलोड की गई मूल प्रति' : 'Original Captured / Uploaded Image'}
            </span>
            <span className="text-[11px] text-slate-500">
              {language === 'hi'
                ? 'मूल स्कैन डॉक्टर के सत्यापन हेतु उपलब्ध है'
                : 'Digitized image attached to clinical encounter'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
