import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Chart from "chart.js/auto";
import { useLanguage } from "../context/LanguageContext";

// Auto-detect API URL for both development and production
const getApiUrl = () => {
  // In production (Vercel), API routes are at the same domain with /api prefix
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return `${window.location.origin}/api`;
  }
  // For local development
  return import.meta.env.VITE_API_URL || "http://localhost:5000/api";
};

const API = getApiUrl();
const token = () => localStorage.getItem("token");
const user = () => JSON.parse(localStorage.getItem("user") || "null");

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const { lang, setLang } = useLanguage();
  const [openCall, setOpenCall] = useState(null);
  const [openChat, setOpenChat] = useState(null);
  const [chatInputs, setChatInputs] = useState({});
  const [lastUpdate, setLastUpdate] = useState(new Date().toISOString());

  const vitalsChartRef = useRef(null);
  const bpChartRef = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("lang_doctor");
    }
  }, []);

  const i18n = {
    en: {
      doctor_dashboard: "Doctor Dashboard",
      welcome: (name) => `Welcome ${name || 'Doctor'}! Manage your appointments and patient care.`,
      patient_directory: "My Patients Directory",
      patients: "Patient",
      default_patient: "Patient",
      no_patients: "No patients assigned yet",
      appointment_requests: "Appointment Requests",
      live_call: "Live Call",
      chat: "Chat",
      view_notes: "Notes",
      reason: "Reason",
      age: "Age",
      weight: "Weight",
      severity: "Severity",
      accept: "Accept",
      reschedule: "Reschedule",
      decline: "Decline",
      chat_open: "Chat Open",
      chat_btn: "Chat",
      close: "Close",
      chat_closed: "Chat closed for this appointment.",
      type_message: "Type a message",
      send: "Send",
      todays_schedule: "Today's Schedule",
      mark_done: "Mark Done",
      join_meeting: "Join Meeting",
      open_call: "Open Call",
      history: "History",
      patient_vitals: "Patient Vitals",
      blood_pressure: "Blood Pressure",
      quick_actions: "Quick Actions",
      video_call: "Video Call",
      reports: "Reports",
      eprescribe: "E-Prescribe",
      notes: "Notes",
      daily_limit_reached: "Daily limit reached: Only 10 patients can be scheduled today.",
      reschedule_prompt: "Optional: Paste new Google Meet link (leave blank to keep)",
      scheduled_today: "scheduled",
      left_today: "left today",
      attended_today: "attended today",
      status_pending: "Pending",
      status_rescheduled: "Rescheduled",
      status_accepted: "Accepted",
      status_completed: "Completed",
      status_declined: "Declined",
    },
    hi: {
      doctor_dashboard: "डॉक्टर डैशबोर्ड",
      welcome: (name) => `${name || 'डॉक्टर'} जी, स्वागत है! अपनी अपॉइंटमेंट्स और मरीजों की देखभाल करें।`,
      patient_directory: "मेरे मरीजों की सूची",
      patients: "मरीज",
      default_patient: "मरीज",
      no_patients: "अभी कोई मरीज असाइन नहीं है",
      appointment_requests: "अपॉइंटमेंट अनुरोध",
      live_call: "लाइव कॉल",
      chat: "चैट",
      view_notes: "नोट्स",
      reason: "कारण",
      age: "उम्र",
      weight: "वजन",
      severity: "गंभीरता",
      accept: "स्वीकार करें",
      reschedule: "रीशेड्यूल",
      decline: "अस्वीकार करें",
      chat_open: "चैट खुला",
      chat_btn: "चैट",
      close: "बंद करें",
      chat_closed: "इस अपॉइंटमेंट की चैट बंद है।",
      type_message: "संदेश लिखें",
      send: "भेजें",
      todays_schedule: "आज का शेड्यूल",
      mark_done: "पूर्ण करें",
      join_meeting: "मीटिंग जॉइन करें",
      open_call: "कॉल खोलें",
      history: "इतिहास",
      patient_vitals: "मरीज वाइटल्स",
      blood_pressure: "ब्लड प्रेशर",
      quick_actions: "क्विक एक्शन",
      video_call: "वीडियो कॉल",
      reports: "रिपोर्ट्स",
      eprescribe: "ई-प्रिस्क्राइब",
      notes: "नोट्स",
      daily_limit_reached: "दैनिक सीमा पूरी: आज केवल 10 मरीज शेड्यूल किए जा सकते हैं।",
      reschedule_prompt: "वैकल्पिक: नया Google Meet लिंक पेस्ट करें (खाली छोड़ने पर वही रहेगा)",
      scheduled_today: "आज शेड्यूल",
      left_today: "आज बचे",
      attended_today: "आज उपस्थित",
      status_pending: "लंबित",
      status_rescheduled: "रीशेड्यूल",
      status_accepted: "स्वीकृत",
      status_completed: "पूर्ण",
      status_declined: "अस्वीकृत",
    },
    mr: {
      doctor_dashboard: "डॉक्टर डॅशबोर्ड",
      welcome: (name) => `${name || 'डॉक्टर'} सर, स्वागत आहे! आपल्या अपॉइंटमेंट्स आणि रुग्णांची काळजी घ्या।`,
      patient_directory: "माझ्या रुग्णांची यादी",
      patients: "रुग्ण",
      default_patient: "रुग्ण",
      no_patients: "अजून रुग्ण नियुक्त नाहीत",
      appointment_requests: "अपॉइंटमेंट विनंत्या",
      live_call: "लाईव्ह कॉल",
      chat: "चॅट",
      view_notes: "नोंदी",
      reason: "कारण",
      age: "वय",
      weight: "वजन",
      severity: "गंभीरता",
      accept: "स्वीकारा",
      reschedule: "पुन्हा वेळ ठरवा",
      decline: "नकार द्या",
      chat_open: "चॅट सुरू",
      chat_btn: "चॅट",
      close: "बंद करा",
      chat_closed: "या अपॉइंटमेंटसाठी चॅट बंद आहे.",
      type_message: "संदेश लिहा",
      send: "पाठवा",
      todays_schedule: "आजचे वेळापत्रक",
      mark_done: "पूर्ण करा",
      join_meeting: "मीटिंग जॉइन करा",
      open_call: "कॉल उघडा",
      history: "इतिहास",
      patient_vitals: "रुग्ण वाइटल्स",
      blood_pressure: "रक्तदाब",
      quick_actions: "क्विक अॅक्शन्स",
      video_call: "व्हिडिओ कॉल",
      reports: "अहवाल",
      eprescribe: "ई-प्रिस्क्राइब",
      notes: "नोंदी",
      daily_limit_reached: "दैनिक मर्यादा पूर्ण: आज फक्त 10 रुग्ण शेड्यूल करता येतील.",
      reschedule_prompt: "ऐच्छिक: नवीन Google Meet लिंक पेस्ट करा (रिक्त ठेवल्यास जुनीच राहील)",
      scheduled_today: "आज शेड्यूल",
      left_today: "आज उरले",
      attended_today: "आज उपस्थित",
      status_pending: "प्रलंबित",
      status_rescheduled: "पुन्हा वेळ ठरवले",
      status_accepted: "स्वीकारले",
      status_completed: "पूर्ण",
      status_declined: "नाकारले",
    }
  };

  const t = (key, ...args) => {
    const val = i18n[lang]?.[key];
    if (typeof val === "function") return val(...args);
    return val || i18n.en[key] || key;
  };

  // Helpers
  const isSameDay = (d1, d2) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const renderSeverity = (level) => (
    <span className="ml-2 text-red-500">{level} / 5</span>
  );

  const translateStatus = (status) => {
    const translated = t(`status_${status}`);
    return translated === `status_${status}` ? status : translated;
  };

  const myPatients = Object.values(
    appointments.reduce((acc, appt) => {
      if (appt?.patient?._id) {
        acc[appt.patient._id] = appt.patient;
      }
      return acc;
    }, {})
  );

  // Fetch data and polling
  const fetchData = async () => {
    try {
      const res = await fetch(`${API}/appointments/me`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAppointments(Array.isArray(data) ? data : []);
        setLastUpdate(new Date().toISOString());
      }
    } catch (error) {
      console.error('Fetch error:', error);
    }
  };

  useEffect(() => {
    fetchData(); // Initial fetch

    const pollInterval = setInterval(async () => {
      try {
        const pollRes = await fetch(`${API}/appointments/poll?lastUpdate=${encodeURIComponent(lastUpdate)}`, {
          headers: { Authorization: `Bearer ${token()}` },
        });

        if (pollRes.ok) {
          const pollData = await pollRes.json();

          if (pollData.appointments && pollData.appointments.length > 0) {
            setAppointments(prev => {
              const updated = [...prev];
              pollData.appointments.forEach(newAppt => {
                const existingIndex = updated.findIndex(a => a._id === newAppt._id);
                if (existingIndex >= 0) {
                  updated[existingIndex] = newAppt;
                } else {
                  updated.unshift(newAppt);
                }
              });
              return updated;
            });
          }

          setLastUpdate(pollData.timestamp);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [lastUpdate]);

  // Chart setup
  useEffect(() => {
    if (vitalsChartRef.current) {
      const ctx = vitalsChartRef.current.getContext("2d");
      const chart = new Chart(ctx, {
        type: "line",
        data: {
          labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
          datasets: [
            {
              label: "Heart Rate",
              data: [72, 75, 78, 76, 74, 80, 79],
              borderColor: "#0d9488",
              backgroundColor: "rgba(13, 148, 136, 0.1)",
              tension: 0.4,
            },
            {
              label: "Oxygen Level",
              data: [98, 97, 99, 98, 97, 98, 99],
              borderColor: "#059669",
              backgroundColor: "rgba(5, 150, 105, 0.1)",
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              grid: { color: "#f3f4f6" },
              ticks: { color: "#6b7280" }
            },
            x: {
              grid: { color: "#f3f4f6" },
              ticks: { color: "#6b7280" }
            }
          }
        },
      });
      return () => chart.destroy();
    }
  }, []);

  useEffect(() => {
    if (bpChartRef.current) {
      const ctx = bpChartRef.current.getContext("2d");
      const chart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
          datasets: [
            {
              label: "Systolic",
              data: [120, 118, 121, 119, 122, 120, 121],
              backgroundColor: "#0d9488",
            },
            {
              label: "Diastolic",
              data: [80, 78, 82, 79, 81, 80, 82],
              backgroundColor: "#14b8a6",
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              grid: { color: "#f3f4f6" },
              ticks: { color: "#6b7280" }
            },
            x: {
              grid: { color: "#f3f4f6" },
              ticks: { color: "#6b7280" }
            }
          }
        },
      });
      return () => chart.destroy();
    }
  }, []);

  // Update appointment status
  const updateStatus = async (id, status, meetingLink) => {
    if (status === "accepted") {
      const today = new Date();
      const todaysAcceptedCount = appointments.filter(
        (a) => a.status === "accepted" && a.datetime && isSameDay(new Date(a.datetime), today)
      ).length;
      if (todaysAcceptedCount >= 10) {
        alert(t('daily_limit_reached'));
        return;
      }
    }

    let payload = { status };
    if (status === "accepted") {
      const room = `health-${id}`;
      payload.meetingLink = `jitsi:${room}`;
    }
    if (meetingLink && meetingLink.trim()) {
      payload.meetingLink = meetingLink.trim();
    }

    try {
      const res = await fetch(`${API}/appointments/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setAppointments(prev => prev.map(a => a._id === id ? data : a));
      }
    } catch (error) {
      console.error('Update status error:', error);
    }
  };

  const startVideoCall = () => {
    window.open("https://meet.google.com/new", "_blank");
  };

  const DAILY_LIMIT = 10;
  const today = new Date();
  const todaysAcceptedCount = appointments.filter(
    (a) => a.status === "accepted" && a.datetime && isSameDay(new Date(a.datetime), today)
  ).length;
  const remainingToday = Math.max(DAILY_LIMIT - todaysAcceptedCount, 0);
  const todaysCompletedCount = appointments.filter((a) => {
    if (a.status !== "completed") return false;
    const completedAt = a.updatedAt ? new Date(a.updatedAt) : (a.datetime ? new Date(a.datetime) : null);
    return completedAt ? isSameDay(completedAt, today) : false;
  }).length;

  const sendChat = async (id) => {
    const text = (chatInputs[id] || "").trim();
    if (!text) return;

    try {
      const res = await fetch(`${API}/appointments/${id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ text }),
      });

      if (res.ok) {
        const data = await res.json();
        setAppointments(prev => prev.map(a => a._id === id ? data : a));
        setChatInputs(prev => ({ ...prev, [id]: "" }));
      }
    } catch (error) {
      console.error('Send chat error:', error);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between" data-aos="fade-down">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('doctor_dashboard')}</h1>
          <p className="text-gray-600 dark:text-slate-300 mt-1">{t('welcome', user()?.name)}</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setLang("en")}
            className={`px-3 py-1 rounded ${
              lang === "en"
                ? "bg-teal-600 text-white"
                : "bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-200"
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setLang("hi")}
            className={`px-3 py-1 rounded ${
              lang === "hi"
                ? "bg-teal-600 text-white"
                : "bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-200"
            }`}
          >
            हिं
          </button>
          <button
            onClick={() => setLang("mr")}
            className={`px-3 py-1 rounded ${
              lang === "mr"
                ? "bg-teal-600 text-white"
                : "bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-200"
            }`}
          >
            म
          </button>
        </div>
      </div>

      {/* My Patients Directory */}
      <div className="card card-hover" data-aos="fade-up">
        <div className="flex items-center space-x-2 mb-6">
          <i data-lucide="users" className="w-5 h-5 text-teal-600"></i>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('patient_directory')}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {myPatients.map((patient) => (
            <div key={patient._id} className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-slate-700">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center">
                  <i data-lucide="user" className="w-5 h-5 text-teal-600 dark:text-teal-400"></i>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{patient.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('patients')}</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{patient.email}</p>
            </div>
          ))}
          {myPatients.length === 0 && (
            <div className="col-span-full text-center py-8">
              <i data-lucide="users" className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3"></i>
              <p className="text-gray-500 dark:text-gray-400">{t('no_patients')}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Appointment Requests */}
          <div className="card card-hover" data-aos="fade-up">
            <div className="flex items-center space-x-2 mb-6">
              <i data-lucide="clock" className="w-5 h-5 text-teal-600"></i>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('appointment_requests')}</h2>
            </div>
            <div className="space-y-4">
              {appointments
                .filter(a => a.status === "pending" || a.status === "rescheduled")
                .map((a) => (
                  <div key={a._id} className="p-4 bg-yellow-50/80 dark:bg-amber-900/15 rounded-lg border-l-4 border-yellow-500 dark:border-amber-500 border border-yellow-100 dark:border-amber-900/40 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-slate-100">{a.patient?.name || t('default_patient')}</p>
                        <p className="text-sm text-gray-600 dark:text-slate-300">{t('reason')}: {a.reason}</p>
                        <p className="text-sm text-gray-600 dark:text-slate-300">{t('age')}: {a.age} | {t('weight')}: {a.weight} kg</p>
                        <p className="text-sm text-gray-600 dark:text-slate-300">{t('severity')}: {renderSeverity(a.severity || 0)}</p>
                        <p className="text-sm text-yellow-700 dark:text-amber-300 font-medium">{new Date(a.datetime).toLocaleString()}</p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded bg-yellow-200 text-yellow-800 dark:bg-amber-500/20 dark:text-amber-300 border border-yellow-300 dark:border-amber-700/50">{translateStatus(a.status)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {a.status === "pending" && (
                        <button
                          onClick={() => updateStatus(a._id, "accepted")}
                          disabled={remainingToday === 0}
                          className={`btn-primary text-sm ${remainingToday === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {t('accept')}
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          const link = window.prompt(t('reschedule_prompt')) || "";
                          await updateStatus(a._id, "rescheduled", link.trim() || undefined);
                        }}
                        className="bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/45 dark:text-blue-300 px-3 py-1 rounded text-sm border border-blue-200 dark:border-blue-800"
                      >
                        {t('reschedule')}
                      </button>
                      <button
                        onClick={() => setOpenChat(a._id)}
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition ${
                          openChat === a._id
                            ? 'border-teal-600 bg-teal-600 text-white'
                            : 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-900/25 dark:text-teal-300 dark:hover:bg-teal-900/40'
                        }`}
                      >
                        <i data-lucide="message-circle" className="w-3 h-3"></i>
                        {openChat === a._id ? t('chat_open') : t('chat_btn')}
                      </button>
                      <button
                        onClick={() => {
                          if (a.patient?._id) {
                            navigate(`/doctor/notes?patientId=${a.patient._id}`);
                          } else {
                            navigate('/doctor/notes');
                          }
                        }}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 px-3 py-1 rounded text-sm border border-gray-200 dark:border-slate-700"
                      >
                        {t('view_notes')}
                      </button>
                      <button
                        onClick={() => updateStatus(a._id, "declined")}
                        className="bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/25 dark:hover:bg-red-900/40 dark:text-red-300 px-3 py-1 rounded text-sm border border-red-200 dark:border-red-800"
                      >
                        {t('decline')}
                      </button>
                    </div>

                    {/* Inline notes removed in favour of dedicated notes workspace */}
                  </div>
                ))}
            </div>
          </div>

          {/* Live Call */}
          {openCall && (
            <div className="card card-hover" data-aos="zoom-in">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">{t('live_call')}</h2>
                <button onClick={() => setOpenCall(null)} className="text-sm px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">{t('close')}</button>
              </div>
              {(() => {
                const appt = appointments.find(x => x._id === openCall);
                if (!appt || !appt.meetingLink || !String(appt.meetingLink).startsWith('jitsi:')) return null;
                const room = String(appt.meetingLink).replace('jitsi:', '');
                return (
                  <div className="rounded overflow-hidden border">
                    <iframe
                      title={`call-${openCall}`}
                      src={`https://meet.jit.si/${room}`}
                      allow="camera; microphone; fullscreen; display-capture; autoplay"
                      className="w-full"
                      style={{ height: 480 }}
                    />
                  </div>
                );
              })()}
            </div>
          )}

          {/* Chat */}
          {openChat && (
            <div className="card card-hover" data-aos="fade-up">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">{t('chat')}</h2>
                <button onClick={() => setOpenChat(null)} className="text-sm px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">{t('close')}</button>
              </div>
              {(() => {
                const appt = appointments.find(x => x._id === openChat);
                if (!appt || appt.status === 'completed' || appt.status === 'declined') {
                  return <p className="text-sm text-gray-500">{t('chat_closed')}</p>;
                }
                return (
                  <div>
                    <div className="space-y-1 max-h-64 overflow-y-auto border rounded p-3">
                      {(appt.messages || []).map((m, idx) => (
                        <div key={idx} className="text-sm text-gray-700">
                          <span className="text-gray-500 mr-1">
                            {m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : ''}
                          </span>
                          {m.text}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex space-x-2">
                      <input
                        value={chatInputs[openChat] || ""}
                        onChange={(e) => setChatInputs(prev => ({ ...prev, [openChat]: e.target.value }))}
                        placeholder={t('type_message')}
                        className="flex-1 border px-2 py-1 rounded text-sm"
                      />
                      <button onClick={() => sendChat(openChat)} className="btn-primary px-3 py-1 text-sm">{t('send')}</button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Today's Schedule */}
          {!openCall && !openChat && (
            <div className="card card-hover" data-aos="fade-left">
              <div className="mb-4">
                <div className="flex items-center space-x-2 mb-2">
                  <i data-lucide="calendar" className="w-5 h-5 text-teal-600"></i>
                  <h2 className="text-xl font-semibold">{t('todays_schedule')}</h2>
                </div>
                <div className="flex space-x-2">
                  <span className="px-2 py-1 rounded bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 text-sm border border-teal-200 dark:border-teal-800">
                    {todaysAcceptedCount}/{DAILY_LIMIT} {t('scheduled_today')} • {remainingToday} {t('left_today')}
                  </span>
                  <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-sm border border-emerald-200 dark:border-emerald-800">
                    {todaysCompletedCount} {t('attended_today')}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                {appointments
                  .filter(a => a.status === "accepted")
                  .map(a => (
                    <div key={a._id} className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border-l-4 border-green-500 dark:border-green-600 shadow-sm">
                      <p className="font-medium text-gray-900 dark:text-white">{a.patient?.name}</p>
                      <p className="text-sm text-gray-600 dark:text-slate-300">{a.reason}</p>
                      <p className="text-sm text-gray-600 dark:text-slate-400">{t('age')}: {a.age} | {t('weight')}: {a.weight} kg</p>
                      <p className="text-sm text-gray-600 dark:text-slate-400">{t('severity')}: {renderSeverity(a.severity || 0)}</p>
                      <p className="text-sm text-green-600 dark:text-green-400 font-medium">{new Date(a.datetime).toLocaleString()}</p>

                      {/* Action Buttons */}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {a.meetingLink && a.status === 'accepted' && (
                          <>
                            {String(a.meetingLink).startsWith('jitsi:') ? (
                              <button
                                onClick={() => setOpenCall(a._id)}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 transition-colors shadow-sm"
                              >
                                <i data-lucide="video" className="w-3.5 h-3.5"></i>
                                {t('open_call')}
                              </button>
                            ) : (
                              <a
                                href={a.meetingLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 transition-colors shadow-sm"
                              >
                                <i data-lucide="external-link" className="w-3.5 h-3.5"></i>
                                {t('join_meeting')}
                              </a>
                            )}
                          </>
                        )}
                        
                        <button
                          onClick={() => navigate(`/doctor/messages?appointmentId=${a._id}`)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors shadow-sm"
                        >
                          <i data-lucide="message-circle" className="w-3.5 h-3.5"></i>
                          {t('chat')}
                        </button>
                        
                        <button
                          onClick={() => updateStatus(a._id, "completed")}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50 border border-green-200 dark:border-green-800 transition-colors shadow-sm"
                        >
                          <i data-lucide="check-circle" className="w-3.5 h-3.5"></i>
                          {t('mark_done')}
                        </button>
                        
                        <button
                          onClick={() => {
                            if (a.patient?._id) {
                              navigate(`/doctor/notes?patientId=${a.patient._id}`);
                            } else {
                              navigate('/doctor/notes');
                            }
                          }}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-600 transition-colors shadow-sm"
                        >
                          <i data-lucide="file-text" className="w-3.5 h-3.5"></i>
                          {t('view_notes')}
                        </button>
                      </div>

                      {/* Inline notes removed in favour of dedicated notes workspace */}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* History */}
          <div className="card card-hover" data-aos="fade-left" data-aos-delay="100">
            <div className="flex items-center space-x-2 mb-6">
              <i data-lucide="history" className="w-5 h-5 text-teal-600"></i>
              <h2 className="text-xl font-semibold">{t('history')}</h2>
            </div>
            <div className="space-y-3">
              {appointments
                .filter(a => a.status === "completed" || a.status === "declined")
                .map(a => (
                  <div key={a._id} className="p-3 bg-gray-50 dark:bg-slate-800/70 rounded-lg border-l-4 border-gray-400 dark:border-slate-500 border border-gray-100 dark:border-slate-700">
                    <p className="font-medium text-gray-900 dark:text-slate-100">{a.patient?.name}</p>
                    <p className="text-sm text-gray-600 dark:text-slate-300">{a.reason}</p>
                    <p className="text-sm text-gray-600 dark:text-slate-400">{new Date(a.datetime).toLocaleString()}</p>
                    <span className="text-xs uppercase text-gray-600 dark:text-slate-300">{translateStatus(a.status)}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6">
            <div className="card card-hover" data-aos="fade-left" data-aos-delay="200">
              <div className="flex items-center space-x-2 mb-6">
                <i data-lucide="heart" className="w-5 h-5 text-teal-600"></i>
                <h2 className="text-xl font-semibold">{t('patient_vitals')}</h2>
              </div>
              <canvas ref={vitalsChartRef} height="200"></canvas>
            </div>

            <div className="card card-hover" data-aos="fade-left" data-aos-delay="300">
              <div className="flex items-center space-x-2 mb-6">
                <i data-lucide="activity" className="w-5 h-5 text-teal-600"></i>
                <h2 className="text-xl font-semibold">{t('blood_pressure')}</h2>
              </div>
              <canvas ref={bpChartRef} height="200"></canvas>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card card-hover" data-aos="fade-left" data-aos-delay="400">
            <div className="flex items-center space-x-2 mb-6">
              <i data-lucide="zap" className="w-5 h-5 text-teal-600"></i>
              <h2 className="text-xl font-semibold">{t('quick_actions')}</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={startVideoCall} className="p-3 bg-teal-100 hover:bg-teal-200 rounded-lg">
                <i data-lucide="video" className="w-6 h-6 text-teal-600 mb-2"></i>
                <p className="text-sm font-medium">{t('video_call')}</p>
              </button>
              <button className="p-3 bg-green-100 hover:bg-green-200 rounded-lg">
                <i data-lucide="file-text" className="w-6 h-6 text-green-600 mb-2"></i>
                <p className="text-sm font-medium">{t('reports')}</p>
              </button>
              <button className="p-3 bg-purple-100 hover:bg-purple-200 rounded-lg">
                <i data-lucide="pill" className="w-6 h-6 text-purple-600 mb-2"></i>
                <p className="text-sm font-medium">{t('eprescribe')}</p>
              </button>
              <button className="p-3 bg-red-100 hover:bg-red-200 rounded-lg">
                <i data-lucide="clipboard-list" className="w-6 h-6 text-red-600 mb-2"></i>
                <p className="text-sm font-medium">{t('notes')}</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
