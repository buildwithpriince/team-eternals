import React, { useState } from 'react';
import { AlertOctagon, HeartHandshake, PhoneCall, Accessibility, CheckCircle2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const EmergencyModal: React.FC = () => {
  const { isEmergencyModalOpen, setIsEmergencyModalOpen, language, theme, stopSpeaking } = useApp();
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);

  if (!isEmergencyModalOpen) return null;

  const handleAction = (type: string, msgEn: string, msgHi: string) => {
    setDispatchStatus(language === 'hi' ? msgHi : msgEn);
  };

  const handleClose = () => {
    stopSpeaking();
    setDispatchStatus(null);
    setIsEmergencyModalOpen(false);
  };

  return (
    <div
      id="emergency-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div
        id="emergency-modal-card"
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border-4 overflow-hidden"
        style={{ borderColor: theme.colors.alertRed }}
      >
        {/* Header */}
        <div
          className="p-6 text-white flex items-center justify-between"
          style={{ backgroundColor: theme.colors.alertRed }}
        >
          <div className="flex items-center gap-3">
            <AlertOctagon className="w-9 h-9 shrink-0 animate-bounce" />
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">
                {language === 'hi' ? 'आपातकालीन सहायता डेस्क' : 'Immediate Emergency Assistance'}
              </h2>
              <p className="text-sm sm:text-base text-red-100 font-medium">
                {language === 'hi'
                  ? 'घबराएं नहीं — अस्पताल स्टाफ आपकी मदद के लिए उपस्थित है'
                  : 'Do not panic — hospital triage staff has been notified'}
              </p>
            </div>
          </div>
          <button
            id="btn-close-emergency-modal"
            onClick={handleClose}
            className="p-2 text-white hover:bg-red-800 rounded-full cursor-pointer focus:ring-2 focus:ring-white"
            aria-label="Close"
          >
            <X className="w-7 h-7" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-6">
          {dispatchStatus ? (
            <div className="p-6 bg-emerald-50 border-2 border-emerald-500 rounded-xl text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto animate-pulse" />
              <h3 className="text-xl font-bold text-emerald-900">
                {language === 'hi' ? 'सहायता रवाना हो चुकी है!' : 'Help Dispatched Immediately!'}
              </h3>
              <p className="text-base text-emerald-800 font-medium">{dispatchStatus}</p>
              <div className="pt-2">
                <button
                  id="btn-confirm-emergency-dismiss"
                  onClick={handleClose}
                  className="px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl cursor-pointer text-base"
                >
                  {language === 'hi' ? 'ठीक है (Return)' : 'Understood (Return)'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-base sm:text-lg text-slate-800 font-semibold leading-relaxed">
                {language === 'hi'
                  ? 'यदि मरीज को असहनीय दर्द, सीने में भारीपन, सांस लेने में अत्यधिक तकलीफ या बेहोशी है, तो नीचे से सीधे चयन करें:'
                  : 'If the patient has severe chest pain, extreme breathlessness, severe bleeding or fainting, select immediate action below:'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Nurse / Doctor Dispatch */}
                <button
                  id="btn-emergency-nurse"
                  onClick={() =>
                    handleAction(
                      'nurse',
                      'OPD Triage Nurse has been alerted and is walking to Kiosk Station 1.',
                      'ओ.पी.डी. नर्सिंग स्टाफ को सूचित कर दिया गया है, स्टाफ तुरंत कियोस्क पर आ रहा है।'
                    )
                  }
                  className="p-5 bg-red-50 hover:bg-red-100 border-2 border-red-300 rounded-xl flex flex-col items-center text-center gap-3 active:scale-95 transition-transform cursor-pointer"
                >
                  <PhoneCall className="w-10 h-10 text-red-600" />
                  <span className="font-bold text-slate-900 text-base">
                    {language === 'hi' ? 'स्टाफ को बुलाएं' : 'Call Nurse / Doctor'}
                  </span>
                  <span className="text-xs text-slate-600">
                    {language === 'hi' ? 'कियोस्क पर तुरंत मदद' : 'Direct to Kiosk'}
                  </span>
                </button>

                {/* 2. Wheelchair Assistance */}
                <button
                  id="btn-emergency-wheelchair"
                  onClick={() =>
                    handleAction(
                      'wheelchair',
                      'Wheelchair with orderly has been requested for this kiosk.',
                      'व्हीलचेयर और सहायक को इस कियोस्क के लिए रवाना किया गया है।'
                    )
                  }
                  className="p-5 bg-amber-50 hover:bg-amber-100 border-2 border-amber-300 rounded-xl flex flex-col items-center text-center gap-3 active:scale-95 transition-transform cursor-pointer"
                >
                  <Accessibility className="w-10 h-10 text-amber-700" />
                  <span className="font-bold text-slate-900 text-base">
                    {language === 'hi' ? 'व्हीलचेयर चाहिए' : 'Request Wheelchair'}
                  </span>
                  <span className="text-xs text-slate-600">
                    {language === 'hi' ? 'चलने में असमर्थ' : 'Mobility assistance'}
                  </span>
                </button>

                {/* 3. Casualty Direct Route */}
                <button
                  id="btn-emergency-casualty"
                  onClick={() =>
                    handleAction(
                      'casualty',
                      'Direct green corridor activated for Casualty / Emergency Ward (Ground Floor Room 02).',
                      'इमरजेंसी वार्ड (भूतल कमरा 02) के लिए सीधे ग्रीन कॉरिडोर सक्रिय किया गया है।'
                    )
                  }
                  className="p-5 bg-rose-50 hover:bg-rose-100 border-2 border-rose-400 rounded-xl flex flex-col items-center text-center gap-3 active:scale-95 transition-transform cursor-pointer"
                >
                  <HeartHandshake className="w-10 h-10 text-rose-700" />
                  <span className="font-bold text-slate-900 text-base">
                    {language === 'hi' ? 'सीधे इमरजेंसी जाएं' : 'Casualty / ICU'}
                  </span>
                  <span className="text-xs text-slate-600">
                    {language === 'hi' ? 'आपातकालीन वार्ड' : 'Priority Red Corridor'}
                  </span>
                </button>
              </div>

              <div className="pt-2 flex justify-between items-center border-t border-slate-200">
                <span className="text-xs text-slate-500 font-medium">
                  {language === 'hi' ? 'हेल्पलाइन नंबर: 108 / 011-26588500' : 'Emergency Hospital Line: 108'}
                </span>
                <button
                  id="btn-cancel-emergency-dialog"
                  onClick={handleClose}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer text-sm"
                >
                  {language === 'hi' ? 'गलती से दबा / वापस जाएं' : 'Cancel / Return to Kiosk'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
