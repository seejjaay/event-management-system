import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { InlineBanner } from '../components/ui/StateViews';
import Logo from '../components/ui/Logo';
import PasswordChecklist from '../components/ui/PasswordChecklist';
import { checkName, checkEmail, checkPassword, collapseSpaces, normalizeEmail, LIMITS } from '../utils/validators';

export default function SignUpPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  const validate = () => {
    const errors = {};
    const nameErr = checkName(name);
    const emailErr = checkEmail(email);
    const passwordErr = checkPassword(password);
    if (nameErr) errors.name = nameErr;
    if (emailErr) errors.email = emailErr;
    if (passwordErr) errors.password = passwordErr;

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!validate()) return;

    setIsLoading(true);
    try {
      await register({
        name: collapseSpaces(name),
        email: normalizeEmail(email),
        password,
      });
      navigate('/calendar');
    } catch (err) {
      if (err.status === 409) {
        setErrorMessage('An account with this email address already exists. Please log in.');
      } else if (err.status === 400 && err.errors) {
        setValidationErrors(err.errors);
      } else {
        setErrorMessage(err.message || 'Failed to create account.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7F9] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full mx-auto bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6">
          <Logo size={44} className="mb-3 shadow-sm rounded-xl" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900">OrgaVents</h1>
        </div>

        {/* Segmented Pill Toggle */}
        <div className="p-1 rounded-2xl bg-slate-100 flex items-center mb-6">
          <Link
            to="/login"
            className="flex-1 py-1.5 text-center text-xs font-medium rounded-xl text-slate-500 hover:text-slate-900 transition-all"
          >
            Log In
          </Link>
          <button
            type="button"
            className="flex-1 py-1.5 text-center text-xs font-semibold rounded-xl bg-white text-slate-900 shadow-sm transition-all"
          >
            Sign Up
          </button>
        </div>

        {/* Error Notice */}
        {errorMessage && (
          <div className="mb-4">
            <InlineBanner type="error" message={errorMessage} onDismiss={() => setErrorMessage('')} />
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSignUpSubmit} noValidate className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="signup-1">
              Full Name
            </label>
            <input id="signup-1"
              type="text"
              required
              value={name}
              maxLength={LIMITS.NAME_MAX}
              autoComplete="name"
              onChange={(e) => {
                setName(e.target.value);
                if (validationErrors.name) setValidationErrors((prev) => ({ ...prev, name: null }));
              }}
              placeholder="Your name"
              className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none text-sm transition-all text-slate-900 placeholder:text-slate-400"
            />
            {validationErrors.name && (
              <p role="alert" className="text-xs text-red-600 mt-1">{validationErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="signup-2">
              Email
            </label>
            <input id="signup-2"
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
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="signup-3">
              Password
            </label>
            <div className="relative flex items-center">
              <input id="signup-3"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                maxLength={LIMITS.PASSWORD_MAX_BYTES}
                autoComplete="new-password"
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (validationErrors.password) setValidationErrors((prev) => ({ ...prev, password: null }));
                }}
                placeholder="Create a strong password"
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
            <PasswordChecklist value={password} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="signup-4">
              Confirm Password
            </label>
            <div className="relative flex items-center">
              <input id="signup-4"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                maxLength={LIMITS.PASSWORD_MAX_BYTES}
                autoComplete="new-password"
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (validationErrors.confirmPassword) setValidationErrors((prev) => ({ ...prev, confirmPassword: null }));
                }}
                placeholder="Repeat password"
                className="w-full h-11 pl-4 pr-11 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none text-sm transition-all text-slate-900 placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-1 text-slate-400 hover:text-slate-600 p-2.5"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {validationErrors.confirmPassword && (
              <p role="alert" className="text-xs text-red-600 mt-1">{validationErrors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 mt-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-all shadow-sm disabled:opacity-50 active:scale-[0.99]"
          >
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>
      </div>
    </div>
  );
}
