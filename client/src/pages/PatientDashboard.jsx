import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "../context/LanguageContext";
import Tesseract from "tesseract.js";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const ALERT_COOLDOWN_MS = 60 * 1000;

const buildClientAssessment = (bpm, temperature) => {
  let score = 1;

  if (bpm >= 140 || bpm <= 45) score += 3;
  else if (bpm >= 125 || bpm <= 50) score += 2;
  else if (bpm >= 115 || bpm <= 55) score += 1;

  if (temperature >= 39 || temperature <= 35) score += 3;
  else if (temperature >= 38 || temperature <= 35.5) score += 2;
  else if (temperature >= 37.5 || temperature <= 36) score += 1;

  const severity = Math.max(1, Math.min(5, score));
  let risk = "low";
  if (severity >= 5) risk = "critical";
  else if (severity >= 4) risk = "high";
  else if (severity >= 3) risk = "moderate";

  let recommendation = "Continue monitoring and hydration.";
  if (risk === "critical") recommendation = "Immediate doctor intervention recommended. Consider emergency care.";
  else if (risk === "high") recommendation = "Doctor review is required urgently within minutes.";
  else if (risk === "moderate") recommendation = "Doctor review advised soon and increase monitoring frequency.";

  return { severity, risk, recommendation };
};

const buildSyntheticEcgSignal = (bpm, temperature, index) => {
  const safeBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 75;
  const safeTemp = Number.isFinite(temperature) ? temperature : 36.8;

  const cycle = Math.max(18, Math.floor(3000 / safeBpm));
  const phase = index % cycle;

  let base = 18 + Math.sin(index / 10) * 2;
  if (phase > cycle * 0.12 && phase < cycle * 0.2) base += 10;
  if (phase > cycle * 0.4 && phase < cycle * 0.42) base -= 14;
  if (phase >= cycle * 0.42 && phase < cycle * 0.46) base += 52;
  if (phase >= cycle * 0.46 && phase < cycle * 0.5) base -= 20;
  if (phase > cycle * 0.68 && phase < cycle * 0.82) base += 14;

  const tempShift = (safeTemp - 36.8) * 2;
  const noise = Math.sin(index / 3) * 0.8;

  return Number((base + tempShift + noise).toFixed(2));
};

const OCR_SYMPTOM_PATTERNS = [
  { symptom: "Fever", pattern: /\b(fever|temperature|pyrexia)\b/i },
  { symptom: "Cough", pattern: /\b(cough|coughing)\b/i },
  { symptom: "Breathlessness", pattern: /\b(shortness of breath|breathless|dyspnea)\b/i },
  { symptom: "Chest Pain", pattern: /\b(chest pain|angina|chest discomfort)\b/i },
  { symptom: "Headache", pattern: /\b(headache|migraine)\b/i },
  { symptom: "Dizziness", pattern: /\b(dizziness|vertigo|lightheaded)\b/i },
  { symptom: "Fatigue", pattern: /\b(fatigue|tiredness|weakness)\b/i },
  { symptom: "Nausea", pattern: /\b(nausea|vomiting|emesis)\b/i },
  { symptom: "Sore Throat", pattern: /\b(sore throat|throat pain)\b/i },
  { symptom: "High Blood Pressure", pattern: /\b(hypertension|high blood pressure|bp high)\b/i },
  { symptom: "High Blood Sugar", pattern: /\b(hyperglycemia|high sugar|diabetes|blood sugar high)\b/i },
];

const detectSymptomsFromText = (text) => {
  const source = String(text || "");
  if (!source.trim()) return [];

  return OCR_SYMPTOM_PATTERNS
    .filter((item) => item.pattern.test(source))
    .map((item) => item.symptom);
};

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
  const [ocrFileType, setOcrFileType] = useState("");
  const [ocrSymptoms, setOcrSymptoms] = useState([]);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrShareStatus, setOcrShareStatus] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date().toISOString());
  const [openCall, setOpenCall] = useState(null); // For video call modal

  const [latestHeartRate, setLatestHeartRate] = useState(80);
  const [latestTemperature, setLatestTemperature] = useState(36.8);
  const [vitalsStatus, setVitalsStatus] = useState("NORMAL");
  const [ecgData, setEcgData] = useState([]);
  const [clinicalAssessment, setClinicalAssessment] = useState(() =>
    buildClientAssessment(80, 36.8)
  );
  const [lastAutoReportAt, setLastAutoReportAt] = useState(null);

  const alertShownRef = useRef(false);
  const hasAlertedRef = useRef(false);
  const lastEscalationAtRef = useRef(0);
  const appointmentsRef = useRef([]);
  const ecgSnapshotRef = useRef([]);
  const sampleIndexRef = useRef(0);

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
      ecg_graph: "Live ECG Graph",
      risk_level: "Risk Level",
      recommendation: "Recommendation",
      auto_report_generated: "Automated alert report generated",
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
      ocr_feature_highlight: "OCR Feature: Upload PDF/image reports to auto-detect symptoms and auto-share insights with your booked doctor.",
      ocr_processing: "Processing report with OCR...",
      ocr_detected_symptoms: "Detected Symptoms",
      ocr_no_symptoms: "No clear symptoms detected from OCR text.",
      ocr_shared_to_doctor: "OCR summary shared with your booked doctor.",
      ocr_no_appointment_to_share: "No active booked appointment found to share OCR summary.",
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

  useEffect(() => {
    appointmentsRef.current = Array.isArray(appointments) ? appointments : [];
  }, [appointments]);

  const escalateAlertToBackend = async ({ bpm, temperature }) => {
    try {
      const res = await fetch(`${API}/appointments/alerts/escalate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({
          bpm,
          temperature,
          ecgSeries: ecgSnapshotRef.current.slice(-80),
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Alert escalation failed:", errText);
        return null;
      }

      const payload = await res.json();
      if (payload?.assessment) {
        setClinicalAssessment(payload.assessment);
      }
      if (payload?.report) {
        setLastAutoReportAt(new Date().toISOString());
        setMessage(`${t('auto_report_generated')}: ${payload.report.fileName}`);
      }

      await fetchData();
      return payload;
    } catch (err) {
      console.error("Alert escalation network error:", err);
      return null;
    }
  };

// ✅ NEW: Fetch sensor data from serial API
useEffect(() => {
  const fetchSensorData = async () => {
    try {
      const res = await fetch(`${API}/sensor-data`);
      if (!res.ok) return;
      const data = await res.json();

      console.log("📡 Sensor Data:", data);

      const isAlertState =
        Number(data.bpm) > 120 || Number(data.temp) > 30;

      const bpm = Number(data.bpm) || 0;
      const temp = Number(data.temp) || 0;
      const nextIndex = sampleIndexRef.current + 1;
      sampleIndexRef.current = nextIndex;
      const signal = buildSyntheticEcgSignal(bpm, temp, nextIndex);

      setLatestTemperature(data.temp);
      setLatestHeartRate(data.bpm);
      setVitalsStatus(isAlertState ? "ALERT" : "NORMAL");
      setEcgData((prev) => {
        const next = [
          ...prev,
          {
            idx: nextIndex,
            signal,
            bpm,
            temp,
            time: new Date().toLocaleTimeString(),
          },
        ].slice(-120);
        ecgSnapshotRef.current = next;
        return next;
      });

      // 🚨 Alert popup
      if (isAlertState && !hasAlertedRef.current) {
        hasAlertedRef.current = true;
        alert(
          `⚠️ HEALTH ALERT:\nBPM: ${data.bpm}\nTemp: ${data.temp}°C`
        );
      } else if (!isAlertState) {
        hasAlertedRef.current = false;
      }

    } catch (err) {
      console.log("Sensor fetch error:", err);
    }
  };

  // fetch immediately, then poll every second
  fetchSensorData();
  const interval = setInterval(fetchSensorData, 500);

  return () => clearInterval(interval);
}, []);

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

  const extractTextFromPdf = async (file) => {
    const buffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
    const pdf = await loadingTask.promise;

    const pages = [];
    const maxPages = Math.min(pdf.numPages, 5);

    for (let i = 1; i <= maxPages; i += 1) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport }).promise;
      const { data } = await Tesseract.recognize(canvas, "eng");
      pages.push(data?.text || "");
    }

    return pages.join("\n");
  };

  const autoShareOcrWithDoctor = async (symptoms, fullText, fileName) => {
    const active = (Array.isArray(appointments) ? appointments : []).find(
      (item) =>
        item?.doctor?._id &&
        (item.status === "pending" || item.status === "accepted" || item.status === "rescheduled")
    );

    if (!active?._id) {
      setOcrShareStatus(t("ocr_no_appointment_to_share"));
      return;
    }

    const symptomLine = symptoms.length ? symptoms.join(", ") : "No clear symptom keyword matched";
    const summaryText = String(fullText || "").replace(/\s+/g, " ").slice(0, 450);
    const doctorMessage = [
      `OCR AUTO-SHARE from patient (${fileName}):`,
      `Detected symptoms: ${symptomLine}`,
      `Extracted summary: ${summaryText || "No OCR text captured"}`,
    ].join("\n");

    const shareRes = await fetch(`${API}/appointments/${active._id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify({ text: doctorMessage }),
    });

    if (shareRes.ok) {
      setOcrShareStatus(t("ocr_shared_to_doctor"));
    } else {
      setOcrShareStatus(t("failed"));
    }
  };

  const processUploadedReport = async (file) => {
    if (!file) return;

    setOcrProcessing(true);
    setOcrShareStatus("");
    setOcrText("");
    setOcrSymptoms([]);
    setOcrFileType(file.type || "");

    try {
      const isPdf = file.type === "application/pdf";
      if (!isPdf) {
        setOcrImage(URL.createObjectURL(file));
      } else {
        setOcrImage(null);
      }

      let text = "";
      if (isPdf) {
        text = await extractTextFromPdf(file);
      } else {
        const result = await Tesseract.recognize(file, "eng");
        text = result?.data?.text || "";
      }

      setOcrText(text);

      const symptoms = detectSymptomsFromText(text);
      setOcrSymptoms(symptoms);

      await autoShareOcrWithDoctor(symptoms, text, file.name || "report");
    } catch (err) {
      console.error("OCR processing error:", err);
      setOcrShareStatus(t("network_error"));
    } finally {
      setOcrProcessing(false);
    }
  };

  // File handling
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    processUploadedReport(file);
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
      processUploadedReport(file);
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

        <div className="mt-4 rounded-lg border border-sky-100 dark:border-sky-900/40 bg-sky-50 dark:bg-sky-900/20 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-sky-700 dark:text-sky-300 mb-2">{t('ecg_graph')}</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ecgData} margin={{ top: 8, right: 60, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(14, 116, 144, 0.2)" />
                <XAxis dataKey="idx" hide />
                <YAxis yAxisId="left" domain={[40, 160]} label={{ value: 'BPM', angle: -90, position: 'insideLeft', style: { fontSize: '12px', fill: 'rgba(14, 116, 144, 0.7)' } }} />
                <YAxis yAxisId="right" orientation="right" domain={[34, 40]} label={{ value: '°C', angle: 90, position: 'insideRight', style: { fontSize: '12px', fill: 'rgba(249, 115, 22, 0.7)' } }} />
                <Tooltip
                  formatter={(value, key) => {
                    if (key === 'bpm') return [`${value} BPM`, 'Heart Rate'];
                    if (key === 'temp') return [`${value.toFixed(1)}°C`, 'Temperature'];
                    return [value, key];
                  }}
                  labelFormatter={(_label, payload) => payload?.[0]?.payload?.time || ''}
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="bpm" stroke="#0ea5e9" strokeWidth={2.5} dot={false} isAnimationActive={false} name="Heart Rate (BPM)" />
                <Line yAxisId="right" type="monotone" dataKey="temp" stroke="#f97316" strokeWidth={2.5} dot={false} isAnimationActive={false} name="Temperature (°C)" />
              </LineChart>
            </ResponsiveContainer>
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

            <div className="mb-4 rounded-lg border border-amber-300/70 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/25 px-4 py-3">
              <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                {t('ocr_feature_highlight')}
              </p>
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

            {ocrProcessing && (
              <p className="mt-3 text-sm text-teal-700 dark:text-teal-300">{t('ocr_processing')}</p>
            )}

            {!ocrProcessing && ocrSymptoms.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">{t('ocr_detected_symptoms')}</p>
                <div className="flex flex-wrap gap-2">
                  {ocrSymptoms.map((symptom) => (
                    <span
                      key={symptom}
                      className="text-xs px-2 py-1 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200"
                    >
                      {symptom}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!ocrProcessing && ocrText && ocrSymptoms.length === 0 && (
              <p className="mt-3 text-sm text-gray-600 dark:text-slate-300">{t('ocr_no_symptoms')}</p>
            )}

            {!!ocrShareStatus && (
              <p className="mt-3 text-sm text-teal-700 dark:text-teal-300">{ocrShareStatus}</p>
            )}

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

            {!ocrImage && ocrFileType === 'application/pdf' && (
              <div className="mt-4">
                <div className="w-32 h-32 rounded-lg border mx-auto mb-4 flex items-center justify-center bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 text-sm font-semibold">
                  PDF
                </div>
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
