import React, { useState } from 'react';
import { AlertOctagon, User, Clock, Stethoscope, ChevronRight, Sparkles, Filter, FileText, ArrowUpRight, Activity } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PatientRecord, Department } from '../../types';
import { RedFlagBanner } from '../../components/RedFlagBanner';

interface DoctorQueueProps {
  onSelectPatient: (patient: PatientRecord) => void;
}

export const DoctorQueue: React.FC<DoctorQueueProps> = ({ onSelectPatient }) => {
  const { patients, activeDoctorPatient, loggedInDoctor, kioskPatient } = useApp();
  const [filterDept, setFilterDept] = useState<'all' | Department>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter patients
  const filteredPatients = patients.filter((p) => {
    if (filterDept !== 'all' && p.department !== filterDept) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.tokenNumber.toLowerCase().includes(q) ||
        p.chiefComplaints.some((c) => c.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Separate red-flagged patients to PIN them at the very top
  const redFlaggedPatients = filteredPatients.filter(
    (p) => p.redFlags && p.redFlags.length > 0
  );
  const standardPatients = filteredPatients.filter(
    (p) => !p.redFlags || p.redFlags.length === 0
  );

  return (
    <div id="doctor-queue-container" className="w-full space-y-6 text-left animate-fadeIn">
      {/* Live Red Flag Alert Stream (Surfaces alerts while patients are mid-interview) */}
      <RedFlagBanner />

      {/* Queue Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <span>OPD Patient Triage Queue</span>
            <span className="text-sm font-extrabold px-3 py-1 bg-slate-900 text-white rounded-full">
              {filteredPatients.length} Active
            </span>
          </h2>
          <p className="text-sm text-slate-600 font-medium mt-0.5">
            Real-time structured intake from Swasthya AI Kiosks
          </p>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Department Filter Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-300 text-xs font-bold">
            <button
              type="button"
              onClick={() => setFilterDept('all')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                filterDept === 'all'
                  ? 'bg-white text-slate-950 shadow-xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All OPDs
            </button>
            <button
              type="button"
              onClick={() => setFilterDept('general')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                filterDept === 'general'
                  ? 'bg-cyan-800 text-white shadow-xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              General Medicine
            </button>
            <button
              type="button"
              onClick={() => setFilterDept('ayush')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                filterDept === 'ayush'
                  ? 'bg-emerald-800 text-white shadow-xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              AYUSH & Ayurveda
            </button>
          </div>

          {/* Search input */}
          <input
            id="input-search-queue"
            type="text"
            placeholder="Search name, token..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-400 text-slate-900 w-44"
          />
        </div>
      </div>

      {/* SECTION 1: PINNED RED-FLAGGED PATIENTS (TOP PRIORITY) */}
      {redFlaggedPatients.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-red-700">
            <AlertOctagon className="w-4 h-4 animate-bounce" />
            <span>CRITICAL & RED-FLAGGED TRIAGE (PINNED TO TOP)</span>
          </div>

          <div className="space-y-3">
            {redFlaggedPatients.map((patient) => {
              const isSelected = activeDoctorPatient?.id === patient.id;

              return (
                <div
                  key={patient.id}
                  id={`patient-card-${patient.id}`}
                  onClick={() => onSelectPatient(patient)}
                  className={`w-full p-5 sm:p-6 rounded-2xl border-2 cursor-pointer transition-all active:scale-[0.99] relative overflow-hidden shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                    isSelected
                      ? 'bg-red-50 border-red-600 ring-2 ring-red-400'
                      : 'bg-white hover:bg-red-50/50 border-red-300'
                  }`}
                >
                  {/* Left priority color bar */}
                  <div className="absolute left-0 top-0 bottom-0 w-2 bg-red-600" />

                  {/* Patient Info */}
                  <div className="space-y-1.5 pl-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="px-3 py-1 bg-red-600 text-white font-black text-sm rounded-lg tracking-wider">
                        {patient.tokenNumber}
                      </span>
                      <h3 className="text-xl font-black text-slate-900">
                        {patient.name}
                      </h3>
                      <span className="text-xs text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded">
                        {patient.age} Yrs • {patient.gender.toUpperCase()}
                      </span>
                      <span className="text-xs font-extrabold uppercase px-2 py-0.5 rounded bg-cyan-100 text-cyan-900">
                        {patient.department === 'ayush' ? 'AYUSH OPD' : 'General Medicine'}
                      </span>
                    </div>

                    {/* Chief Complaint */}
                    <p className="text-sm sm:text-base font-bold text-slate-900">
                      <strong>Complaint:</strong> {patient.chiefComplaints?.[0] || 'Urgent Triage'}
                    </p>

                    {/* Red Flag tags */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {patient.redFlags.map((flag, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-0.5 text-xs font-black bg-red-100 text-red-800 border border-red-300 rounded-md flex items-center gap-1"
                        >
                          <AlertOctagon className="w-3.5 h-3.5" />
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Right metadata & Action */}
                  <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-red-200">
                    <div className="text-right text-xs">
                      <span className="font-extrabold text-red-700 block text-sm">
                        Priority Fast-Track
                      </span>
                      <span className="text-slate-500 font-medium">
                        Arrived: {patient.timestamp}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs sm:text-sm rounded-xl flex items-center gap-1.5 shadow-sm"
                    >
                      <span>Review EMR</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: STANDARD QUEUE PATIENTS */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
          <Clock className="w-4 h-4 text-slate-600" />
          <span>STANDARD OPD QUEUE ({standardPatients.length} PATIENTS)</span>
        </div>

        <div className="space-y-3">
          {standardPatients.map((patient) => {
            const isSelected = activeDoctorPatient?.id === patient.id;
            const docsCount = patient.scannedDocs?.length || 0;

            return (
              <div
                key={patient.id}
                id={`patient-card-${patient.id}`}
                onClick={() => onSelectPatient(patient)}
                className={`w-full p-5 rounded-2xl border-2 cursor-pointer transition-all active:scale-[0.99] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  isSelected
                    ? 'bg-slate-50 border-cyan-800 ring-2 ring-cyan-700/30 shadow-md'
                    : 'bg-white hover:bg-slate-50 border-slate-200 shadow-2xs'
                }`}
              >
                {/* Left Info */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="px-3 py-1 bg-slate-900 text-white font-extrabold text-sm rounded-lg tracking-wider">
                      {patient.tokenNumber}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900">
                      {patient.name}
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">
                      {patient.age} Yrs • {patient.gender}
                    </span>
                    <span
                      className={`text-[11px] font-extrabold uppercase px-2 py-0.5 rounded ${
                        patient.department === 'ayush'
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-cyan-100 text-cyan-900'
                      }`}
                    >
                      {patient.department === 'ayush' ? 'AYUSH' : 'General'}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-slate-700">
                    {patient.chiefComplaints?.[0] || 'General history intake'}
                  </p>

                  <div className="flex items-center gap-3 text-xs text-slate-500 pt-0.5">
                    {docsCount > 0 && (
                      <span className="flex items-center gap-1 text-cyan-800 font-bold">
                        <FileText className="w-3.5 h-3.5" />
                        {docsCount} Attached Docs
                      </span>
                    )}
                    {patient.abhaId && (
                      <span className="font-mono text-slate-600">
                        ABHA: {patient.abhaId}
                      </span>
                    )}
                    {patient.doctorApproved && (
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        ✓ Saved to EMR
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Action */}
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-200">
                  <div className="text-right text-xs">
                    <span className="font-bold text-slate-700 block">
                      Wait: ~{patient.waitTimeMin || 10} mins
                    </span>
                    <span className="text-slate-400">
                      Token Time: {patient.timestamp}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1"
                  >
                    <span>View Summary</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
