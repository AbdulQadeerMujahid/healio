import React, { useEffect, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import * as Lucide from "lucide";
import Login from "./pages/Login";
import PatientDashboard from "./pages/PatientDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import DoctorNotes from "./pages/DoctorNotes";
import DoctorCreate from "./pages/DoctorCreate";
import Appointments from "./pages/Appointments";
import Messages from "./pages/Messages";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import { NotificationProvider } from "./context/NotificationContext";
import { useLanguage } from "./context/LanguageContext";
import NotificationsPage from "./pages/Notifications";

const toPascalCase = (name = "") =>
  String(name)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

const iconAlias = {
  "layout-dashboard": "LayoutDashboard",
  "message-circle": "MessageCircle",
  "file-text": "FileText",
  "calendar-plus": "CalendarPlus",
  "heart-pulse": "HeartPulse",
  "folder-open": "FolderOpen",
  "external-link": "ExternalLink",
  "plus-circle": "PlusCircle",
  "x-circle": "XCircle",
  "calendar-x": "CalendarX",
  "trash-2": "Trash2",
  "user-plus": "UserPlus",
  "arrow-left": "ArrowLeft",
  "check-circle": "CheckCircle",
  "clipboard-list": "ClipboardList",
  "bar-chart": "BarChart3",
  "pie-chart": "PieChart",
  "log-in": "LogIn",
  "log-out": "LogOut",
};

const buildSvgMarkup = (iconName) => {
  const iconKey = iconAlias[iconName] || toPascalCase(iconName);
  const iconNode = Lucide[iconKey];
  if (!Array.isArray(iconNode)) return "";

  const children = iconNode
    .map(([tag, attrs]) => {
      const attrsString = Object.entries(attrs || {})
        .map(([k, v]) => `${k}="${String(v)}"`)
        .join(" ");
      return `<${tag} ${attrsString}></${tag}>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-${iconName}">${children}</svg>`;
};

const renderLucideIconsInPlace = () => {
  if (typeof document === "undefined") return;

  const nodes = document.querySelectorAll("i[data-lucide]");
  nodes.forEach((node) => {
    const iconName = node.getAttribute("data-lucide") || "";
    const signature = `${iconName}|1.9`;
    if (node.getAttribute("data-lucide-rendered") === signature) return;

    const svg = buildSvgMarkup(iconName);
    if (!svg) return;

    node.innerHTML = svg;
    node.setAttribute("data-lucide-rendered", signature);
    node.setAttribute("aria-hidden", "true");
  });
};

export default function App() {
  const [user, setUserState] = useState(() => {
    const u = localStorage.getItem("user");
    const parsedUser = u ? JSON.parse(u) : null;
    console.log('🔐 App initialized with user:', parsedUser);
    if (parsedUser) {
      console.log('👤 User role:', parsedUser.role);
    }
    return parsedUser;
  });
  
  // Wrapper to log user changes
  const setUser = (newUser) => {
    console.log('🔄 setUser called with:', newUser);
    if (newUser) {
      console.log('  ├─ Name:', newUser.name);
      console.log('  ├─ Email:', newUser.email);
      console.log('  ├─ Role:', newUser.role);
      console.log('  └─ Specialization:', newUser.specialization);
    }
    setUserState(newUser);
  };
  
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "system");
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [newAppointmentCount, setNewAppointmentCount] = useState(0);
  const { lang } = useLanguage();

  const navigate = useNavigate();
  const location = useLocation();

  // Fetch unread messages and new appointments count
  useEffect(() => {
    if (!user) return;

    const fetchNotificationCounts = async () => {
      try {
        const token = localStorage.getItem("token");
        const apiBase = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app') 
          ? window.location.origin 
          : 'http://localhost:5000';
        const res = await fetch(
          `${apiBase}/api/appointments`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return;
        const appointments = await res.json();
        
        const seenMessages = JSON.parse(localStorage.getItem('seenMessages') || '{}');
        const viewedAppointments = JSON.parse(localStorage.getItem('viewedAppointments') || '{}');
        const userId = user?.id;
        const userSeenMessages = seenMessages[userId] || {};
        const userViewedAppointments = viewedAppointments[userId] || [];
        
        // Count unread messages
        let totalUnseen = 0;
        // Count new appointments
        let newAptCount = 0;
        
        appointments.forEach(apt => {
          // Count unread messages in this appointment
          const messages = apt.messages || [];
          const seenIds = userSeenMessages[apt._id] || [];
          const unseenCount = messages.filter(msg => {
            const isMyMessage = msg.author?._id === userId;
            const isSeen = seenIds.includes(msg.createdAt || msg._id);
            return !isMyMessage && !isSeen;
          }).length;
          totalUnseen += unseenCount;
          
          // Count new appointments (pending status and not yet viewed)
          if (apt.status === 'pending' && !userViewedAppointments.includes(apt._id)) {
            newAptCount += 1;
          }
        });
        
        setUnreadMessageCount(totalUnseen);
        setNewAppointmentCount(newAptCount);
      } catch (err) {
        console.log('Error fetching notification counts:', err);
      }
    };

    fetchNotificationCounts();
    const interval = setInterval(fetchNotificationCounts, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [user]);

  // Apply theme to html element and watch system preference
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      const systemDark = media.matches;
      const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
      root.classList.toggle('dark', resolved === 'dark');
    };

    apply();
    localStorage.setItem('theme', theme);
    if (theme === 'system') {
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }
  }, [theme]);

  useEffect(() => {
    renderLucideIconsInPlace();

    const observer = new MutationObserver(() => {
      renderLucideIconsInPlace();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    console.log('🚦 Route check:', {
      pathname: location.pathname,
      userRole: user?.role,
      userName: user?.name
    });

    // Allow both /doctor/create and /doctor-create for doctor registration
    if (location.pathname === "/doctor/create" || location.pathname === "/doctor-create") return;

    // Define valid routes for each user role
    const validPatientRoutes = ["/patient", "/patient/appointments", "/patient/messages", "/patient/reports", "/patient/notifications", "/patient/settings"];
    const validDoctorRoutes = ["/doctor", "/doctor/appointments", "/doctor/messages", "/doctor/reports", "/doctor/notes", "/doctor/notifications", "/doctor/settings"];
    const publicRoutes = ["/login", "/doctor/create", "/doctor-create"];

    if (user) {
      const validRoutes = user.role === "doctor" ? validDoctorRoutes : validPatientRoutes;
      console.log('✅ User logged in:', user.role);
      console.log('📍 Valid routes for', user.role + ':', validRoutes);
      console.log('🔍 Current path:', location.pathname);
      
      if (!validRoutes.includes(location.pathname)) {
        const redirectTo = user.role === "doctor" ? "/doctor" : "/patient";
        console.log('🔀 Redirecting to:', redirectTo);
        // Redirect to appropriate dashboard if on invalid route
        navigate(redirectTo);
      } else {
        console.log('✓ Path is valid for user role');
      }
    } else {
      console.log('❌ No user logged in');
      // Allow public routes (login, doctor creation)
      if (!publicRoutes.includes(location.pathname)) {
        console.log('🔀 Redirecting to login');
        // Everyone uses the same /login page - it routes based on role automatically
        navigate("/login");
      }
    }
  }, [user, location.pathname]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    navigate("/login");
  };

  const cycleTheme = () => {
    setTheme((t) => (t === 'light' ? 'dark' : t === 'dark' ? 'system' : 'light'));
  };
  const themeIcon = theme === 'system' ? 'laptop' : theme === 'dark' ? 'moon' : 'sun';
  const themeLabel = theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light';

  const labels = {
    en: {
      dashboard: 'Dashboard',
      appointments: 'Appointments',
      messages: 'Messages',
      reports: 'Reports',
      notes: 'Notes',
      notifications: 'Notifications',
      settings: 'Settings',
      logout: 'Logout',
      login: 'Login',
      guest: 'Guest',
    },
    hi: {
      dashboard: 'डैशबोर्ड',
      appointments: 'अपॉइंटमेंट्स',
      messages: 'संदेश',
      reports: 'रिपोर्ट्स',
      notes: 'नोट्स',
      notifications: 'सूचनाएं',
      settings: 'सेटिंग्स',
      logout: 'लॉगआउट',
      login: 'लॉगिन',
      guest: 'अतिथि',
    },
    mr: {
      dashboard: 'डॅशबोर्ड',
      appointments: 'अपॉइंटमेंट्स',
      messages: 'संदेश',
      reports: 'अहवाल',
      notes: 'नोंदी',
      notifications: 'सूचना',
      settings: 'सेटिंग्स',
      logout: 'लॉगआउट',
      login: 'लॉगिन',
      guest: 'अतिथी',
    },
  };
  const tr = labels[lang] || labels.en;

  const baseNavigation = [
    { name: tr.dashboard, href: user?.role === 'doctor' ? '/doctor' : '/patient', icon: 'layout-dashboard' },
    { name: tr.appointments, href: user?.role === 'doctor' ? '/doctor/appointments' : '/patient/appointments', icon: 'calendar-days' },
    { name: tr.messages, href: user?.role === 'doctor' ? '/doctor/messages' : '/patient/messages', icon: 'messages-square' },
    { name: tr.reports, href: user?.role === 'doctor' ? '/doctor/reports' : '/patient/reports', icon: 'files' },
    user?.role === 'doctor' ? { name: tr.notes, href: '/doctor/notes', icon: 'notebook-pen' } : null,
    { name: tr.notifications, href: user?.role === 'doctor' ? '/doctor/notifications' : '/patient/notifications', icon: 'bell-ring' },
    { name: tr.settings, href: user?.role === 'doctor' ? '/doctor/settings' : '/patient/settings', icon: 'sliders-horizontal' },
  ];

  const navigation = baseNavigation.filter(Boolean);

  const isActiveRoute = (href) => {
    return location.pathname === href;
  };

  const isDarkMode = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
      <NotificationProvider user={user}>
        <div className="flex h-screen dashboard-bg">
      {/* Sidebar */}
      <div className="sidebar flex flex-col">
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-3 sm:px-4 border-b border-gray-200 gap-2">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <i data-lucide="heart-pulse" className="w-5 h-5 text-white"></i>
            </div>
            <span className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap truncate">Health Connect</span>
          </div>
          <label className="theme-toggle" title={`Theme: ${themeLabel}`}>
            <input
              type="checkbox"
              checked={isDarkMode}
              readOnly
              className="sr-only"
            />
            <div
              className={`theme-toggle-track ${isDarkMode ? 'active' : ''}`}
              onClick={cycleTheme}
            >
              <div className={`theme-toggle-thumb ${isDarkMode ? 'active' : ''}`}>
                <i
                  data-lucide={themeIcon}
                  className="theme-toggle-icon w-3 h-3"
                ></i>
              </div>
            </div>
            <span className="hidden lg:inline ml-2 text-sm font-medium text-gray-700 dark:text-gray-200 cursor-pointer" onClick={cycleTheme}>
              {themeLabel}
            </span>
          </label>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navigation.map((item) => (
            <a
              key={item.name}
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                navigate(item.href);
              }}
              className={`nav-link ${isActiveRoute(item.href) ? 'nav-link-active' : ''}`}
            >
              <div className="flex items-center justify-between flex-1">
                <div className="flex items-center space-x-2">
                  <i data-lucide={item.icon} className="w-5 h-5"></i>
                  <span className="font-medium">{item.name}</span>
                </div>
                {item.name === tr.messages && unreadMessageCount > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white transform bg-red-600 rounded-full">
                    {unreadMessageCount}
                  </span>
                )}
                {item.name === tr.appointments && newAppointmentCount > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white transform bg-red-600 rounded-full">
                    {newAppointmentCount}
                  </span>
                )}
              </div>
            </a>
          ))}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-gray-200">
          {user ? (
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                <i data-lucide="user" className="w-4 h-4 text-gray-600 dark:text-gray-300"></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-300 capitalize">{user.role}</p>
              </div>
            </div>
          ) : (
            <div className="mb-3">
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-2">
                <i data-lucide="user" className="w-4 h-4 text-gray-500 dark:text-gray-400"></i>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-300 text-center">{tr.guest}</p>
            </div>
          )}

          {user && (
            <button
              onClick={logout}
              className="w-full btn-primary text-sm"
            >
              <i data-lucide="log-out" className="w-4 h-4 mr-2"></i>
              {tr.logout}
            </button>
          )}

          {!user && location.pathname !== "/login" && (
            <button
              onClick={() => navigate("/login")}
              className="w-full btn-primary text-sm"
            >
              <i data-lucide="log-in" className="w-4 h-4 mr-2"></i>
              {tr.login}
            </button>
          )}
        </div>
      </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-visible">
          <main className="flex-1 overflow-y-auto p-8">
            <Routes>
              <Route path="/login" element={<Login onLogin={setUser} />} />
              <Route path="/doctor/create" element={<DoctorCreate onLogin={setUser} />} />
              <Route path="/doctor-create" element={<DoctorCreate onLogin={setUser} />} />
              <Route path="/patient" element={<PatientDashboard user={user} />} />
              <Route path="/doctor" element={<DoctorDashboard user={user} />} />
              <Route path="/patient/appointments" element={<Appointments user={user} />} />
              <Route path="/doctor/appointments" element={<Appointments user={user} />} />
              <Route path="/patient/messages" element={<Messages user={user} />} />
              <Route path="/doctor/messages" element={<Messages user={user} />} />
              <Route path="/patient/reports" element={<Reports user={user} />} />
              <Route path="/doctor/reports" element={<Reports user={user} />} />
              <Route path="/doctor/notes" element={<DoctorNotes user={user} />} />
              <Route path="/patient/notifications" element={<NotificationsPage user={user} />} />
              <Route path="/doctor/notifications" element={<NotificationsPage user={user} />} />
              <Route path="/patient/settings" element={<Settings user={user} />} />
              <Route path="/doctor/settings" element={<Settings user={user} />} />
            </Routes>
          </main>
        </div>
        </div>
      </NotificationProvider>
  );
}
