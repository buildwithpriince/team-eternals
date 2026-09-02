import React, { useEffect, useState } from 'react';
import { CheckCircle2, QrCode, Clock, MapPin, Stethoscope, Printer, MessageSquare, ArrowRight, Sparkles, RefreshCw, UserCheck, AlertTriangle, Volume2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { speechService } from '../../utils/speech';

export const Step8QueueRouted: React.FC = () => {
  const {
    language,
    theme,
    speakText,
    kioskPatient,
    resetKioskFlow,
    setAppView,
    setActiveDoctorPatient,
    patients,
  } = useApp();

  const [isPrinted, setIsPrinted] = useState(false);
  const [isSmsSent, setIsSmsSent] = useState(false);

  const tokenNum = kioskPatient.tokenNumber || 'OPD-302';
  const roomNum = kioskPatient.roomNumber || (kioskPatient.department === 'ayush' ? 'AYUSH Room 202' : 'OPD Room 104');
  const doctorName = kioskPatient.doctorAssigned || (kioskPatient.department === 'ayush' ? 'Dr. Ananya Vaidya, MD (Ayur)' : 'Dr. Rajesh Sharma, MD');
  const waitTime = (kioskPatient.redFlags && kioskPatient.redFlags.length > 0) ? 2 : (kioskPatient.waitTimeMin || 10);
  const hasRedFlag = kioskPatient.redFlags && kioskPatient.redFlags.length > 0;

  const queuePromptHi = `बधाई! आपका टोकन नंबर ${tokenNum} जारी हो गया है। कृपया कमरा नंबर ${roomNum} के बाहर प्रतीक्षा करें। अनुमानित समय लगभग ${waitTime} मिनट है।`;
  const queuePromptEn = `Your consultation token ${tokenNum} is confirmed. Please proceed to ${roomNum}. Estimated wait time is ${waitTime} minutes.`;

  useEffect(() => {
    speechService.playChime('success');
    speakText(language === 'hi' ? queuePromptHi : queuePromptEn, language);
  }, [language]);

  const handleReplayVoice = () => {
    speakText(language === 'hi' ? queuePromptHi : queuePromptEn, language);
  };

  const handlePrintSlip = () => {
    setIsPrinted(true);
    setTimeout(() => setIsPrinted(false), 4000);
  };

  const handleSendSms = () => {
    setIsSmsSent(true);
    setTimeout(() => setIsSmsSent(false), 4000);
  };

  const handleJumpToDoctorView = () => {
    const matched = patients.find((p) => p.tokenNumber === tokenNum || p.id === kioskPatient.id) || patients[0];
    setActiveDoctorPatient(matched);
    setAppView('doctor');
  };

  return (
    <div
      id="step-8-queue-routed-screen"
      className="w-full max-w-3xl mx-auto space-y-8 animate-fadeIn text-center"
    >
      {/* Success Badge */}
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold text-sm shadow-sm">
        <CheckCircle2 className="w-5 h-5 text-emerald-700" />
        <span>
          {language === 'hi'
            ? 'स्वास्थ्य इतिहास सफलतापूर्वक डॉक्टर पोर्टल पर भेजा गया'
            : 'Clinical Summary Routed to Doctor Queue'}
        </span>
      </div>

      {/* Main Token Ticket Card */}
      <div
        className="w-full bg-white rounded-3xl p-6 sm:p-10 border-3 shadow-xl space-y-6 text-left relative overflow-hidden"
        style={{ borderColor: theme.colors.primary }}
      >
        {/* Ticket Header Ribbon */}
        <div
          className="px-6 py-3 -mx-6 -mt-6 sm:-mx-10 sm:-mt-10 text-white flex items-center justify-between"
          style={{ backgroundColor: theme.colors.primary }}
        >
          <span className="font-extrabold text-sm uppercase tracking-wider">
            Swasthya AI • OPD Consultation Ticket
          </span>
          <span className="text-xs font-bold opacity-90">
            {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>

        {/* Big Token Number Display */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-b-2 border-dashed border-slate-200 pb-6">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-slate-500 block">
              {language === 'hi' ? 'आपका ओ.पी.डी. टोकन नंबर' : 'YOUR OPD TOKEN NUMBER'}
            </span>
            <h1
              className="text-5xl sm:text-6xl font-black tracking-tight mt-1"
              style={{ color: theme.colors.textPrimary }}
            >
              {tokenNum}
            </h1>
          </div>

          <div className="flex flex-col items-end">
            <div className="p-3 bg-slate-100 rounded-2xl border border-slate-300 flex items-center gap-3">
              <QrCode className="w-14 h-14 text-slate-800" />
              <div className="text-right text-xs">
                <span className="font-black text-slate-900 block">Scan for Mobile</span>
                <span className="text-slate-500">Live Queue Status</span>
              </div>
            </div>
          </div>
        </div>

        {/* Priority Red Flag Badge if triage fast-tracked */}
        {hasRedFlag && (
          <div className="p-3.5 bg-red-50 border-2 border-red-300 rounded-xl flex items-center gap-3 text-red-900 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span>
              {language === 'hi'
                ? 'प्राथमिकता कतार (Fast-Tracked): सीने में दर्द/गंभीर लक्षण हेतु प्राथमिकता'
                : 'Priority Fast-Track: Flagged for immediate physician triage review'}
            </span>
          </div>
        )}

        {/* Consultation Destination & Wait Time Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-slate-800">
          {/* Room */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
            <div className="flex items-center gap-2 text-cyan-800 text-xs font-bold uppercase tracking-wider">
              <MapPin className="w-4 h-4" />
              <span>{language === 'hi' ? 'कमरा नंबर' : 'OPD Room'}</span>
            </div>
            <p className="text-xl font-extrabold text-slate-950">{roomNum}</p>
            <span className="text-xs text-slate-500">
              {language === 'hi' ? 'भूतल ओ.पी.डी. विंग' : 'Ground Floor Wing'}
            </span>
          </div>

          {/* Doctor Assigned */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
            <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold uppercase tracking-wider">
              <Stethoscope className="w-4 h-4" />
              <span>{language === 'hi' ? 'परामर्श चिकित्सक' : 'Physician'}</span>
            </div>
            <p className="text-base font-extrabold text-slate-950 truncate">{doctorName}</p>
            <span className="text-xs text-slate-500">
              {kioskPatient.department === 'ayush' ? 'Ayurvedic Specialist' : 'Senior Consultant'}
            </span>
          </div>

          {/* Estimated Wait Time */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
            <div className="flex items-center gap-2 text-amber-800 text-xs font-bold uppercase tracking-wider">
              <Clock className="w-4 h-4" />
              <span>{language === 'hi' ? 'अनुमानित समय' : 'Est. Wait Time'}</span>
            </div>
            <p className="text-xl font-extrabold text-slate-950">~{waitTime} {language === 'hi' ? 'मिनट' : 'mins'}</p>
            <span className="text-xs text-slate-500">
              {language === 'hi' ? 'कतार में 2 मरीज आगे' : '2 patients ahead in queue'}
            </span>
          </div>
        </div>

        {/* Patient Demographic Summary strip */}
        <div className="pt-2 flex flex-wrap items-center justify-between text-xs text-slate-600 border-t border-slate-200 gap-2">
          <span>
            <strong>{language === 'hi' ? 'मरीज:' : 'Patient:'}</strong> {kioskPatient.name || 'Anonymous'} ({kioskPatient.age} Yrs / {kioskPatient.gender})
          </span>
          {kioskPatient.phone && (
            <span>
              <strong>{language === 'hi' ? 'मोबाइल:' : 'Phone:'}</strong>{' '}
              {kioskPatient.phone.startsWith('+91')
                ? kioskPatient.phone
                : `+91 ${kioskPatient.phone}`}
            </span>
          )}
          {kioskPatient.abhaId && (
            <span>
              <strong>ABHA ID:</strong> {kioskPatient.abhaId}
            </span>
          )}
        </div>
      </div>

      {/* Ticket Actions: Speak, Print & SMS */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          id="btn-replay-token-voice"
          type="button"
          onClick={handleReplayVoice}
          className="px-6 py-3.5 bg-cyan-50 hover:bg-cyan-100 border-2 border-cyan-300 rounded-xl font-bold text-cyan-950 text-sm sm:text-base flex items-center gap-2 shadow-sm cursor-pointer"
        >
          <Volume2 className="w-5 h-5 text-cyan-800" />
          <span>
            {language === 'hi' ? 'आवाज में पुनः सुनें' : 'Replay Audio'}
          </span>
        </button>

        <button
          id="btn-print-token-slip"
          type="button"
          onClick={handlePrintSlip}
          className="px-6 py-3.5 bg-white hover:bg-slate-50 border-2 border-slate-300 rounded-xl font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2 shadow-sm cursor-pointer"
        >
          <Printer className="w-5 h-5 text-slate-700" />
          <span>
            {isPrinted
              ? language === 'hi'
                ? 'पर्चा प्रिंट हो रहा है...'
                : 'Printing Slip...'
              : language === 'hi'
              ? 'टोकन पर्चा प्रिंट करें'
              : 'Print Token Slip'}
          </span>
        </button>

        <button
          id="btn-send-sms-token"
          type="button"
          onClick={handleSendSms}
          className="px-6 py-3.5 bg-white hover:bg-slate-50 border-2 border-slate-300 rounded-xl font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2 shadow-sm cursor-pointer"
        >
          <MessageSquare className="w-5 h-5 text-emerald-700" />
          <span>
            {isSmsSent
              ? language === 'hi'
                ? 'SMS भेज दिया गया!'
                : 'SMS Dispatched!'
              : language === 'hi'
              ? 'मोबाइल पर SMS प्राप्त करें'
              : 'Send SMS Alert'}
          </span>
        </button>
      </div>

      {/* Evaluator Highlight Action to jump to Doctor Dashboard */}
      <div className="p-6 bg-slate-900 text-white rounded-2xl shadow-xl space-y-3 text-left border-2 border-cyan-500">
        <div className="flex items-center gap-2 text-cyan-300 font-extrabold text-xs uppercase tracking-wider">
          <Sparkles className="w-4 h-4" />
          <span>Hackathon Evaluation Shortcut / Demo Handshake</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-lg font-bold text-white">
              View this patient on the Doctor Dashboard
            </h4>
            <p className="text-xs text-slate-300 font-medium">
              See the instant structured clinical summary, inline edits, and document timeline prepared for Dr. Sharma / Dr. Vaidya.
            </p>
          </div>

          <button
            id="btn-evaluator-open-doctor-summary"
            type="button"
            onClick={handleJumpToDoctorView}
            className="px-6 py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl text-sm flex items-center gap-2 shadow-md cursor-pointer shrink-0"
          >
            <UserCheck className="w-5 h-5" />
            <span>Open in Doctor Dashboard</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Return to Kiosk for next patient */}
      <div className="pt-4">
        <button
          id="btn-kiosk-new-patient"
          type="button"
          onClick={resetKioskFlow}
          className="px-8 py-4 rounded-xl font-extrabold text-base bg-slate-200 hover:bg-slate-300 text-slate-800 cursor-pointer transition-colors"
        >
          {language === 'hi'
            ? 'अगले मरीज के लिए कियोस्क रीसेट करें (New Patient)'
            : 'Start New Patient Intake'}
        </button>
      </div>
    </div>
  );
};
