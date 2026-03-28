import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

const getApiUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return `${window.location.origin}/api`;
  }
  return import.meta.env.VITE_API_URL || "http://localhost:5000/api";
};

const API = getApiUrl();

export default function AdminLogin({ onLogin }) {
  const navigate = useNavigate();
  const { lang, setLang } = useLanguage();
  const [email, setEmail] = useState("admin@healthconnect.local");
  const [password, setPassword] = useState("Admin@123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const i18n = {
    en: {
      title: "Admin Login",
      subtitle: "Access complete platform analytics and directory data",
      email: "Email",
      password: "Password",
      login: "Sign In",
      back: "Back to User Login",
    },
    hi: {
      title: "एडमिन लॉगिन",
      subtitle: "पूर्ण प्लेटफ़ॉर्म डेटा और डायरेक्टरी देखने के लिए लॉगिन करें",
      email: "ईमेल",
      password: "पासवर्ड",
      login: "साइन इन",
      back: "यूज़र लॉगिन पर वापस जाएं",
    },
    mr: {
      title: "अॅडमिन लॉगिन",
      subtitle: "संपूर्ण प्लॅटफॉर्म डेटा आणि डायरेक्टरी पाहण्यासाठी लॉगिन करा",
      email: "ईमेल",
      password: "पासवर्ड",
      login: "साइन इन",
      back: "वापरकर्ता लॉगिनकडे परत",
    },
  };

  const t = i18n[lang] || i18n.en;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");
      if (data.user?.role !== "admin") throw new Error("Not an admin account");

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onLogin(data.user);
      navigate("/admin");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen dashboard-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t.title}</h1>
          <div className="flex gap-2">
            <button onClick={() => setLang("en")} className={`px-3 py-1 rounded ${lang === "en" ? "bg-teal-600 text-white" : "bg-gray-200 dark:bg-slate-700"}`}>EN</button>
            <button onClick={() => setLang("hi")} className={`px-3 py-1 rounded ${lang === "hi" ? "bg-teal-600 text-white" : "bg-gray-200 dark:bg-slate-700"}`}>हिं</button>
            <button onClick={() => setLang("mr")} className={`px-3 py-1 rounded ${lang === "mr" ? "bg-teal-600 text-white" : "bg-gray-200 dark:bg-slate-700"}`}>म</button>
          </div>
        </div>

        <p className="text-gray-600 dark:text-slate-300 text-sm">{t.subtitle}</p>

        {error && <div className="text-sm text-red-600 dark:text-red-300">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-700 dark:text-slate-300">{t.email}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 border border-gray-300 dark:border-slate-700 rounded px-3 py-2 bg-white dark:bg-slate-900 dark:text-white"
              required
            />
          </div>
          <div>
            <label className="text-sm text-gray-700 dark:text-slate-300">{t.password}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 border border-gray-300 dark:border-slate-700 rounded px-3 py-2 bg-white dark:bg-slate-900 dark:text-white"
              required
            />
          </div>

          <button disabled={loading} className="w-full btn-primary disabled:opacity-50">
            {loading ? "..." : t.login}
          </button>
        </form>

        <button onClick={() => navigate("/login")} className="w-full text-sm text-teal-600 dark:text-teal-400 hover:underline">
          {t.back}
        </button>
      </div>
    </div>
  );
}
