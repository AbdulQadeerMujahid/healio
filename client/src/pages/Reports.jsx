import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "../context/LanguageContext";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Auto-detect API URL for both development and production
const getApiUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return `${window.location.origin}/api`;
  }
  return import.meta.env.VITE_API_URL || "http://localhost:5000/api";
};

const API = getApiUrl();
const token = () => localStorage.getItem("token");
const user = () => JSON.parse(localStorage.getItem("user") || "null");

export default function ReportsPage({ user: currentUser }) {
  const [appointments, setAppointments] = useState([]);
  const [medicalReports, setMedicalReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [patientFilter, setPatientFilter] = useState('accepted'); // 'accepted', 'past', 'all'
  const { lang, setLang } = useLanguage();
  const [selectedPeriod, setSelectedPeriod] = useState("6months");
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    reportType: 'lab',
    file: null
  });
  const currentUser2 = user();

  const i18n = {
    en: {
      reports: "Reports",
      health_analytics: "Health Analytics",
      appointment_history: "Appointment History",
      health_metrics: "Health Metrics",
      loading: "Loading...",
      appointments_over_time: "Appointments Over Time",
      appointment_status: "Appointment Status Distribution",
      health_score: "Health Score",
      last_updated: "Last updated",
      no_data: "No data available",
      excellent: "Excellent",
      good: "Good",
      fair: "Fair",
      poor: "Poor"
    },
    hi: {
      reports: "रिपोर्ट्स",
      health_analytics: "स्वास्थ्य विश्लेषण",
      appointment_history: "अपॉइंटमेंट इतिहास",
      health_metrics: "स्वास्थ्य मेट्रिक्स",
      loading: "लोड हो रहा है...",
      appointments_over_time: "समय के साथ अपॉइंटमेंट्स",
      appointment_status: "अपॉइंटमेंट स्थिति वितरण",
      health_score: "स्वास्थ्य स्कोर",
      last_updated: "अंतिम अपडेट",
      no_data: "कोई डेटा उपलब्ध नहीं",
      excellent: "उत्कृष्ट",
      good: "अच्छा",
      fair: "ठीक",
      poor: "खराब"
    },
    mr: {
      reports: "अहवाल",
      health_analytics: "आरोग्य विश्लेषण",
      appointment_history: "अपॉइंटमेंट इतिहास",
      health_metrics: "आरोग्य मेट्रिक्स",
      loading: "लोड होत आहे...",
      appointments_over_time: "वेळेनुसार अपॉइंटमेंट्स",
      appointment_status: "अपॉइंटमेंट स्थिती वितरण",
      health_score: "आरोग्य स्कोर",
      last_updated: "शेवटचे अपडेट",
      no_data: "कोणताही डेटा उपलब्ध नाही",
      excellent: "उत्कृष्ट",
      good: "चांगले",
      fair: "ठीक",
      poor: "वाईट"
    }
  };

  const t = i18n[lang] || i18n.en;

  useEffect(() => {
    fetchAppointments();
    if (currentUser2?.role === 'doctor') {
      fetchDoctorPatients();
    } else {
      fetchMedicalReports();
    }
  }, []);

  useEffect(() => {
    if (currentUser2?.role === 'doctor' && selectedPatient) {
      fetchPatientReports(selectedPatient._id);
    }
  }, [selectedPatient]);

  const fetchAppointments = async () => {
    try {
      const response = await fetch(`${API}/appointments/me`, {
        headers: {
          Authorization: `Bearer ${token()}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAppointments(Array.isArray(data) ? data : data.appointments || []);
      }
    } catch (error) {
      console.error("Error fetching appointments:", error);
    }
    setLoading(false);
  };

  const fetchMedicalReports = async () => {
    try {
      const response = await fetch(`${API}/reports`, {
        headers: {
          Authorization: `Bearer ${token()}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setMedicalReports(data || []);
      }
    } catch (error) {
      console.error("Error fetching medical reports:", error);
    }
  };

  const fetchDoctorPatients = async () => {
    try {
      const response = await fetch(`${API}/appointments/me`, {
        headers: {
          Authorization: `Bearer ${token()}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        const appts = Array.isArray(data) ? data : data.appointments || [];
        
        // Get unique patients with their appointment info
        const patientMap = new Map();
        appts.forEach(appt => {
          if (appt.patient) {
            const patientId = appt.patient._id;
            if (!patientMap.has(patientId)) {
              patientMap.set(patientId, {
                ...appt.patient,
                appointments: [],
                hasAccepted: false,
                hasPast: false
              });
            }
            const patient = patientMap.get(patientId);
            patient.appointments.push(appt);
            
            // Track if has accepted or past appointments
            if (appt.status === 'accepted') {
              patient.hasAccepted = true;
            }
            if (appt.status === 'completed' || appt.status === 'declined' || new Date(appt.datetime) < new Date()) {
              patient.hasPast = true;
            }
          }
        });
        
        const uniquePatients = Array.from(patientMap.values());
        setPatients(uniquePatients);
        applyPatientFilter(uniquePatients, patientFilter, searchQuery);
      }
    } catch (error) {
      console.error("Error fetching patients:", error);
    }
  };

  const applyPatientFilter = (patientList, filter, search) => {
    let filtered = patientList;

    // Apply appointment status filter
    if (filter === 'accepted') {
      filtered = filtered.filter(p => p.hasAccepted);
    } else if (filter === 'past') {
      filtered = filtered.filter(p => p.hasPast);
    }

    // Apply search filter
    if (search.trim()) {
      const query = search.toLowerCase();
      filtered = filtered.filter(p => 
        p.name?.toLowerCase().includes(query) || 
        p.email?.toLowerCase().includes(query)
      );
    }

    setFilteredPatients(filtered);
    
    // Auto-select first patient if current selection is not in filtered list
    if (filtered.length > 0 && (!selectedPatient || !filtered.find(p => p._id === selectedPatient._id))) {
      setSelectedPatient(filtered[0]);
    } else if (filtered.length === 0) {
      setSelectedPatient(null);
    }
  };

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    applyPatientFilter(patients, patientFilter, value);
  };

  const handleFilterChange = (filter) => {
    setPatientFilter(filter);
    applyPatientFilter(patients, filter, searchQuery);
  };

  const fetchPatientReports = async (patientId) => {
    try {
      const response = await fetch(`${API}/reports/patient/${patientId}`, {
        headers: {
          Authorization: `Bearer ${token()}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setMedicalReports(data || []);
      }
    } catch (error) {
      console.error("Error fetching patient reports:", error);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit');
        return;
      }
      setUploadForm({ ...uploadForm, file });
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.file || !uploadForm.title) {
      alert('Please fill in all required fields');
      return;
    }

    setUploading(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result;
        
        const payload = {
          title: uploadForm.title,
          description: uploadForm.description,
          reportType: uploadForm.reportType,
          fileData: base64String,
          fileName: uploadForm.file.name,
          fileType: uploadForm.file.type,
          fileSize: uploadForm.file.size
        };

        const response = await fetch(`${API}/reports`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token()}`,
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          await fetchMedicalReports();
          setShowUploadModal(false);
          setUploadForm({ title: '', description: '', reportType: 'lab', file: null });
          alert('Report uploaded successfully!');
        } else {
          const error = await response.json();
          alert(error.message || 'Failed to upload report');
        }
      };
      reader.readAsDataURL(uploadForm.file);
    } catch (error) {
      console.error('Error uploading report:', error);
      alert('Failed to upload report');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm('Are you sure you want to delete this report?')) return;

    try {
      const response = await fetch(`${API}/reports/${reportId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token()}`,
        },
      });

      if (response.ok) {
        await fetchMedicalReports();
        setSelectedReport(null);
        alert('Report deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('Failed to delete report');
    }
  };

  const viewReport = async (reportId) => {
    try {
      const response = await fetch(`${API}/reports/${reportId}`, {
        headers: {
          Authorization: `Bearer ${token()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedReport(data);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    }
  };

  // Generate mock data for charts
  const generateChartData = () => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    const appointmentCounts = [2, 1, 3, 2, 1, 4];

    return months.map((month, index) => ({
      month,
      appointments: appointmentCounts[index]
    }));
  };

  const getStatusDistribution = () => {
    const statusCounts = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };

    appointments.forEach(apt => {
      if (statusCounts.hasOwnProperty(apt.status)) {
        statusCounts[apt.status]++;
      }
    });

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: t[status] || status,
      value: count,
      color: status === 'completed' ? '#10B981' :
             status === 'confirmed' ? '#3B82F6' :
             status === 'pending' ? '#F59E0B' : '#EF4444'
    }));
  };

  const getHealthScore = () => {
    // Mock health score based on appointment frequency and completion
    const completedCount = appointments.filter(apt => apt.status === 'completed').length;
    const totalCount = appointments.length;

    if (totalCount === 0) return 0;

    const completionRate = completedCount / totalCount;
    return Math.round(completionRate * 100);
  };

  const getHealthScoreColor = (score) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  };

  const getHealthScoreLabel = (score) => {
    if (score >= 80) return t.excellent;
    if (score >= 60) return t.good;
    if (score >= 40) return t.fair;
    return t.poor;
  };

  // Function to generate formatted download filename
  const getFormattedFilename = (report) => {
    // Determine patient name
    let patientName = '';
    if (currentUser2?.role === 'patient') {
      patientName = currentUser2?.name || 'Patient';
    } else if (currentUser2?.role === 'doctor' && selectedPatient) {
      patientName = selectedPatient?.name || 'Patient';
    } else if (report.patient?.name) {
      patientName = report.patient.name;
    } else {
      patientName = 'Patient';
    }

    // Clean the patient name (remove spaces, special characters)
    const cleanPatientName = patientName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');

    // Get report name
    const reportName = report.title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');

    // Format date (YYYY-MM-DD)
    const uploadDate = new Date(report.createdAt).toISOString().split('T')[0];

    // Get file extension
    const fileExtension = report.fileName.split('.').pop() || 'pdf';

    // Combine: PatientName_ReportName_DateOfUpload.extension
    return `${cleanPatientName}_${reportName}_${uploadDate}.${fileExtension}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">{t.loading}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t.reports}</h1>
            <p className="text-gray-600 dark:text-slate-400">
              {currentUser2?.role === 'doctor' ? 'View patient medical reports' : t.health_analytics}
            </p>
          </div>
          {currentUser2?.role === 'patient' && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-md"
            >
              <i data-lucide="upload" className="w-5 h-5"></i>
              Upload Report
            </button>
          )}
        </div>

        {/* Doctor: Patient Search & Filter */}
        {currentUser2?.role === 'doctor' && (
          <div className="mb-6 bg-white dark:bg-slate-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Patient Selection</h2>
              
              {/* Search Bar */}
              <div className="mb-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search patients by name or email..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full border border-gray-100 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2 bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                  />
                  <i data-lucide="search" className="w-5 h-5 text-gray-400 absolute left-3 top-2.5"></i>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleFilterChange('accepted')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    patientFilter === 'accepted'
                      ? 'bg-teal-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-slate-900/40 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Current Accepted ({patients.filter(p => p.hasAccepted).length})
                </button>
                <button
                  onClick={() => handleFilterChange('past')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    patientFilter === 'past'
                      ? 'bg-teal-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-slate-900/40 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Past Appointments ({patients.filter(p => p.hasPast).length})
                </button>
                <button
                  onClick={() => handleFilterChange('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    patientFilter === 'all'
                      ? 'bg-teal-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-slate-900/40 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                >
                  All Patients ({patients.length})
                </button>
              </div>
            </div>

            {/* Patient List */}
            <div className="max-h-64 overflow-y-auto">
              {filteredPatients.length === 0 ? (
                <div className="p-8 text-center">
                  <i data-lucide="user-x" className="w-12 h-12 mx-auto mb-3 text-gray-400"></i>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    {searchQuery ? 'No patients found matching your search' : 'No patients in this category'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-slate-700">
                  {filteredPatients.map((patient) => (
                    <div
                      key={patient._id}
                      onClick={() => setSelectedPatient(patient)}
                      className={`p-4 cursor-pointer transition-colors ${
                        selectedPatient?._id === patient._id
                          ? 'bg-teal-50 dark:bg-teal-900/20 border-l-4 border-teal-600'
                          : 'hover:bg-gray-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-12 h-12 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center shadow-md">
                              <i data-lucide="user" className="w-6 h-6 text-white"></i>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900 dark:text-white">{patient.name}</p>
                              {patient.hasAccepted && (
                                <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                                  Active
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-slate-400">{patient.email}</p>
                            <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                              {patient.appointments.length} appointment{patient.appointments.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Medical Reports Section */}
        <div className="bg-white dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 rounded-2xl shadow mb-8">
          <div className="p-6 border-b border-gray-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {currentUser2?.role === 'doctor' && selectedPatient 
                ? `${selectedPatient.name}'s Medical Reports` 
                : 'Medical Reports'}
            </h2>
          </div>
          <div className="p-6">
            {medicalReports.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i data-lucide="file-text" className="w-8 h-8 text-gray-400"></i>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No reports uploaded</h3>
                <p className="text-gray-600 dark:text-slate-400">
                  {currentUser2?.role === 'doctor' 
                    ? selectedPatient 
                      ? `${selectedPatient.name} has not uploaded any reports yet`
                      : 'Select a patient to view their reports'
                    : 'Upload your medical reports to keep them organized'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {medicalReports.map((report) => (
                  <div
                    key={report._id}
                    className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => viewReport(report._id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900/30 rounded-lg flex items-center justify-center">
                          <i data-lucide={report.fileType.includes('pdf') ? 'file-text' : 'image'} className="w-5 h-5 text-teal-600 dark:text-teal-400"></i>
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white text-sm">{report.title}</h3>
                          <p className="text-xs text-gray-500 dark:text-slate-400 capitalize">{report.reportType}</p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteReport(report._id);
                        }}
                        className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                        title="Delete report"
                      >
                        <i data-lucide="trash-2" className="w-4 h-4 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"></i>
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-slate-400 mb-2 line-clamp-2">{report.description || 'No description'}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-500">
                      <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                      <span>{(report.fileSize / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Health Analytics - Only for Patients */}
        {currentUser2?.role === 'patient' && (
        <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 rounded-2xl p-6 text-center">
            <div className={`text-4xl font-bold ${getHealthScoreColor(getHealthScore())}`}>
              {getHealthScore()}%
            </div>
            <div className="text-gray-600 mt-2">{t.health_score}</div>
            <div className="text-sm text-gray-500 mt-1">
              {getHealthScoreLabel(getHealthScore())}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 rounded-2xl p-6 text-center">
            <div className="text-4xl font-bold text-teal-600">
              {appointments.length}
            </div>
            <div className="text-gray-600 mt-2">Total Appointments</div>
            <div className="text-sm text-gray-500 mt-1">
              {t.last_updated}: {new Date().toLocaleDateString()}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 rounded-2xl p-6 text-center">
            <div className="text-4xl font-bold text-blue-600">
              {appointments.filter(apt => apt.status === 'completed').length}
            </div>
            <div className="text-gray-600 mt-2">Completed</div>
            <div className="text-sm text-gray-500 mt-1">
              {appointments.length > 0
                ? Math.round((appointments.filter(apt => apt.status === 'completed').length / appointments.length) * 100)
                : 0}% completion rate
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Appointments Over Time */}
          <div className="bg-white dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 rounded-2xl p-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t.appointments_over_time}</h2>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="border border-gray-300 dark:border-slate-600 rounded px-3 py-1 text-sm bg-white dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/60"
              >
                <option value="6months">Last 6 Months</option>
                <option value="12months">Last 12 Months</option>
                <option value="year">This Year</option>
              </select>
            </div>
            <div className="h-64">
              {appointments.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={generateChartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="appointments"
                      stroke="#14B8A6"
                      strokeWidth={2}
                      dot={{ fill: '#14B8A6' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <i data-lucide="bar-chart" className="w-12 h-12 mx-auto mb-2"></i>
                    <p>{t.no_data}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Status Distribution */}
          <div className="bg-white dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {t.appointment_status}
            </h2>
            <div className="h-64">
              {appointments.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getStatusDistribution()}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {getStatusDistribution().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <i data-lucide="pie-chart" className="w-12 h-12 mx-auto mb-2"></i>
                    <p>{t.no_data}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Appointment History Table */}
        <div className="bg-white dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 rounded-2xl">
          <div className="p-6 border-b border-gray-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t.appointment_history}</h2>
          </div>

          {appointments.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i data-lucide="file-text" className="w-8 h-8 text-gray-400"></i>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t.no_data}</h3>
              <p className="text-gray-600">Complete some appointments to see your health reports</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Doctor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-700">
                  {appointments.map((appointment) => (
                    <tr key={appointment._id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {new Date(appointment.datetime).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        Healthcare Provider
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {appointment.reason}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          appointment.status === 'completed' ? 'bg-green-100 text-green-800' :
                          appointment.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                          appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {t[appointment.status] || appointment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>
        )}

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowUploadModal(false)}>
            <div className="bg-white dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Upload Medical Report</h3>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <i data-lucide="x" className="w-6 h-6"></i>
                </button>
              </div>

              <form onSubmit={handleUpload}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={uploadForm.title}
                      onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                      className="w-full border border-gray-100 dark:border-slate-800 rounded-2xl px-3 py-2 bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                      placeholder="e.g., Blood Test Results"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Report Type
                    </label>
                    <select
                      value={uploadForm.reportType}
                      onChange={(e) => setUploadForm({ ...uploadForm, reportType: e.target.value })}
                      className="w-full border border-gray-100 dark:border-slate-800 rounded-2xl px-3 py-2 bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="lab">Lab Report</option>
                      <option value="xray">X-Ray</option>
                      <option value="mri">MRI Scan</option>
                      <option value="ct">CT Scan</option>
                      <option value="prescription">Prescription</option>
                      <option value="discharge">Discharge Summary</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={uploadForm.description}
                      onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                      className="w-full border border-gray-100 dark:border-slate-800 rounded-2xl px-3 py-2 bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                      placeholder="Additional notes about this report..."
                      rows="3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      File <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      onChange={handleFileChange}
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="w-full border border-gray-100 dark:border-slate-800 rounded-2xl px-3 py-2 bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      Accepted: PDF, JPEG, PNG (Max 5MB)
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-50 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800 rounded-2xl text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-2xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <i data-lucide="upload" className="w-4 h-4"></i>
                        Upload
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Report Viewer Modal */}
        {selectedReport && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedReport(null)}>
            <div className="bg-white dark:bg-slate-800 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedReport.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mt-1 capitalize">{selectedReport.reportType}</p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={selectedReport.fileData}
                    download={getFormattedFilename(selectedReport)}
                    className="p-2 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg transition-colors"
                    title="Download"
                  >
                    <i data-lucide="download" className="w-5 h-5"></i>
                  </a>
                  {currentUser2?.role === 'patient' && (
                    <button
                      onClick={() => handleDeleteReport(selectedReport._id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <i data-lucide="trash-2" className="w-5 h-5"></i>
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedReport(null)}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors"
                  >
                    <i data-lucide="x" className="w-6 h-6"></i>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-6">
                {selectedReport.description && (
                  <div className="mb-4 p-4 bg-gray-50 dark:bg-slate-900 rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-slate-300">{selectedReport.description}</p>
                  </div>
                )}

                <div className="mb-4 flex items-center gap-4 text-sm text-gray-600 dark:text-slate-400">
                  <span>Uploaded: {new Date(selectedReport.createdAt).toLocaleString()}</span>
                  <span>•</span>
                  <span>Size: {(selectedReport.fileSize / 1024).toFixed(1)} KB</span>
                </div>

                <div className="bg-gray-100 dark:bg-slate-900 rounded-lg p-4 flex items-center justify-center min-h-[400px]">
                  {selectedReport.fileType.includes('pdf') ? (
                    <iframe
                      src={selectedReport.fileData}
                      className="w-full h-[600px] rounded"
                      title="Report PDF"
                    />
                  ) : (
                    <img
                      src={selectedReport.fileData}
                      alt={selectedReport.title}
                      className="max-w-full max-h-[600px] rounded-lg shadow-lg"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
