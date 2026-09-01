import React, { useEffect } from 'react';
import { CheckCircle2, Volume2, ArrowRight, ArrowLeft, AlertTriangle, FileText, Stethoscope, Edit3 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { VoicePrompter } from '../../components/VoicePrompter';
import { PatientHistoryAnswer } from '../../types';

export const Step6SummaryConfirmation: React.FC = () => {
  const {
    language,
    theme,
    speakText,
    kioskPatient,
    setCurrentKioskStep,
  } = useApp();

  const answers: Record<string, PatientHistoryAnswer> = kioskPatient.historyAnswers || {};
  const hasRedFlags = kioskPatient.redFlags && kioskPatient.redFlags.length > 0;
  const docsCount = kioskPatient.scannedDocs?.length || 0;

  // Build audio summary script
  const audioSummaryHi = `आपके द्वारा दर्ज की गई जानकारी: मुख्य तकलीफ ${
    kioskPatient.chiefComplaints?.[0] || 'स्वास्थ्य जांच'
  } है। ${docsCount} दस्तावेज़ संलग्न हैं। यदि यह सही है, तो कृपया पुष्टि करें।`;

  const audioSummaryEn = `Here is your recorded summary: Primary complaint is ${
    kioskPatient.chiefComplaints?.[0] || 'Routine consultation'
  }. ${docsCount} medical documents attached. Please confirm to proceed to token allocation.`;

  useEffect(() => {
    speakText(language === 'hi' ? audioSummaryHi : audioSummaryEn, language);
  }, [language]);

  return (
    <div
      id="step-6-summary-screen"
      className="w-full max-w-4xl mx-auto space-y-6 animate-fadeIn text-left"
    >
      <VoicePrompter
        promptEn={audioSummaryEn}
        promptHi={audioSummaryHi}
      />

      {/* Title */}
      <div>
        <h2
          className="text-2xl sm:text-3xl font-extrabold"
          style={{ color: theme.colors.textPrimary }}
        >
          {language === 'hi'
            ? 'आपके विवरण का संक्षिप्त सारांश'
            : 'Review Recorded Health Summary'}
        </h2>
        <p className="text-sm sm:text-base text-slate-600 font-medium mt-1">
          {language === 'hi'
            ? 'कृपया एक बार जांच लें कि क्या सभी बातें सही दर्ज हुई हैं'
            : 'Confirm that your reported history is accurate before assigning token'}
        </p>
      </div>

      {/* Red Flag Warning Notice if present */}
      {hasRedFlags && (
        <div className="p-5 bg-red-50 border-2 border-red-300 rounded-2xl flex items-start gap-4">
          <AlertTriangle className="w-8 h-8 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-base sm:text-lg font-bold text-red-900">
              {language === 'hi'
                ? 'प्राथमिकता अलर्ट: डॉक्टर को सूचित किया गया है'
                : 'Priority Notice: Fast-Track Alert Sent to Doctor'}
            </h4>
            <p className="text-xs sm:text-sm text-red-800 font-medium">
              {language === 'hi'
                ? 'आपके द्वारा बताए गए लक्षणों के आधार पर आपको कतार में उच्च प्राथमिकता दी जा रही है।'
                : 'Based on your reported warning symptoms, your consultation token is marked for priority clinical review.'}
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Chief Complaints & Symptoms */}
        <div
          className="p-6 bg-white rounded-2xl border-2 space-y-4 shadow-sm"
          style={{ borderColor: theme.colors.borderDefault }}
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <Stethoscope className="w-5 h-5 text-cyan-700" />
              <span>
                {language === 'hi' ? 'मुख्य समस्या एवं अवधि' : 'Chief Complaint & History'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setCurrentKioskStep(4)}
              className="text-xs font-bold text-cyan-800 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'संशोधन' : 'Edit'}</span>
            </button>
          </div>

          <div className="space-y-3">
            {Object.entries(answers).map(([key, item]) => (
              <div key={key} className="p-3 bg-slate-50 rounded-xl space-y-1 border border-slate-200">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {language === 'hi' ? item.question_hi : item.question_en}
                </span>
                <p className="text-base font-bold text-slate-900 leading-snug">
                  {language === 'hi' ? item.answer_hi : item.answer_en}
                </p>
              </div>
            ))}

            {Object.keys(answers).length === 0 && (
              <p className="text-sm text-slate-500 italic">
                {language === 'hi' ? 'सामान्य परामर्श दर्ज' : 'General clinical consultation logged.'}
              </p>
            )}
          </div>
        </div>

        {/* Card 2: Attached Documents & Triage Dept */}
        <div
          className="p-6 bg-white rounded-2xl border-2 space-y-4 shadow-sm flex flex-col justify-between"
          style={{ borderColor: theme.colors.borderDefault }}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                <FileText className="w-5 h-5 text-emerald-700" />
                <span>
                  {language === 'hi' ? 'संलग्न मेडिकल पर्चियां' : 'Digitized Prescriptions'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCurrentKioskStep(5)}
                className="text-xs font-bold text-cyan-800 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{language === 'hi' ? 'जोड़ें/हटाएं' : 'Add/Remove'}</span>
              </button>
            </div>

            {kioskPatient.scannedDocs && kioskPatient.scannedDocs.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {kioskPatient.scannedDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 bg-emerald-50/60 border border-emerald-300 rounded-xl space-y-1 text-xs"
                  >
                    <span className="font-bold text-emerald-950 block text-sm">
                      {doc.title}
                    </span>
                    <p className="text-slate-600 font-medium">
                      {doc.facility} • OCR {doc.confidence}%
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-500 font-medium">
                {language === 'hi'
                  ? 'कोई पुरानी पर्ची संलग्न नहीं की गई'
                  : 'No past documents attached.'}
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-100 rounded-xl mt-4">
            <span className="text-xs font-bold uppercase text-slate-500 block">
              {language === 'hi' ? 'लक्षित ओ.पी.डी. कमरा:' : 'Target OPD Room:'}
            </span>
            <span className="text-base font-black text-slate-900">
              {kioskPatient.roomNumber || 'OPD Room 104'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={() => setCurrentKioskStep(5)}
          className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-slate-300 text-slate-700 font-bold flex items-center justify-center gap-2 hover:bg-slate-100 cursor-pointer text-base"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>{language === 'hi' ? 'पीछे' : 'Back'}</span>
        </button>

        <button
          id="btn-confirm-summary-proceed"
          type="button"
          onClick={() => setCurrentKioskStep(7)}
          className="w-full sm:w-auto px-10 py-4 rounded-2xl font-extrabold text-xl text-white shadow-xl flex items-center justify-center gap-3 transition-all transform active:scale-95 cursor-pointer min-h-[64px]"
          style={{ backgroundColor: theme.colors.primary }}
        >
          <span>
            {language === 'hi'
              ? 'सब सही है — पहचान दर्ज करें (Confirm & Next)'
              : 'Looks Accurate — Proceed to Identify'}
          </span>
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
