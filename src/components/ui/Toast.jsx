import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const VARIANTS = {
  success: { icon: CheckCircle2, iconColor: 'text-emerald-500', bar: 'bg-emerald-500' },
  error: { icon: AlertTriangle, iconColor: 'text-red-500', bar: 'bg-red-500' },
  warning: { icon: AlertCircle, iconColor: 'text-amber-500', bar: 'bg-amber-500' },
  info: { icon: Info, iconColor: 'text-slate-500', bar: 'bg-slate-400' },
};

const DEFAULT_DURATION = { success: 3500, info: 3500, warning: 5000, error: 6000 };
const MAX_VISIBLE = 4;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type, message, options = {}) => {
      if (!message) return null;
      const id = ++idRef.current;
      const duration = options.duration ?? DEFAULT_DURATION[type] ?? 4000;
      setToasts((prev) => [...prev, { id, type, message, title: options.title || null }].slice(-MAX_VISIBLE));
      if (duration > 0) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (message, options) => push('success', message, options),
      error: (message, options) => push('error', message, options),
      warning: (message, options) => push('warning', message, options),
      info: (message, options) => push('info', message, options),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="fixed z-[100] bottom-4 right-4 left-4 sm:left-auto sm:w-96 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => {
          const v = VARIANTS[t.type] || VARIANTS.info;
          const Icon = v.icon;
          return (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className="toast-enter pointer-events-auto relative overflow-hidden flex items-start gap-3 p-4 pl-5 rounded-2xl bg-white border border-slate-100 shadow-[0_8px_32px_rgba(15,23,42,0.14)]"
            >
              <span className={`absolute left-0 top-0 bottom-0 w-1 ${v.bar}`} />
              <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${v.iconColor}`} />
              <div className="flex-1 min-w-0">
                {t.title && <p className="text-sm font-semibold text-slate-900 mb-0.5">{t.title}</p>}
                <p className="text-sm text-slate-700 leading-relaxed">{t.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="p-2 -m-2 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
