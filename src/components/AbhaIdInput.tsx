import React, { useState } from 'react';
import { CreditCard, CheckCircle2, ShieldCheck, RefreshCw, KeyRound } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface AbhaIdInputProps {
  value: string;
  onChange: (value: string) => void;
  onVerified?: (demographics: { name: string; age: number; gender: 'male' | 'female'; abhaAddress: string }) => void;
}

export const AbhaIdInput: React.FC<AbhaIdInputProps> = ({
  value,
  onChange,
  onVerified,
}) => {
  const { language, theme } = useApp();
  const [isVerifying, setIsVerifying] = useState(false);
  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [isVerified, setIsVerified] = useState(!!value && value.length >= 14);

  // Format ABHA as 14 digits XX-XXXX-XXXX-XXXX
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 14);
    let formatted = '';
    if (raw.length > 0) formatted += raw.substring(0, 2);
    if (raw.length > 2) formatted += '-' + raw.substring(2, 6);
    if (raw.length > 6) formatted += '-' + raw.substring(6, 10);
    if (raw.length > 10) formatted += '-' + raw.substring(10, 14);
    onChange(formatted);
    setIsVerified(false);
  };

  const handleSendOtp = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setShowOtpDialog(true);
    }, 600);
  };

  const handleConfirmOtp = () => {
    setIsVerified(true);
    setShowOtpDialog(false);
    if (onVerified) {
      onVerified({
        name: 'Rajesh Kumar Meena',
        age: 52,
        gender: 'male',
        abhaAddress: 'rajesh.meena@abdm',
      });
    }
  };

  const handleAutofillDemoAbha = () => {
    const demoAbha = '91-4820-1928-3481';
    onChange(demoAbha);
    setIsVerified(true);
    if (onVerified) {
      onVerified({
        name: 'Ram Lal Sharma',
        age: 67,
        gender: 'male',
        abhaAddress: 'ramlal67@abdm',
      });
    }
  };

  return (
    <div
      id="abha-id-section"
      className="p-5 sm:p-6 bg-slate-50 border-2 rounded-2xl space-y-4"
      style={{ borderColor: isVerified ? theme.colors.success : theme.colors.borderDefault }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-blue-100 text-blue-900 rounded-xl">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              {language === 'hi'
                ? 'आयुष्मान भारत हेल्थ अकाउंट (ABHA ID)'
                : 'Ayushman Bharat Health Account (ABHA ID)'}
            </h4>
            <p className="text-xs text-slate-600 font-medium">
              {language === 'hi'
                ? '14 अंकों का आभा नंबर (वैकल्पिक / Optional)'
                : '14-digit ABHA Number (Optional ABDM link)'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAutofillDemoAbha}
          className="text-xs font-bold text-cyan-800 hover:text-cyan-950 underline cursor-pointer"
        >
          {language === 'hi' ? 'डेमो आभा भरें' : 'Autofill Demo ABHA'}
        </button>
      </div>

      {/* Input + Action */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            id="input-abha-number"
            type="text"
            value={value}
            onChange={handleInputChange}
            placeholder="XX-XXXX-XXXX-XXXX"
            maxLength={17}
            className="w-full px-4 py-3 text-lg sm:text-xl font-mono tracking-widest font-bold bg-white rounded-xl border-2 border-slate-300 focus:border-cyan-700 focus:ring-4 focus:ring-cyan-100 text-slate-900"
          />
          {isVerified && (
            <CheckCircle2 className="w-6 h-6 text-emerald-600 absolute right-4 top-3.5" />
          )}
        </div>

        {!isVerified ? (
          <button
            id="btn-verify-abha-otp"
            type="button"
            disabled={value.replace(/\D/g, '').length < 14 || isVerifying}
            onClick={handleSendOtp}
            className={`px-6 py-3 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              value.replace(/\D/g, '').length >= 14
                ? 'bg-blue-700 hover:bg-blue-800 text-white'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isVerifying ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
            <span>
              {language === 'hi' ? 'OTP सत्यापन करें' : 'Verify via OTP'}
            </span>
          </button>
        ) : (
          <div className="px-4 py-3 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            <span>
              {language === 'hi' ? 'ABDM रिकॉर्ड लिंक हुआ' : 'ABHA Verified & Linked'}
            </span>
          </div>
        )}
      </div>

      {/* Simulated OTP Modal */}
      {showOtpDialog && (
        <div className="p-4 bg-white border-2 border-blue-400 rounded-xl space-y-3 shadow-md animate-fadeIn">
          <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
            <KeyRound className="w-5 h-5" />
            <span>
              {language === 'hi'
                ? 'आधार लिंक मोबाइल पर 6 अंकों का OTP भेजा गया'
                : '6-Digit OTP sent to Aadhaar-linked Mobile'}
            </span>
          </div>
          <p className="text-xs text-slate-600 font-medium">
            (Demo simulation: enter any 6 digits like <strong>123456</strong>)
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={6}
              value={otpValue}
              onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
              placeholder="1 2 3 4 5 6"
              className="px-3 py-2 text-center text-lg font-mono font-bold tracking-widest bg-slate-50 border rounded-lg w-40 text-slate-900"
            />
            <button
              id="btn-confirm-otp"
              type="button"
              onClick={handleConfirmOtp}
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm rounded-lg cursor-pointer"
            >
              {language === 'hi' ? 'पुष्टि करें' : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={() => setShowOtpDialog(false)}
              className="px-3 py-2 text-slate-600 hover:text-slate-800 text-xs font-semibold"
            >
              {language === 'hi' ? 'रद्द करें' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
