import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertOctagon,
  User,
  Clock,
  Stethoscope,
  ChevronRight,
  Sparkles,
  Filter,
  FileText,
  ArrowUpRight,
  Activity,
  Database,
  RefreshCw,
  CheckCircle2,
  ListOrdered,
  Users,
  Calendar,
  CheckSquare,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PatientRecord, Department } from '../../types';
import { RedFlagBanner } from '../../components/RedFlagBanner';
import { fetchQueueFromBackend } from '../../utils/supabaseSync';

interface DoctorQueueProps {
  onSelectPatient: (patient: PatientRecord) => void;
}

export const DoctorQueue: React.FC<DoctorQueueProps> = ({ onSelectPatient }) => {
  const { patients, activeDoctorPatient, refreshQueue } = useApp();
  const [queueTab, setQueueTab] = useState<'queue' | 'history'>('queue');
  const [filterDept, setFilterDept] = useState<'all' | Department>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshQueue();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Base department and search filtered list
  const deptFilteredPatients = patients.filter((p) => {
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

  // Split into Active Queue vs Today's Completed Patients
  const activeQueuePatients = deptFilteredPatients.filter(
    (p) => p.status !== 'completed'
  );
  const completedPatients = deptFilteredPatients.filter(
    (p) => p.status === 'completed'
  );

  // For active queue: Separate red-flagged patients to PIN them at the very top
  const redFlaggedPatients = activeQueuePatients.filter(
    (p) => p.redFlags && p.redFlags.length > 0
  );
  const standardPatients = activeQueuePatients.filter(
    (p) => !p.redFlags || p.redFlags.length === 0
  );

  return (
    <div id="doctor-queue-container" className="w-full space-y-6 text-left animate-fadeIn">
      {/* Live Red Flag Alert Stream (Surfaces alerts while patients are mid-interview) */}
      <RedFlagBanner />

      {/* Main Header & View Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {queueTab === 'queue' ? 'OPD Patient Triage Queue' : "Today's Consulted Patients"}
            </h2>

            {/* Visual Tab Toggle in matching Hindi/English LanguageSwitcher pill style */}
            <div
              id="doctor-queue-view-toggle"
              role="tablist"
              aria-label="Doctor Queue View Toggle"
              className="relative inline-flex items-center bg-slate-100/90 hover:bg-slate-100 p-1 rounded-xl border border-slate-300 shadow-2xs backdrop-blur-xs select-none"
            >
              {/* Active Queue Tab Button */}
              <button
                id="tab-btn-active-queue"
                type="button"
                role="tab"
                aria-selected={queueTab === 'queue'}
                onClick={() => setQueueTab('queue')}
                className={`relative z-10 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-colors duration-200 cursor-pointer flex items-center gap-2 ${
                  queueTab === 'queue'
                    ? 'text-slate-950 font-black'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                {queueTab === 'queue' && (
                  <motion.div
                    layoutId="active-doctor-view-pill"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{
                      type: 'spring',
                      stiffness: 450,
                      damping: 32,
                      mass: 0.8,
                    }}
                    className="absolute inset-0 bg-white rounded-lg shadow-xs border border-slate-200/80"
                    style={{ zIndex: -1 }}
                  />
                )}
                <Clock className="w-3.5 h-3.5" />
                <span>Queue</span>
                <span
                  className={`text-[11px] font-black px-1.5 py-0.5 rounded-full transition-colors ${
                    queueTab === 'queue'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {activeQueuePatients.length}
                </span>
              </button>

              {/* Today's Patients Tab Button */}
              <button
                id="tab-btn-todays-patients"
                type="button"
                role="tab"
                aria-selected={queueTab === 'history'}
                onClick={() => setQueueTab('history')}
                className={`relative z-10 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-colors duration-200 cursor-pointer flex items-center gap-2 ${
                  queueTab === 'history'
                    ? 'text-slate-950 font-black'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                {queueTab === 'history' && (
                  <motion.div
                    layoutId="active-doctor-view-pill"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{
                      type: 'spring',
                      stiffness: 450,
                      damping: 32,
                      mass: 0.8,
                    }}
                    className="absolute inset-0 bg-white rounded-lg shadow-xs border border-slate-200/80"
                    style={{ zIndex: -1 }}
                  />
                )}
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Today's Patients</span>
                <span
                  className={`text-[11px] font-black px-1.5 py-0.5 rounded-full transition-colors ${
                    queueTab === 'history'
                      ? 'bg-emerald-800 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {completedPatients.length}
                </span>
              </button>
            </div>
          </div>

          <p className="text-sm text-slate-600 font-medium">
            {queueTab === 'queue'
              ? 'Real-time structured intake triage from Swasthya AI Kiosks'
              : 'Consultation records, diagnoses, and completed treatment summaries for today'}
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
              General
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
              AYUSH
            </button>
          </div>

          {/* Search input */}
          <input
            id="input-search-queue"
            type="text"
            placeholder="Search name, token..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-400 text-slate-900 w-36 sm:w-44"
          />

          {/* Realtime Live Status Badge & Refresh */}
          <button
            id="btn-refresh-queue"
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Supabase Realtime Sync Active"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Live</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: ACTIVE TRIAGE QUEUE */}
      {/* ========================================================================= */}
      {queueTab === 'queue' && (
        <div className="space-y-6">
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
                          className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs sm:text-sm rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
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

            {standardPatients.length > 0 ? (
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
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                        >
                          <span>View Summary</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-10 bg-white border-2 border-dashed border-slate-300 rounded-2xl text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="text-base font-bold text-slate-900">
                  {redFlaggedPatients.length > 0 ? 'No standard patients pending' : 'Active Triage Queue is Clear!'}
                </h4>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  All patients in this view have been attended to or moved to Today's Patients archive. New kiosk registrations will appear here automatically in real time.
                </p>
                {completedPatients.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setQueueTab('history')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer mt-2"
                  >
                    <span>View Today's Consulted Patients ({completedPatients.length})</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: TODAY'S COMPLETED / DIAGNOSED PATIENTS */}
      {/* ========================================================================= */}
      {queueTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 pb-1">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>CONSULTED & TREATED TODAY ({completedPatients.length} PATIENTS)</span>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Permanent EMR records synchronized with Hospital Supabase DB
            </span>
          </div>

          {completedPatients.length > 0 ? (
            <div className="space-y-3">
              {completedPatients.map((patient) => {
                const isSelected = activeDoctorPatient?.id === patient.id;
                const docsCount = patient.scannedDocs?.length || 0;

                return (
                  <div
                    key={patient.id}
                    id={`patient-completed-card-${patient.id}`}
                    onClick={() => onSelectPatient(patient)}
                    className={`w-full p-5 rounded-2xl border-2 cursor-pointer transition-all active:scale-[0.99] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                      isSelected
                        ? 'bg-emerald-50/70 border-emerald-600 ring-2 ring-emerald-500/30 shadow-md'
                        : 'bg-white hover:bg-emerald-50/30 border-slate-200 shadow-2xs'
                    }`}
                  >
                    {/* Left Patient & Diagnosis Info */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="px-3 py-1 bg-emerald-800 text-white font-extrabold text-sm rounded-lg tracking-wider">
                          {patient.tokenNumber}
                        </span>
                        <h3 className="text-lg font-black text-slate-900">
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
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          <span>Diagnosed / Treated</span>
                        </span>
                      </div>

                      {/* Complaint & Physician Outcome */}
                      <p className="text-sm font-semibold text-slate-800">
                        <span className="text-slate-500 font-medium">Chief Complaint:</span> {patient.chiefComplaints?.[0] || 'Consultation history'}
                      </p>

                      {patient.physicianNotes ? (
                        <p className="text-xs font-medium text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 line-clamp-2">
                          <strong className="text-slate-800">Doctor Notes & Rx:</strong> {patient.physicianNotes}
                        </p>
                      ) : patient.consultationOutcome ? (
                        <p className="text-xs font-medium text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 line-clamp-2">
                          <strong className="text-slate-800">Outcome:</strong> {patient.consultationOutcome}
                        </p>
                      ) : null}

                      <div className="flex items-center gap-3 text-xs text-slate-500 pt-0.5 flex-wrap">
                        {patient.consultationTime && (
                          <span className="font-bold text-emerald-800 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            Completed at {patient.consultationTime}
                          </span>
                        )}
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
                      </div>
                    </div>

                    {/* Right Action */}
                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-200">
                      <div className="text-right text-xs">
                        <span className="font-extrabold text-emerald-800 block text-sm">
                          Consultation Done
                        </span>
                        <span className="text-slate-400">
                          Intake: {patient.timestamp}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <span>View EMR Record</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 bg-white border-2 border-dashed border-slate-300 rounded-2xl text-center space-y-3">
              <Users className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="text-base font-bold text-slate-900">
                No Patients Marked as Diagnosed / Treated Yet Today
              </h4>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Select any patient from the <strong>Active Queue</strong>, review their SOAP summary, and click <strong>"Mark as Diagnosed / Treated"</strong> to move them into this daily log.
              </p>
              <button
                type="button"
                onClick={() => setQueueTab('queue')}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer mt-2"
              >
                <span>Back to Active Queue ({activeQueuePatients.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
