import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Auto-detect API URL for both development and production
const getApiUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return `${window.location.origin}/api`;
  }
  return import.meta.env.VITE_API_URL || "http://localhost:5000/api";
};

const API = getApiUrl();
const token = () => localStorage.getItem("token");
const getUser = () => JSON.parse(localStorage.getItem("user") || "null");

export default function AppointmentsPage({ user: currentUser }) {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [openCall, setOpenCall] = useState(null);
  const user = getUser();

  // Fetch appointments
  const fetchAppointments = async () => {
    try {
      const response = await fetch(`${API}/appointments/me`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAppointments(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching appointments:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAppointments();
    
    // Mark appointments as viewed
    const markAppointmentsAsViewed = () => {
      const viewedAppointments = JSON.parse(localStorage.getItem('viewedAppointments') || '{}');
      const userId = user?.id;
      if (!userId) return;
      
      if (!viewedAppointments[userId]) {
        viewedAppointments[userId] = [];
      }
      
      // Mark all appointments as viewed
      appointments.forEach(apt => {
        if (!viewedAppointments[userId].includes(apt._id)) {
          viewedAppointments[userId].push(apt._id);
        }
      });
      
      localStorage.setItem('viewedAppointments', JSON.stringify(viewedAppointments));
    };
    
    if (appointments.length > 0) {
      markAppointmentsAsViewed();
    }
  }, [appointments]);

  // Cancel appointment (patient only)
  const cancelAppointment = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    
    try {
      const response = await fetch(`${API}/appointments/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ status: 'declined' }),
      });
      if (response.ok) {
        fetchAppointments();
      }
    } catch (error) {
      console.error("Error cancelling appointment:", error);
    }
  };

  // Filter appointments
  const filterAppointments = () => {
    const now = new Date();
    
    switch(filter) {
      case 'upcoming':
        return appointments.filter(a => 
          new Date(a.datetime) > now && 
          (a.status === 'pending' || a.status === 'accepted')
        );
      case 'past':
        return appointments.filter(a => 
          new Date(a.datetime) < now || 
          a.status === 'completed' || 
          a.status === 'declined'
        );
      case 'pending':
        return appointments.filter(a => a.status === 'pending');
      case 'accepted':
        return appointments.filter(a => a.status === 'accepted');
      case 'completed':
        return appointments.filter(a => a.status === 'completed');
      default:
        return appointments;
    }
  };

  const filtered = filterAppointments();

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
      accepted: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
      completed: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
      declined: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
      rescheduled: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
    };
    return styles[status] || styles.pending;
  };

  if (loading) {
    return (
      <div className="min-h-screen dashboard-bg p-8">
        <div className="max-w-6xl mx-auto">
          <div className="card p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-slate-400">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen dashboard-bg p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Appointments
          </h1>
          <p className="text-gray-600 dark:text-slate-400">
            Manage your appointments and consultations
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['all', 'upcoming', 'past', 'pending', 'accepted', 'completed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              <span className="capitalize">{f}</span>
            </button>
          ))}
        </div>

        {/* Appointments List */}
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <i data-lucide="calendar-x" className="w-8 h-8 text-gray-400"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No appointments found
              </h3>
              <p className="text-gray-600 dark:text-slate-400">
                {filter === 'all' ? 'Book your first appointment to get started' : `No ${filter} appointments`}
              </p>
            </div>
          ) : (
            filtered.map((appointment) => (
              <div key={appointment._id} className="card p-6">
                {/* Appointment Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center">
                        <i data-lucide="user" className="w-6 h-6 text-teal-600 dark:text-teal-400"></i>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {user?.role === 'doctor' 
                            ? appointment.patient?.name || 'Patient'
                            : appointment.doctor?.name || 'Doctor'}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-slate-400">
                          {user?.role === 'doctor' && appointment.patient?.email}
                          {user?.role === 'patient' && appointment.doctor?.specialization}
                        </p>
                      </div>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(appointment.status)}`}>
                    {appointment.status}
                  </span>
                </div>

                {/* Appointment Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center text-sm text-gray-600 dark:text-slate-400">
                    <i data-lucide="calendar" className="w-4 h-4 mr-2 text-teal-600"></i>
                    {new Date(appointment.datetime).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-slate-400">
                    <i data-lucide="clock" className="w-4 h-4 mr-2 text-teal-600"></i>
                    {new Date(appointment.datetime).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-slate-400">
                    <i data-lucide="file-text" className="w-4 h-4 mr-2 text-teal-600"></i>
                    Reason: {appointment.reason}
                  </div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-slate-400">
                    <i data-lucide="activity" className="w-4 h-4 mr-2 text-teal-600"></i>
                    Age: {appointment.age} | Weight: {appointment.weight}kg
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  {/* Patient Actions */}
                  {user?.role === 'patient' && (
                    <>
                      {(appointment.status === 'pending' || appointment.status === 'accepted') && (
                        <button
                          onClick={() => cancelAppointment(appointment._id)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800 transition-colors"
                        >
                          <i data-lucide="x-circle" className="w-3.5 h-3.5"></i>
                          Cancel
                        </button>
                      )}
                    </>
                  )}

                  {/* Video Call Button - Only show for accepted appointments, not completed or declined */}
                  {appointment.meetingLink && 
                   appointment.status === 'accepted' && 
                   new Date(appointment.datetime) <= new Date() && (
                    <button
                      onClick={() => setOpenCall(appointment._id)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 transition-colors shadow-sm"
                    >
                      <i data-lucide="video" className="w-3.5 h-3.5"></i>
                      Join Call
                    </button>
                  )}

                  {/* Messages Button */}
                  {appointment.status === 'accepted' && (
                    <button 
                      onClick={() => navigate(`/${user?.role}/messages?appointmentId=${appointment._id}`)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors"
                    >
                      <i data-lucide="message-circle" className="w-3.5 h-3.5"></i>
                      Messages
                    </button>
                  )}

                  {/* View Details */}
                  <button className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-600 transition-colors">
                    <i data-lucide="info" className="w-3.5 h-3.5"></i>
                    Details
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Video Call Modal */}
      {openCall && (() => {
        const appt = appointments.find(x => x._id === openCall);
        if (!appt || !appt.meetingLink) return null;
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
                      Video Consultation
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      {user?.role === 'doctor' ? appt.patient?.name : appt.doctor?.name}
                    </p>
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
                  title="Video Call"
                />
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
