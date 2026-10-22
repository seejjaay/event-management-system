import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { InlineBanner } from '../components/ui/StateViews';
import Logo from '../components/ui/Logo';
import { checkEmail, normalizeEmail, LIMITS } from '../utils/validators';
import { resetMockDB } from '../services/mockBackend.js';

// Detect mock mode
const USE_MOCK =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_MOCK === 'true';
// Quick sign-in is a local-dev convenience: needs mock mode AND a dev server (Vite sets DEV false in builds)
const SHOW_QUICK_LOGIN = USE_MOCK && import.meta.env.DEV;

export default function LoginPage() {
  const { login, isAuthenticated, authNotice, clearAuthNotice } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [quickLoginRole, setQuickLoginRole] = useState(null); // track which quick-login is active
  const [errorMessage, setErrorMessage] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [resetNotice, setResetNotice] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/calendar');
    }
  }, [isAuthenticated, navigate]);

  const validate = () => {
    const errors = {};
    const emailErr = checkEmail(email);
    if (emailErr) errors.email = emailErr;

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < LIMITS.PASSWORD_MIN) {
      errors.password = `Password must be at least ${LIMITS.PASSWORD_MIN} characters`;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    clearAuthNotice();

    if (!validate()) return;

    setIsLoading(true);
    try {
      await login(normalizeEmail(email), password);
      navigate('/calendar');
    } catch (err) {
      if (err.status === 401) {
        setErrorMessage('Invalid email or password.');
      } else if (err.status === 403) {
        setErrorMessage('Account deactivated. Contact an administrator.');
      } else if (err.status === 429) {
        setErrorMessage('Too many failed attempts. Please try again in 15 minutes.');
      } else {
        setErrorMessage(err.message || 'Authentication error.');
      }
    } finally {
      setIsLoading(false);
      setQuickLoginRole(null);
    }
  };

  /** Instantly log in as a demo user without typing (one-click) */
  const handleQuickLogin = async (demoRole) => {
    setErrorMessage('');
    clearAuthNotice();
    setQuickLoginRole(demoRole);

    const credentials = {
      admin: { email: 'admin@orgavents.edu', password: 'Password123!' },
      organizer: { email: 'organizer@campus.edu', password: 'Password123!' },
      member: { email: 'member@campus.edu', password: 'Password123!' },
    };

    const { email: demoEmail, password: demoPassword } = credentials[demoRole];
    setEmail(demoEmail);
    setPassword(demoPassword);
    setValidationErrors({});

    setIsLoading(true);
    try {
      await login(demoEmail, demoPassword);
      navigate('/calendar');
    } catch (err) {
      setErrorMessage(err.message || 'Quick login failed.');
    } finally {
      setIsLoading(false);
      setQuickLoginRole(null);
    }
  };

  /** Reset mock data back to seed state */
  const handleResetDemo = () => {
    if (!USE_MOCK) return;
    resetMockDB();
    // Also clear auth state
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setEmail('');
    setPassword('');
    setErrorMessage('');
    setValidationErrors({});
    setResetNotice('Demo data reset successfully! All changes cleared.');
    setTimeout(() => setResetNotice(''), 4000);
  };

  return (
    <div className="min-h-screen bg-[#F5F7F9] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full mx-auto bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6">
          <Logo size={44} className="mb-3 shadow-sm rounded-xl" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900">OrgaVents</h1>
          {USE_MOCK && (
            <span className="mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 tracking-wide uppercase">
              Mock Mode
            </span>
          )}
        </div>

        {/* Segmented Pill Toggle */}
        <div className="p-1 rounded-2xl bg-slate-100 flex items-center mb-6">
          <button
            type="button"
            className="flex-1 py-1.5 text-center text-xs font-semibold rounded-xl bg-white text-slate-900 shadow-sm transition-all"
          >
            Log In
          </button>
          <Link
            to="/signup"
            className="flex-1 py-1.5 text-center text-xs font-medium rounded-xl text-slate-500 hover:text-slate-900 transition-all"
          >
            Sign Up
          </Link>
        </div>

        {/* Notices */}
        {authNotice && (
          <div className="mb-4">
            <InlineBanner type="warning" message={authNotice} onDismiss={clearAuthNotice} />
          </div>
        )}
        {errorMessage && (
          <div className="mb-4">
            <InlineBanner type="error" message={errorMessage} onDismiss={() => setErrorMessage('')} />
          </div>
        )}
        {resetNotice && (
          <div className="mb-4">
            <InlineBanner type="success" message={resetNotice} onDismiss={() => setResetNotice('')} />
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              maxLength={LIMITS.EMAIL_MAX}
              autoComplete="email"
              onChange={(e) => {
                setEmail(e.target.value);
                if (validationErrors.email) setValidationErrors((prev) => ({ ...prev, email: null }));
              }}
              placeholder="user@university.edu"
              className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none text-sm transition-all text-slate-900 placeholder:text-slate-400"
            />
            {validationErrors.email && (
              <p role="alert" className="text-xs text-red-600 mt-1">{validationErrors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="login-password">
              Password
            </label>
            <div className="relative flex items-center">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                maxLength={LIMITS.PASSWORD_MAX_BYTES}
                autoComplete="current-password"
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (validationErrors.password) setValidationErrors((prev) => ({ ...prev, password: null }));
                }}
                placeholder="Enter password"
                className="w-full h-11 pl-4 pr-11 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none text-sm transition-all text-slate-900 placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1 text-slate-400 hover:text-slate-600 p-2.5"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {validationErrors.password && (
              <p role="alert" className="text-xs text-red-600 mt-1">{validationErrors.password}</p>
            )}
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            disabled={isLoading}
            className="w-full h-11 mt-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-all shadow-sm disabled:opacity-50 active:scale-[0.99]"
          >
            {isLoading && !quickLoginRole ? 'Signing In...' : 'Log In'}
          </button>
        </form>

        {/* Quick Login — local mock-mode dev builds only; never in a deployed or live-backend build */}
        {SHOW_QUICK_LOGIN && (
        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-2">
            ⚡ Instant Demo Login
          </span>
          <div className="flex items-center justify-center gap-2">
            {[
              { role: 'admin', label: 'Admin', color: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200' },
              { role: 'organizer', label: 'Organizer', color: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200' },
              { role: 'member', label: 'Member', color: 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200' },
            ].map(({ role, label, color }) => (
              <button
                key={role}
                id={`quick-login-${role}`}
                type="button"
                disabled={isLoading}
                onClick={() => handleQuickLogin(role)}
                className={`px-3 py-1 rounded-lg border text-xs font-medium transition-all disabled:opacity-50 ${color} ${
                  quickLoginRole === role ? 'opacity-60 cursor-wait' : ''
                }`}
              >
                {quickLoginRole === role ? '...' : label}
              </button>
            ))}
          </div>
        </div>
        )}
      </div>

      {/* Reset Demo Data button — bottom corner, only shown in mock mode */}
      {USE_MOCK && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            id="reset-demo-btn"
            type="button"
            onClick={handleResetDemo}
            title="Reset all localStorage demo data back to seed state"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 shadow-md text-xs font-medium text-slate-500 hover:text-slate-900 hover:border-slate-400 transition-all active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Demo Data
          </button>
        </div>
      )}
    </div>
  );
}
