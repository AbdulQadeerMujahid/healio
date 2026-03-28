import React, { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";
import Tesseract from "tesseract.js";

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

export default function PatientDashboard() {
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const { lang, setLang } = useLanguage();
  const [form, setForm] = useState({
    doctorId: "",
    reason: "",
    datetime: "",
    age: "",
    weight: "",
    severity: 0,
  });
  const [message, setMessage] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [ocrImage, setOcrImage] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date().toISOString());
  const [openCall, setOpenCall] = useState(null); // For video call modal

  const [latestHeartRate, setLatestHeartRate] = useState(80);
  const [latestTemperature, setLatestTemperature] = useState(36.8);
  const [vitalsStatus, setVitalsStatus] = useState("NORMAL");

  const i18n = {
    en: {
      patient_dashboard: "Patient Dashboard",
      welcome: (name) => `Welcome ${name || 'Patient'}! Book appointments and manage your health.`,
      book_appointment: "Book Appointment",
      select_doctor: "Select Doctor",
      appointment_datetime: "Appointment Date & Time",
      reason: "Reason for visit",
      age: "Age",
      weight: "Weight (kg)",
      severity: "Severity of condition",
      selected_stars: (n) => `Selected: ${n} star(s)`,
      book_btn: "Book Appointment",
      upload_reports: "Upload Reports",
      current_appointments: "Current Appointments",
      history: "Appointment History",
      heart_rate: "Heart Rate Monitor",
      latest_heart_rate: "Latest Heart Rate",
      current_temperature: "Current Temperature",
      no_current: "No current appointments.",
      no_history: "No appointment history yet.",
      language: "Language",
      drag_drop: "Drag and drop your reports here, or click to select",
      browse_files: "Browse Files",
      notifications: "Notifications",
      no_notifications: "No notifications",
      mark_all_read: "Mark all read",
      view_messages: "View conversation",
      realtime_updated: "Your appointment was updated in real-time.",
      requested_success: "Appointment requested successfully.",
      failed: "Failed",
      network_error: "Network error occurred",
      no_doctors_found: "No doctors found. Please create a doctor account first.",
      doctors_available: (n) => `${n} doctor(s) available`,
      doctor_fallback: "Doctor",
      status_pending: "Pending",
      status_rescheduled: "Rescheduled",
      status_accepted: "Accepted",
      status_completed: "Completed",
      status_declined: "Declined",
      join_video_call: "Join Video Call",
      join_meeting: "Join Meeting",
      ocr_placeholder: "OCR text will appear here...",
      preview_alt: "Preview",
      video_call_with: (name) => `Video Call with Dr. ${name || 'Doctor'}`,
      video_call_title: "Video Call",
      call_close_hint: "The call will be ended when you close this window",
    },
    hi: {
      patient_dashboard: "रोगी डैशबोर्ड",
      welcome: (name) => `${name || 'मरीज'} जी, स्वागत है! अपॉइंटमेंट बुक करें और अपनी सेहत संभालें।`,
      book_appointment: "अपॉइंटमेंट बुक करें",
      select_doctor: "डॉक्टर चुनें",
      appointment_datetime: "अपॉइंटमेंट दिनांक और समय",
      reason: "मुलाकात का कारण",
      age: "उम्र",
      weight: "वज़न (किग्रा)",
      severity: "स्थिति की गंभीरता",
      selected_stars: (n) => `चयनित: ${n} स्टार`,
      book_btn: "बुक करें",
      upload_reports: "रिपोर्ट अपलोड करें",
      current_appointments: "वर्तमान अपॉइंटमेंट्स",
      history: "अपॉइंटमेंट इतिहास",
      heart_rate: "हार्ट रेट मॉनिटर",
      latest_heart_rate: "नवीनतम हार्ट रेट",
      current_temperature: "वर्तमान तापमान",
      no_current: "कोई वर्तमान अपॉइंटमेंट नहीं।",
      no_history: "अभी तक कोई इतिहास नहीं।",
      language: "भाषा",
      drag_drop: "अपनी रिपोर्ट्स को यहां ड्रैग और ड्रॉप करें, या चुनने के लिए क्लिक करें",
      browse_files: "फ़ाइलें ब्राउज़ करें",
      notifications: "सूचनाएं",
      no_notifications: "कोई सूचना नहीं",
      mark_all_read: "सभी पढ़ा चिह्नित करें",
      view_messages: "संदेश देखें",
      realtime_updated: "आपकी अपॉइंटमेंट रियल-टाइम में अपडेट हुई है।",
      requested_success: "अपॉइंटमेंट सफलतापूर्वक अनुरोधित हुई।",
      failed: "विफल",
      network_error: "नेटवर्क त्रुटि हुई",
      no_doctors_found: "कोई डॉक्टर नहीं मिला। कृपया पहले डॉक्टर अकाउंट बनाएं।",
      doctors_available: (n) => `${n} डॉक्टर उपलब्ध`,
      doctor_fallback: "डॉक्टर",
      status_pending: "लंबित",
      status_rescheduled: "रीशेड्यूल",
      status_accepted: "स्वीकृत",
      status_completed: "पूर्ण",
      status_declined: "अस्वीकृत",
      join_video_call: "वीडियो कॉल जॉइन करें",
      join_meeting: "मीटिंग जॉइन करें",
      ocr_placeholder: "OCR टेक्स्ट यहां दिखाई देगा...",
      preview_alt: "पूर्वावलोकन",
      video_call_with: (name) => `डॉ. ${name || 'डॉक्टर'} के साथ वीडियो कॉल`,
      video_call_title: "वीडियो कॉल",
      call_close_hint: "यह विंडो बंद करने पर कॉल समाप्त हो जाएगी",
    },
    mr: {
      patient_dashboard: "रुग्ण डॅशबोर्ड",
      welcome: (name) => `${name || 'रुग्ण'} सर, स्वागत आहे! अपॉइंटमेंट बुक करा आणि आरोग्य सांभाळा।`,
      book_appointment: "अपॉइंटमेंट बुक करा",
      select_doctor: "डॉक्टर निवडा",
      appointment_datetime: "अपॉइंटमेंट दिनांक आणि वेळ",
      reason: "भेटीचे कारण",
      age: "वय",
      weight: "वजन (किलो)",
      severity: "परिस्थितीची तीव्रता",
      selected_stars: (n) => `निवडले: ${n} तारे`,
      book_btn: "बुक करा",
      upload_reports: "रिपोर्ट अपलोड करा",
      current_appointments: "सध्याच्या अपॉइंटमेंट्स",
      history: "अपॉइंटमेंट इतिहास",
      heart_rate: "हार्ट रेट मॉनिटर",
      latest_heart_rate: "नवीनतम हार्ट रेट",
      current_temperature: "सध्याचे तापमान",
      no_current: "सध्या कोणतीही अपॉइंटमेंट नाही.",
      no_history: "अजून इतिहास नाही.",
      language: "भाषा",
      drag_drop: "तुमच्या रिपोर्ट्सला येथे ड्रॅग आणि ड्रॉप करा, किंवा निवडण्यासाठी क्लिक करा",
      browse_files: "फायली ब्राउझ करा",
      notifications: "सूचना",
      no_notifications: "कोणत्याही सूचना नाहीत",
      mark_all_read: "सर्व वाचले म्हणून चिन्हांकित करा",
      view_messages: "चॅट पहा",
      realtime_updated: "तुमची अपॉइंटमेंट रिअल-टाइममध्ये अपडेट झाली आहे.",
      requested_success: "अपॉइंटमेंट यशस्वीरित्या नोंदली गेली.",
      failed: "अयशस्वी",
      network_error: "नेटवर्क त्रुटी झाली",
      no_doctors_found: "डॉक्टर सापडले नाहीत. कृपया आधी डॉक्टर खाते तयार करा.",
      doctors_available: (n) => `${n} डॉक्टर उपलब्ध`,
      doctor_fallback: "डॉक्टर",
      status_pending: "प्रलंबित",
      status_rescheduled: "पुन्हा वेळ ठरवले",
      status_accepted: "स्वीकारले",
      status_completed: "पूर्ण",
      status_declined: "नाकारले",
      join_video_call: "व्हिडिओ कॉलमध्ये सामील व्हा",
      join_meeting: "मीटिंग जॉइन करा",
      ocr_placeholder: "OCR मजकूर येथे दिसेल...",
      preview_alt: "पूर्वावलोकन",
      video_call_with: (name) => `डॉ. ${name || 'डॉक्टर'} सोबत व्हिडिओ कॉल`,
      video_call_title: "व्हिडिओ कॉल",
      call_close_hint: "ही विंडो बंद केल्यावर कॉल समाप्त होईल",
    },
  };

  const t = (key, ...args) => {
    const val = i18n[lang]?.[key];
    if (typeof val === "function") return val(...args);
    return val || i18n.en[key] || key;
  };

  const translateStatus = (status) => {
    const translated = t(`status_${status}`);
    return translated === `status_${status}` ? status : translated;
  };

  // Fetch data
  const fetchData = async () => {
    try {
      // Fetch doctors
      const doctorsRes = await fetch(`${API}/appointments/doctors`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (doctorsRes.ok) {
        const doctorsData = await doctorsRes.json();
        console.log('🩺 Doctors fetched:', doctorsData);
        console.log('🩺 Number of doctors:', Array.isArray(doctorsData) ? doctorsData.length : 0);
        setDoctors(Array.isArray(doctorsData) ? doctorsData : []);
      } else {
        console.error('❌ Failed to fetch doctors:', doctorsRes.status, await doctorsRes.text());
      }

      // Fetch appointments
      const appointmentsRes = await fetch(`${API}/appointments/me`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (appointmentsRes.ok) {
        const appointmentsData = await appointmentsRes.json();
        setAppointments(Array.isArray(appointmentsData) ? appointmentsData : []);
        setLastUpdate(new Date().toISOString());
      }
    } catch (error) {
      console.error('Fetch error:', error);
    }
  };

  // Real-time Vitals via Socket.IO
  useEffect(() => {
    let socket;
    let hasAlerted = false; // Prevent spamming alerts
    let isMounted = true;

    import("socket.io-client").then(({ io }) => {
      if (!isMounted) return;
      
      // Connect to the base API URL (e.g., http://192.168.0.115:5000)
      const socketUrl = API.includes('/api') ? API.replace('/api', '') : "http://192.168.0.115:5000";
      socket = io(socketUrl);
      
      socket.on("connect", () => {
        console.log("🟢 Connected to live Vitals Stream");
      });

      socket.on("vitalsUpdate", (data) => {
        console.log("⚡ Live Update Received:", data);
        
        const isAlertState = Number(data.bpm) > 100 || data.status === "ALERT";
        setLatestTemperature(data.temperature);
        setLatestHeartRate(data.bpm);
        setVitalsStatus(isAlertState ? "ALERT" : "NORMAL");
        
        // Bonus: Alert popup logic mapped
        if (isAlertState && !hasAlerted) {
          hasAlerted = true; // Lock alert
          setTimeout(() => {
             alert(`⚠️ HEALTH ALERT:\nBPM: ${data.bpm}\nTemp: ${data.temperature}°C\nStatus: ${data.status}\n\nPlease take immediate precautions!`);
          }, 100); 
        } else if (!isAlertState) {
          hasAlerted = false; // reset alert
        }
      });
    });

    return () => {
      isMounted = false;
      if (socket) socket.disconnect();
    };
  }, [API]);

  // Polling for updates (replaces Socket.IO)
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
            // Update appointments with new data
            setAppointments(prev => {
              const updated = [...prev];
              pollData.appointments.forEach(newAppt => {
                const existingIndex = updated.findIndex(a => a._id === newAppt._id);
                if (existingIndex >= 0) {
                  updated[existingIndex] = newAppt;
                } else {
                  updated.unshift(newAppt); // Add new appointments to top
                }
              });
              return updated;
            });

            if (pollData.appointments.some(a => a.patient?._id === user()?.id)) {
              setMessage(t('realtime_updated'));
              setTimeout(() => setMessage(""), 3000);
            }
          }

          setLastUpdate(pollData.timestamp);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [lastUpdate, lang]);

  // File handling
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setOcrImage(URL.createObjectURL(file));
      Tesseract.recognize(file, "eng").then(({ data: { text } }) => {
        setOcrText(text);
      });
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setOcrImage(URL.createObjectURL(file));
      Tesseract.recognize(file, "eng").then(({ data: { text } }) => {
        setOcrText(text);
      });
    }
  };

  // Form submission
  const submit = async (e) => {
    e.preventDefault();
    setMessage("");
    try {
      const res = await fetch(`${API}/appointments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        const data = await res.json();
        setAppointments(prev => [data, ...prev]);
        setMessage(t('requested_success'));
        setForm({
          doctorId: "",
          reason: "",
          datetime: "",
          age: "",
          weight: "",
          severity: 0,
        });
        // Refresh data after successful submission
        fetchData();
      } else {
        const errorData = await res.json();
        setMessage(errorData.message || t('failed'));
      }
    } catch (error) {
      setMessage(t('network_error'));
    }
  };

  const renderStars = () => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <span
            key={s}
            onClick={() => setForm({ ...form, severity: s })}
            className={`cursor-pointer text-2xl transition-colors ${
              form.severity >= s ? "text-teal-600" : "text-gray-300 hover:text-gray-400"
            }`}
          >
            {form.severity >= s ? "●" : "○"}
          </span>
        ))}
      </div>
    );
  };

  const list = Array.isArray(appointments) ? appointments : [];
  const currentAppointments = list.filter((a) =>
    a.status === "pending" || a.status === "accepted" || a.status === "rescheduled"
  );
  const historyAppointments = list.filter((a) =>
    a.status === "completed" || a.status === "declined"
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('patient_dashboard')}</h1>
          <p className="text-gray-600 dark:text-slate-300 mt-1">{t('welcome', user()?.name)}</p>
        </div>

        {/* Language Selector */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setLang("en")}
            className={`px-3 py-1 rounded ${
              lang === "en" ? "bg-teal-600 text-white" : "bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-200"
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setLang("hi")}
            className={`px-3 py-1 rounded ${
              lang === "hi" ? "bg-teal-600 text-white" : "bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-200"
            }`}
          >
            हिं
          </button>
          <button
            onClick={() => setLang("mr")}
            className={`px-3 py-1 rounded ${
              lang === "mr" ? "bg-teal-600 text-white" : "bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-200"
            }`}
          >
            म
          </button>
        </div>
      </div>

      {message && (
        <div
          className="p-4 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 rounded-lg"
        >
          {message}
        </div>
      )}

      {/* Health Vitals Section */}
      <div className={`card card-hover ${vitalsStatus === 'ALERT' ? 'border-2 border-red-500' : ''}`}>
        <div className="flex items-center space-x-2 mb-4">
          <i data-lucide="heart" className={`w-5 h-5 ${vitalsStatus === 'ALERT' ? 'text-red-600 animate-pulse' : 'text-teal-600'}`}></i>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('heart_rate')} {vitalsStatus === 'ALERT' && <span className="text-red-500 text-sm ml-2">(ALERT)</span>}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`rounded-lg border px-4 py-3 ${vitalsStatus === 'ALERT' ? 'border-red-500 bg-red-50 dark:bg-red-900/40 text-red-800' : 'border-teal-100 dark:border-teal-900/40 bg-teal-50 dark:bg-teal-900/20'}`}>
            <p className={`text-xs uppercase tracking-wide ${vitalsStatus === 'ALERT' ? 'text-red-700 dark:text-red-300' : 'text-teal-700 dark:text-teal-300'}`}>
              {t('latest_heart_rate')}
            </p>
            <p className={`text-3xl font-bold ${vitalsStatus === 'ALERT' ? 'text-red-800 dark:text-red-200 animate-pulse' : 'text-teal-800 dark:text-teal-200'}`}>{latestHeartRate} BPM</p>
          </div>
          <div className={`rounded-lg border px-4 py-3 ${vitalsStatus === 'ALERT' ? 'border-red-500 bg-red-50 dark:bg-red-900/40 text-red-800' : 'border-orange-100 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-900/20'}`}>
            <p className={`text-xs uppercase tracking-wide ${vitalsStatus === 'ALERT' ? 'text-red-700 dark:text-red-300' : 'text-orange-700 dark:text-orange-300'}`}>
              {t('current_temperature')}
            </p>
            <p className={`text-3xl font-bold ${vitalsStatus === 'ALERT' ? 'text-red-800 dark:text-red-200 animate-pulse' : 'text-orange-800 dark:text-orange-200'}`}>{latestTemperature}°C</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Booking and Upload */}
        <div className="lg:col-span-2 space-y-8">
          {/* Book Appointment Card */}
          <div className="card card-hover">
            <div className="flex items-center space-x-2 mb-6">
              <i data-lucide="calendar-plus" className="w-5 h-5 text-teal-600"></i>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('book_appointment')}</h2>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                    {t('select_doctor')}
                  </label>
                  <select
                    value={form.doctorId}
                    onChange={(e) => setForm({ ...form, doctorId: e.target.value })}
                    className="w-full border border-gray-300 dark:border-slate-600 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  >
                    <option value="">{t('select_doctor')}</option>
                    {(Array.isArray(doctors) ? doctors : []).map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} {d.specialization ? `- ${d.specialization}` : ''} ({d.email})
                      </option>
                    ))}
                  </select>
                  {doctors.length === 0 && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">⚠️ {t('no_doctors_found')}</p>
                  )}
                  {doctors.length > 0 && (
                    <p className="mt-2 text-sm text-green-600 dark:text-green-400">✓ {t('doctors_available', doctors.length)}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                    {t('appointment_datetime')}
                  </label>
                  <input
                    type="datetime-local"
                    value={form.datetime}
                    onChange={(e) => setForm({ ...form, datetime: e.target.value })}
                    className="w-full border border-gray-300 dark:border-slate-600 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                  {t('reason')}
                </label>
                <input
                  type="text"
                  placeholder={t('reason')}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="w-full border border-gray-300 dark:border-slate-600 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                    {t('age')}
                  </label>
                  <input
                    type="number"
                    placeholder={t('age')}
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value })}
                    className="w-full border border-gray-300 dark:border-slate-600 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                    min="1"
                    max="120"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                    {t('weight')}
                  </label>
                  <input
                    type="number"
                    placeholder={t('weight')}
                    value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: e.target.value })}
                    className="w-full border border-gray-300 dark:border-slate-600 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                    min="2"
                    max="500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                    {t('severity')}
                  </label>
                  <div className="pt-2">
                    {renderStars()}
                    {form.severity > 0 && (
                      <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                        {t('selected_stars', form.severity)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <button type="submit" className="w-full btn-primary">
                <i data-lucide="calendar-plus" className="w-4 h-4 mr-2"></i>
                {t('book_btn')}
              </button>
            </form>
          </div>

          {/* Upload Reports Card */}
          <div className="card card-hover">
            <div className="flex items-center space-x-2 mb-6">
              <i data-lucide="upload" className="w-5 h-5 text-teal-600"></i>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('upload_reports')}</h2>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-teal-400 bg-teal-50 dark:bg-teal-900/20'
                  : 'border-gray-300 dark:border-slate-600 hover:border-teal-400 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <i data-lucide="file-text" className="w-12 h-12 text-gray-400 mb-4"></i>
              <p className="text-gray-600 dark:text-slate-300 mb-2">{t('drag_drop')}</p>
              <label className="btn-primary cursor-pointer">
                <i data-lucide="folder-open" className="w-4 h-4 mr-2"></i>
                {t('browse_files')}
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*,.pdf"
                />
              </label>
            </div>

            {ocrImage && (
              <div className="mt-4">
                <img
                  src={ocrImage}
                  alt={t('preview_alt')}
                  className="w-32 h-32 object-cover rounded-lg border mx-auto mb-4"
                />
                <textarea
                  className="w-full h-40 border border-gray-300 dark:border-slate-600 rounded-lg p-3 text-sm bg-gray-50 dark:bg-slate-800 dark:text-white"
                  value={ocrText}
                  readOnly
                  placeholder={t('ocr_placeholder')}
                />
              </div>
            )}

          </div>
        </div>

        {/* Right Column - Status and Monitoring */}
        <div className="space-y-8">
          {/* Current Appointments */}
          <div className="card card-hover">
            <div className="flex items-center space-x-2 mb-6">
              <i data-lucide="clock" className="w-5 h-5 text-teal-600"></i>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('current_appointments')}</h2>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {currentAppointments.map((a) => (
                <div key={a._id} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {a.doctor?.name || t('doctor_fallback')}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-slate-300">{a.reason}</p>
                      <p className="text-sm text-gray-600 dark:text-slate-300">
                        {t('severity')}: {"●".repeat(a.severity || 0)}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-teal-100 text-teal-700 rounded-full capitalize">
                      {translateStatus(a.status)}
                    </span>
                  </div>
                  <p className="text-sm text-teal-600 font-medium">
                    {new Date(a.datetime).toLocaleString()}
                  </p>
                  
                  {/* Video Call Button - Only show for accepted appointments */}
                  {a.meetingLink && a.status === 'accepted' && (
                    <div className="mt-3">
                      {String(a.meetingLink).startsWith('jitsi:') ? (
                        <button
                          onClick={() => setOpenCall(a._id)}
                          className="w-full btn-primary text-sm flex items-center justify-center"
                        >
                          <i data-lucide="video" className="w-4 h-4 mr-2"></i>
                          {t('join_video_call')}
                        </button>
                      ) : (
                        <a
                          href={a.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full btn-primary text-sm flex items-center justify-center"
                        >
                          <i data-lucide="external-link" className="w-4 h-4 mr-2"></i>
                          {t('join_meeting')}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {currentAppointments.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">{t('no_current')}</p>
              )}
            </div>
          </div>

          {/* History */}
          <div className="card card-hover">
            <div className="flex items-center space-x-2 mb-6">
              <i data-lucide="history" className="w-5 h-5 text-teal-600"></i>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('history')}</h2>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {historyAppointments.map((a) => (
                <div key={a._id} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {a.doctor?.name || t('doctor_fallback')}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-slate-300">{a.reason}</p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-full capitalize">
                      {translateStatus(a.status)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    {new Date(a.datetime).toLocaleString()}
                  </p>
                </div>
              ))}
              {historyAppointments.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">{t('no_history')}</p>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Video Call Modal */}
      {openCall && (() => {
        const appt = appointments.find(x => x._id === openCall);
        if (!appt || !appt.meetingLink || !String(appt.meetingLink).startsWith('jitsi:')) return null;
        const room = String(appt.meetingLink).replace('jitsi:', '');
        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setOpenCall(null)}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-5xl h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center">
                    <i data-lucide="video" className="w-5 h-5 text-white"></i>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {t('video_call_with', appt.doctor?.name)}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-slate-400">{appt.reason}</p>
                  </div>
                </div>
                <button
                  onClick={() => setOpenCall(null)}
                  className="w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
                >
                  <i data-lucide="x" className="w-5 h-5 text-gray-600 dark:text-slate-400"></i>
                </button>
              </div>
              
              {/* Jitsi iframe */}
              <div className="flex-1 overflow-hidden">
                <iframe
                  src={`https://meet.jit.si/${room}`}
                  allow="camera; microphone; fullscreen; display-capture"
                  className="w-full h-full border-0"
                  title={t('video_call_title')}
                />
              </div>
              
              {/* Footer */}
              <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
                <p className="text-sm text-gray-600 dark:text-slate-400 text-center">
                  <i data-lucide="info" className="w-4 h-4 inline mr-1"></i>
                  {t('call_close_hint')}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Success/Error Messages */}
      {message && (
        <div
          className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg ${
            message.includes('success') ? 'bg-green-500' : 'bg-teal-600'
          } text-white font-medium`}
        >
          {message}
        </div>
      )}
    </div>
  );
}
