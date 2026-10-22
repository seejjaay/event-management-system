import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/ui/Logo';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#F5F7F9] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-100 p-8 text-center shadow-sm">
        <Logo size={44} className="mx-auto mb-4 rounded-xl" />
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          That address doesn't lead anywhere. It may have moved, or the link may be mistyped.
        </p>
        <Link
          to="/calendar"
          className="inline-block mt-6 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-all"
        >
          Back to calendar
        </Link>
      </div>
    </div>
  );
}
