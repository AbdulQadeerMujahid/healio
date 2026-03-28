import React, { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../context/LanguageContext";

const getApiUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return `${window.location.origin}/api`;
  }
  return import.meta.env.VITE_API_URL || "http://localhost:5000/api";
};

const API = getApiUrl();
const token = () => localStorage.getItem("token");

export default function AdminDashboard() {
  const { lang, setLang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");

  const i18n = {
    en: {
      title: "Admin Dashboard",
      subtitle: "Complete doctor directory, patient mapping, and platform analytics",
      totalDoctors: "Total Doctors",
      totalPatients: "Total Patients",
      totalAppointments: "Total Appointments",
      pending: "Pending",
      accepted: "Accepted",
      completed: "Completed",
      doctorDirectory: "Doctor Directory (with associated patients)",
      appointmentSchedule: "Appointment Schedule",
      patients: "Patients",
      noData: "No data found",
    },
    hi: {
      title: "एडमिन डैशबोर्ड",
      subtitle: "पूरी डॉक्टर डायरेक्टरी, मरीज मैपिंग और प्लेटफ़ॉर्म एनालिटिक्स",
      totalDoctors: "कुल डॉक्टर",
      totalPatients: "कुल मरीज",
      totalAppointments: "कुल अपॉइंटमेंट्स",
      pending: "लंबित",
      accepted: "स्वीकृत",
      completed: "पूर्ण",
      doctorDirectory: "डॉक्टर डायरेक्टरी (संबंधित मरीजों के साथ)",
      appointmentSchedule: "अपॉइंटमेंट शेड्यूल",
      patients: "मरीज",
      noData: "कोई डेटा नहीं मिला",
    },
    mr: {
      title: "अॅडमिन डॅशबोर्ड",
      subtitle: "संपूर्ण डॉक्टर डायरेक्टरी, रुग्ण मॅपिंग आणि प्लॅटफॉर्म विश्लेषण",
      totalDoctors: "एकूण डॉक्टर",
      totalPatients: "एकूण रुग्ण",
      totalAppointments: "एकूण अपॉइंटमेंट्स",
      pending: "प्रलंबित",
      accepted: "स्वीकृत",
      completed: "पूर्ण",
      doctorDirectory: "डॉक्टर डायरेक्टरी (संबंधित रुग्णांसह)",
      appointmentSchedule: "अपॉइंटमेंट वेळापत्रक",
      patients: "रुग्ण",
      noData: "डेटा आढळला नाही",
    },
  };

  const t = i18n[lang] || i18n.en;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API}/admin/overview`, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load admin data");
        setOverview(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const summary = overview?.summary || {};
  const doctors = overview?.doctors || [];
  const appointments = overview?.appointments || [];

  const stats = useMemo(
    () => [
      { label: t.totalDoctors, value: summary.totalDoctors || 0 },
      { label: t.totalPatients, value: summary.totalPatients || 0 },
      { label: t.totalAppointments, value: summary.totalAppointments || 0 },
      { label: t.pending, value: summary.pending || 0 },
      { label: t.accepted, value: summary.accepted || 0 },
      { label: t.completed, value: summary.completed || 0 },
    ],
    [summary, t]
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t.title}</h1>
          <p className="text-gray-600 dark:text-slate-300 mt-1">{t.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setLang("en")} className={`px-3 py-1 rounded ${lang === "en" ? "bg-teal-600 text-white" : "bg-gray-200 dark:bg-slate-700"}`}>EN</button>
          <button onClick={() => setLang("hi")} className={`px-3 py-1 rounded ${lang === "hi" ? "bg-teal-600 text-white" : "bg-gray-200 dark:bg-slate-700"}`}>हिं</button>
          <button onClick={() => setLang("mr")} className={`px-3 py-1 rounded ${lang === "mr" ? "bg-teal-600 text-white" : "bg-gray-200 dark:bg-slate-700"}`}>म</button>
        </div>
      </div>

      {loading && <div className="card p-8 text-center">Loading...</div>}
      {error && <div className="card p-6 text-red-600 dark:text-red-300">{error}</div>}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {stats.map((item) => (
              <div key={item.label} className="card p-4 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{item.value}</p>
                <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="card p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t.doctorDirectory}</h2>
            {doctors.length === 0 ? (
              <p className="text-gray-500 dark:text-slate-400">{t.noData}</p>
            ) : (
              <div className="space-y-4">
                {doctors.map((doctor) => (
                  <div key={doctor._id} className="border border-gray-200 dark:border-slate-700 rounded-xl p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{doctor.name}</p>
                        <p className="text-sm text-gray-600 dark:text-slate-400">{doctor.specialization || "General"} • {doctor.email}</p>
                      </div>
                      <div className="text-sm text-gray-700 dark:text-slate-300">
                        {t.patients}: <b>{doctor.patientCount}</b> • Appointments: <b>{doctor.appointmentCount}</b>
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-200 mb-2">{t.patients}</p>
                      <div className="flex flex-wrap gap-2">
                        {doctor.patients?.length ? doctor.patients.map((patient) => (
                          <span key={patient._id} className="px-2 py-1 rounded-full text-xs bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                            {patient.name}
                          </span>
                        )) : <span className="text-sm text-gray-500">-</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t.appointmentSchedule}</h2>
            {appointments.length === 0 ? (
              <p className="text-gray-500 dark:text-slate-400">{t.noData}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-200 dark:border-slate-700">
                      <th className="py-2 pr-3">Doctor</th>
                      <th className="py-2 pr-3">Patient</th>
                      <th className="py-2 pr-3">Reason</th>
                      <th className="py-2 pr-3">Date/Time</th>
                      <th className="py-2 pr-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.slice(0, 120).map((a) => (
                      <tr key={a._id} className="border-b border-gray-100 dark:border-slate-800">
                        <td className="py-2 pr-3">{a.doctor?.name || '-'}</td>
                        <td className="py-2 pr-3">{a.patient?.name || '-'}</td>
                        <td className="py-2 pr-3">{a.reason}</td>
                        <td className="py-2 pr-3">{new Date(a.datetime).toLocaleString()}</td>
                        <td className="py-2 pr-3 capitalize">{a.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
