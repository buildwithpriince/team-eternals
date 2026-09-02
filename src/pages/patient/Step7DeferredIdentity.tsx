import React, { useState, useEffect } from 'react';
import { User, Phone, Calendar, ArrowRight, ArrowLeft, Mic, Sparkles, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { VoicePrompter } from '../../components/VoicePrompter';
import { AbhaIdInput } from '../../components/AbhaIdInput';

export const Step7DeferredIdentity: React.FC = () => {
  const {
    language,
    theme,
    speakText,
    stopSpeaking,
    kioskPatient,
    updateKioskPatient,
    completeKioskFlow,
    setCurrentKioskStep,
  } = useApp();

  const [name, setName] = useState<string>(kioskPatient.name || '');
  const [age, setAge] = useState<string | number>(kioskPatient.age || '');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>(kioskPatient.gender || 'male');
  const [phone, setPhone] = useState<string>(kioskPatient.phone || '');
  const [abhaId, setAbhaId] = useState<string>(kioskPatient.abhaId || '');

  const idPromptHi =
    'कृपया अपना नाम, उम्र और मोबाइल नंबर बताएं ताकि हम आपका पर्चा (ओ.पी.डी. टोकन) बना सकें।';
  const idPromptEn =
    'Please provide your name, age, and phone number so we can generate your OPD consultation token.';

  useEffect(() => {
    speakText(language === 'hi' ? idPromptHi : idPromptEn, language);
  }, [language]);

  const handleVoiceCaptureIdentity = (transcript: string) => {
    if (!transcript || !transcript.trim()) return;
    const cleanText = transcript.trim();

    // Look for age in spoken transcript
    const ageMatch =
      cleanText.match(/(?:age|umar|उम्र)\s*(?:is|hai|है|:)?\s*(\d{1,3})/i) ||
      cleanText.match(/(\d{1,3})\s*(?:years?|saal|yrs|वर्ष|साल)/i);
    if (ageMatch && ageMatch[1]) {
      const parsedSpokenAge = parseInt(ageMatch[1], 10);
      if (parsedSpokenAge > 0 && parsedSpokenAge < 120) {
        setAge(parsedSpokenAge);
      }
    }

    // Look for 10-digit phone in transcript
    const digitsOnly = cleanText.replace(/\D/g, '');
    if (digitsOnly.length === 10) {
      setPhone(digitsOnly);
    }

    // Extract spoken name
    const cleanedName = cleanText
      .replace(/my name is/gi, '')
      .replace(/mera naam/gi, '')
      .replace(/mera nam/gi, '')
      .replace(/मेरा नाम/gi, '')
      .replace(/hai/gi, '')
      .replace(/है/gi, '')
      .replace(/aur/gi, '')
      .replace(/and/gi, '')
      .replace(/(?:age|umar|उम्र)\s*(?:is|hai|है|:)?\s*\d{1,3}/gi, '')
      .replace(/\d{1,3}\s*(?:years?|saal|yrs|वर्ष|साल)/gi, '')
      .replace(/\d{10}/g, '')
      .replace(/[.,]/g, '')
      .trim();

    if (cleanedName && cleanedName.length > 1 && !name) {
      setName(cleanedName);
    }

    console.log('[Step7] Voice captured identity transcript:', {
      transcript,
      extracted: { name: cleanedName, age: ageMatch?.[1], phone: digitsOnly.length === 10 ? digitsOnly : undefined },
    });
  };

  const handleQuickAutofillElderly = () => {
    setName('Shanti Devi');
    setAge(64);
    setGender('female');
    setPhone('98112 34567');
    setAbhaId('45-9201-8374-1102');
  };

  const handleSubmitIdentity = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = (name || '').trim();
    const cleanAge =
      typeof age === 'number'
        ? age
        : age && String(age).trim() !== ''
        ? parseInt(String(age).trim(), 10) || null
        : null;

    let cleanPhone = (phone || '').trim();
    if (cleanPhone) {
      const digits = cleanPhone.replace(/\D/g, '');
      if (digits.length === 10) {
        cleanPhone = `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
      } else if (digits.length === 12 && digits.startsWith('91')) {
        const ten = digits.slice(2);
        cleanPhone = `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
      } else if (!cleanPhone.startsWith('+') && digits.length >= 7) {
        cleanPhone = `+91 ${cleanPhone}`;
      }
    }

    const cleanAbha = (abhaId || '').trim();

    const identityPayload: Partial<typeof kioskPatient> = {
      name: cleanName || (language === 'hi' ? 'मरीज' : 'Patient'),
      age: cleanAge ?? (language === 'hi' ? 45 : 45),
      gender,
      phone: cleanPhone || '',
      abhaId: cleanAbha || '',
    };

    console.log('[Step7 Sign-Up] Form submitted with patient identity:', {
      rawTypedState: { name, age, gender, phone, abhaId },
      preparedPayload: identityPayload,
      targetPatientId: kioskPatient.id,
    });

    stopSpeaking();
    updateKioskPatient(identityPayload);
    completeKioskFlow(identityPayload);
    setCurrentKioskStep(8);
  };

  return (
    <div
      id="step-7-deferred-identity-screen"
      className="w-full max-w-3xl mx-auto space-y-6 animate-fadeIn text-left"
    >
      <VoicePrompter
        promptEn={idPromptEn}
        promptHi={idPromptHi}
        onVoiceInput={handleVoiceCaptureIdentity}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-2xl sm:text-3xl font-extrabold"
            style={{ color: theme.colors.textPrimary }}
          >
            {language === 'hi'
              ? 'मरीज का नाम एवं पहचान (Patient Identification)'
              : 'Patient Information & Registration'}
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-medium mt-1">
            {language === 'hi'
              ? 'अंतिम चरण: ओ.पी.डी. टोकन रसीद के लिए अपना विवरण दें'
              : 'Final Step: Provide details for your digital OPD consultation ticket'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleQuickAutofillElderly}
          className="text-xs font-bold text-cyan-800 hover:text-cyan-950 bg-cyan-50 border border-cyan-300 px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{language === 'hi' ? 'डेमो मरीज भरें' : 'Demo Fill'}</span>
        </button>
      </div>

      <form onSubmit={handleSubmitIdentity} className="space-y-6">
        {/* Main Details Card */}
        <div
          className="p-6 sm:p-8 bg-white rounded-2xl border-2 space-y-5 shadow-sm"
          style={{ borderColor: theme.colors.borderDefault }}
        >
          {/* Patient Full Name */}
          <div className="space-y-2">
            <label className="block text-base font-extrabold text-slate-900 flex items-center gap-2">
              <User className="w-5 h-5 text-cyan-700" />
              <span>{language === 'hi' ? 'मरीज का पूरा नाम (Full Name) *' : 'Patient Full Name *'}</span>
            </label>
            <input
              id="input-patient-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={language === 'hi' ? 'उदा. शांति देवी / राजेश शर्मा' : 'e.g. Shanti Devi / Rajesh Sharma'}
              className="w-full px-4 py-3.5 text-lg font-bold bg-slate-50 rounded-xl border-2 border-slate-300 focus:border-cyan-700 focus:ring-4 focus:ring-cyan-100 text-slate-900"
            />
          </div>

          {/* Age and Gender Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Age */}
            <div className="space-y-2">
              <label className="block text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-700" />
                <span>{language === 'hi' ? 'उम्र (वर्ष) / Age *' : 'Age (in Years) *'}</span>
              </label>
              <input
                id="input-patient-age"
                type="number"
                required
                min={1}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="उदा. 58"
                className="w-full px-4 py-3.5 text-lg font-bold bg-slate-50 rounded-xl border-2 border-slate-300 focus:border-cyan-700 focus:ring-4 focus:ring-cyan-100 text-slate-900"
              />
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <label className="block text-base font-extrabold text-slate-900">
                {language === 'hi' ? 'लिंग (Gender) *' : 'Gender *'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['male', 'female', 'other'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`py-3.5 rounded-xl border-2 font-bold text-sm sm:text-base cursor-pointer transition-all ${
                      gender === g
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {g === 'male'
                      ? language === 'hi'
                        ? 'पुरुष'
                        : 'Male'
                      : g === 'female'
                      ? language === 'hi'
                        ? 'महिला'
                        : 'Female'
                      : language === 'hi'
                      ? 'अन्य'
                      : 'Other'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Phone Number */}
          <div className="space-y-2">
            <label className="block text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Phone className="w-5 h-5 text-emerald-700" />
              <span>{language === 'hi' ? 'मोबाइल नंबर (SMS टोकन हेतु) *' : 'Mobile Number (for SMS & Token) *'}</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-3.5 font-bold text-slate-500 text-lg">
                +91
              </span>
              <input
                id="input-patient-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98765 43210"
                className="w-full pl-16 pr-4 py-3.5 text-lg font-bold bg-slate-50 rounded-xl border-2 border-slate-300 focus:border-cyan-700 focus:ring-4 focus:ring-cyan-100 text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* ABHA ID Section (Mocked ABDM Integration) */}
        <AbhaIdInput
          value={abhaId}
          onChange={setAbhaId}
          onVerified={(demo) => {
            if (!name) setName(demo.name);
            if (!age) setAge(demo.age);
            if (demo.gender) setGender(demo.gender);
          }}
        />

        {/* Navigation / Submit Action */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setCurrentKioskStep(6)}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-slate-300 text-slate-700 font-bold flex items-center justify-center gap-2 hover:bg-slate-100 cursor-pointer text-base"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{language === 'hi' ? 'पीछे' : 'Back'}</span>
          </button>

          <button
            id="btn-submit-identity-token"
            type="submit"
            className="w-full sm:w-auto px-10 py-4 rounded-2xl font-extrabold text-xl text-white shadow-xl flex items-center justify-center gap-3 transition-all transform active:scale-95 cursor-pointer min-h-[64px]"
            style={{ backgroundColor: theme.colors.primary }}
          >
            <CheckCircle2 className="w-7 h-7" />
            <span>
              {language === 'hi'
                ? 'ओ.पी.डी. टोकन प्राप्त करें (Generate Token)'
                : 'Generate OPD Token & Route'}
            </span>
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      </form>
    </div>
  );
};
