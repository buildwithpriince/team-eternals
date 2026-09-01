import React from 'react';
import { AlertOctagon, CheckCircle2, Eye, BellRing, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const RedFlagBanner: React.FC = () => {
  const { redFlagAlerts, acknowledgeAlert, dismissAlert, setActiveDoctorPatient, patients, setAppView } = useApp();

  const activeAlerts = redFlagAlerts.filter((a) => !a.acknowledged);

  if (activeAlerts.length === 0) return null;

  return (
    <div
      id="doctor-live-redflag-stream"
      className="w-full space-y-2 mb-6"
    >
      {activeAlerts.map((alert) => (
        <div
          key={alert.id}
          id={`redflag-alert-${alert.id}`}
          className="w-full bg-red-600 text-white rounded-xl p-4 sm:p-5 shadow-lg border-2 border-red-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-bounce-short"
        >
          {/* Left: Icon and Description */}
          <div className="flex items-start gap-3.5">
            <div className="p-2 bg-red-700 rounded-lg shrink-0 mt-0.5">
              <AlertOctagon className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-white text-red-700 font-extrabold text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Live Triage Alert
                </span>
                <span className="font-extrabold text-white text-sm sm:text-base">
                  Token: {alert.tokenNumber} ({alert.patientName})
                </span>
                <span className="text-xs text-red-200 font-medium">
                  {alert.timestamp}
                </span>
              </div>
              <p className="text-sm sm:text-base text-red-100 font-bold mt-1">
                {alert.flagReason}
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              id={`btn-view-alert-patient-${alert.id}`}
              onClick={() => {
                const target = patients.find((p) => p.id === alert.patientId || p.tokenNumber === alert.tokenNumber);
                if (target) {
                  setActiveDoctorPatient(target);
                  setAppView('doctor');
                }
                acknowledgeAlert(alert.id);
              }}
              className="px-4 py-2 bg-white text-red-700 hover:bg-red-50 font-bold rounded-lg text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Eye className="w-4 h-4" />
              <span>Review Clinical Record</span>
            </button>

            <button
              id={`btn-ack-alert-${alert.id}`}
              onClick={() => acknowledgeAlert(alert.id)}
              className="px-3.5 py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded-lg text-xs sm:text-sm flex items-center gap-1 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Acknowledge</span>
            </button>

            <button
              id={`btn-dismiss-alert-${alert.id}`}
              onClick={() => dismissAlert(alert.id)}
              className="p-2 text-red-200 hover:text-white rounded-lg cursor-pointer"
              title="Dismiss"
              aria-label="Dismiss alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
