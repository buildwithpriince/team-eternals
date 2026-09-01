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
  const { language, theme } = useApp();

  return (
    <div
      id={`doc-card-${document.id}`}
      className="w-full bg-white rounded-2xl p-5 sm:p-6 border-2 shadow-sm space-y-4 text-left transition-all"
      style={{ borderColor: theme.colors.borderDefault }}
    >
      {/* Header with Title, Confidence & Delete */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-start gap-3">
          <div
            className="p-3 rounded-xl shrink-0"
            style={{
              backgroundColor: theme.colors.primaryLight,
              color: theme.colors.primaryDark,
            }}
          >
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-lg font-bold text-slate-900 leading-tight">
                {document.title}
              </h4>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase bg-slate-100 text-slate-700 border border-slate-300">
                {document.type.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {document.facility} • {document.date}
              {document.doctorName ? ` • ${document.doctorName}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* OCR Confidence Tag */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              {language === 'hi' ? `सटीकता: ${document.confidence}%` : `OCR: ${document.confidence}%`}
            </span>
          </span>

          {showRemove && onRemove && (
            <button
              id={`btn-remove-doc-${document.id}`}
              onClick={() => onRemove(document.id)}
              className="p-2 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
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
        <div className="p-3.5 bg-slate-50 rounded-xl space-y-2 border border-slate-200">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Stethoscope className="w-4 h-4 text-cyan-700" />
            <span>
              {language === 'hi' ? 'पहचाने गए रोग व सारांश' : 'Extracted Diagnosis & Summary'}
            </span>
          </div>

          {document.extractedData.diagnoses && document.extractedData.diagnoses.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {document.extractedData.diagnoses.map((diag, i) => (
                <span
                  key={i}
                  className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-white text-slate-800 border border-slate-300 shadow-2xs"
                >
                  {diag}
                </span>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            {document.extractedData.notesSummary}
          </p>
        </div>

        {/* Medicines Extracted OR Lab Values */}
        {document.extractedData.medicines && document.extractedData.medicines.length > 0 ? (
          <div className="p-3.5 bg-slate-50 rounded-xl space-y-2 border border-slate-200">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <Pill className="w-4 h-4 text-emerald-700" />
              <span>
                {language === 'hi' ? 'पहचानी गई दवाइयां (Rx Digitized)' : 'Digitized Prescriptions'}
              </span>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {document.extractedData.medicines.map((med, i) => (
                <div
                  key={i}
                  className="p-2 bg-white rounded-lg border border-slate-200 text-xs flex justify-between items-center"
                >
                  <div>
                    <span className="font-bold text-slate-900">{med.name}</span>
                    <span className="text-slate-500 ml-1">({med.dosage})</span>
                  </div>
                  <span className="text-slate-600 font-medium text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                    {med.frequency}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : document.extractedData.labValues && document.extractedData.labValues.length > 0 ? (
          <div className="p-3.5 bg-slate-50 rounded-xl space-y-2 border border-slate-200">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <Activity className="w-4 h-4 text-rose-700" />
              <span>
                {language === 'hi' ? 'जांच परिणाम (Lab Values)' : 'Digitized Lab Results'}
              </span>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {document.extractedData.labValues.map((lab, i) => (
                <div
                  key={i}
                  className="p-2 bg-white rounded-lg border border-slate-200 text-xs flex justify-between items-center"
                >
                  <span className="font-semibold text-slate-800">{lab.parameter}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-950">
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
    </div>
  );
};
