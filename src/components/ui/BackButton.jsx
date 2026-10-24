import React from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import useGoBack from '../../hooks/useGoBack';

/** Global back button: behaves exactly like the browser's back button. */
export default function BackButton() {
  const { pathname } = useLocation();
  const { goBack, hasHistory } = useGoBack();

  // Nothing to go back to on the landing page of a fresh visit
  if (!hasHistory && pathname === '/calendar') return null;

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 max-w-7xl mx-auto w-full">
      <button
        type="button"
        onClick={() => goBack()}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white border border-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold shadow-sm transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </button>
    </div>
  );
}
