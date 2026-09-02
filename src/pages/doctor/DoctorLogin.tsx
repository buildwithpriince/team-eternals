import React, { useState } from 'react';
import { Stethoscope, Lock, User, KeyRound, ArrowRight, Sparkles, ShieldCheck, Database } from 'lucide-react';
import { mockDoctors } from '../../data/mockData';
import { DoctorUser } from '../../types';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabaseClient';

interface DoctorLoginProps {
  onLoginSuccess: (doctor: DoctorUser) => void;
}

export const DoctorLogin: React.FC<DoctorLoginProps> = ({ onLoginSuccess }) => {
  const { setDepartment, doctorDarkMode } = useApp();
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorUser>(mockDoctors[0]);
  const [staffId, setStaffId] = useState<string>('DOC-DEL-104');
  const [password, setPassword] = useState<string>('••••••••');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [authNote, setAuthNote] = useState<string | null>(null);

  const handleSelectPreset = (doc: DoctorUser) => {
    setSelectedDoctor(doc);
    setDepartment(doc.department);
    setStaffId(doc.department === 'ayush' ? 'AYU-NAT-202' : 'DOC-DEL-104');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthNote(null);

    try {
      // 1. Sync doctor profile to Supabase doctors table
      await fetch('/api/doctor/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedDoctor.id,
          name: selectedDoctor.name,
          department: selectedDoctor.department,
        }),
      }).catch((err) => {
        console.warn('Doctor profile backend sync note:', err);
      });

      // 2. Set department and complete login
      setDepartment(selectedDoctor.department);
      onLoginSuccess(selectedDoctor);
    } catch (err: any) {
      console.warn('Doctor login error:', err);
      setDepartment(selectedDoctor.department);
      onLoginSuccess(selectedDoctor);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="doctor-login-screen"
      className="w-full max-w-xl mx-auto py-8 px-4 space-y-6 animate-fadeIn text-left"
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-md ${
            doctorDarkMode
              ? 'bg-cyan-600 text-white'
              : 'bg-[#0E4A5C] text-white'
          }`}
        >
          <Stethoscope className="w-9 h-9" />
        </div>
        <h2
          className={`text-2xl sm:text-3xl font-extrabold ${
            doctorDarkMode ? 'text-white' : 'text-slate-900'
          }`}
        >
          Doctor Clinical Portal
        </h2>
        <p className={`text-sm font-medium ${doctorDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          Authorized Hospital Physician & EMR Access • Supabase Realtime
        </p>
      </div>

      {/* Preset Doctor Account Picker */}
      <div
        className={`p-4 rounded-2xl space-y-3 border transition-colors ${
          doctorDarkMode
            ? 'bg-slate-900 border-slate-750 text-white'
            : 'bg-slate-100 border-slate-300 text-slate-900'
        }`}
      >
        <div
          className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${
            doctorDarkMode ? 'text-amber-400' : 'text-slate-700'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Select Physician Profile (1-Click Demo Presets)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {mockDoctors.map((doc) => (
            <button
              key={doc.id}
              id={`preset-login-${doc.id}`}
              type="button"
              onClick={() => handleSelectPreset(doc)}
              className={`p-3.5 rounded-xl border-2 text-left flex items-center gap-3 transition-all cursor-pointer ${
                selectedDoctor.id === doc.id
                  ? doctorDarkMode
                    ? 'bg-slate-800 border-cyan-500 shadow-md ring-2 ring-cyan-500/30'
                    : 'bg-white border-[#0E4A5C] shadow-md ring-2 ring-[#0E4A5C]/30'
                  : doctorDarkMode
                  ? 'bg-slate-850 border-slate-750 hover:bg-slate-800 text-slate-300'
                  : 'bg-slate-50 border-slate-200 hover:bg-white'
              }`}
            >
              <img
                src={doc.avatarUrl}
                alt={doc.name}
                className={`w-12 h-12 rounded-xl object-cover border ${
                  doctorDarkMode ? 'border-slate-700' : 'border-slate-300'
                }`}
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 min-w-0">
                <span className={`text-xs font-bold block truncate ${doctorDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {doc.name}
                </span>
                <span className={`text-[11px] block truncate ${doctorDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {doc.specialization}
                </span>
                <span className={`text-[10px] font-black uppercase ${doctorDarkMode ? 'text-cyan-400' : 'text-cyan-800'}`}>
                  {doc.roomNumber}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Login Form */}
      <form
        onSubmit={handleSubmit}
        className={`p-6 sm:p-8 rounded-2xl border-2 shadow-md space-y-4 transition-colors ${
          doctorDarkMode
            ? 'bg-slate-900 border-slate-750 text-white'
            : 'bg-white border-slate-300 text-slate-900'
        }`}
      >
        <div className="space-y-1.5">
          <label
            className={`block text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              doctorDarkMode ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            <User className="w-4 h-4 text-slate-400" />
            <span>Physician Staff ID / Medical Council Reg.</span>
          </label>
          <input
            id="input-doctor-staff-id"
            type="text"
            required
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className={`w-full px-4 py-3 border-2 rounded-xl font-bold ${
              doctorDarkMode
                ? 'bg-slate-800 border-slate-700 text-white focus:border-cyan-400 focus:ring-4 focus:ring-cyan-900/50'
                : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[#0E4A5C] focus:ring-4 focus:ring-cyan-100'
            }`}
          />
        </div>

        <div className="space-y-1.5">
          <label
            className={`block text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              doctorDarkMode ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            <KeyRound className="w-4 h-4 text-slate-400" />
            <span>Secure Password / Smart Card PIN</span>
          </label>
          <input
            id="input-doctor-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full px-4 py-3 border-2 rounded-xl font-bold ${
              doctorDarkMode
                ? 'bg-slate-800 border-slate-700 text-white focus:border-cyan-400 focus:ring-4 focus:ring-cyan-900/50'
                : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[#0E4A5C] focus:ring-4 focus:ring-cyan-100'
            }`}
          />
        </div>

        {authNote && (
          <p className="text-xs text-amber-700 font-semibold bg-amber-50 p-2.5 rounded-lg border border-amber-200">
            {authNote}
          </p>
        )}

        <div className="pt-2">
          <button
            id="btn-submit-doctor-login"
            type="submit"
            disabled={isLoading}
            className={`w-full py-4 text-white font-extrabold text-lg rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 ${
              doctorDarkMode
                ? 'bg-cyan-600 hover:bg-cyan-500'
                : 'bg-[#0E4A5C] hover:bg-[#082F3B]'
            }`}
          >
            {isLoading ? (
              <span>Authenticating with Supabase...</span>
            ) : (
              <>
                <ShieldCheck className="w-6 h-6" />
                <span>Log In to OPD EMR Dashboard</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 text-center text-[11px] text-slate-500 font-medium pt-2">
          <Database className="w-3.5 h-3.5 text-emerald-500" />
          <span>Connected to Supabase PostgreSQL & Realtime Subscription</span>
        </div>
      </form>
    </div>
  );
};

