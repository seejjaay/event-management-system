import React from 'react';
import { AlertTriangle } from 'lucide-react';

/** Catches render errors so one broken screen shows a recovery path instead of a blank page. */
export default class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[UI Error]', error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-[#F5F7F9] flex items-center justify-center p-4">
        <div role="alert" className="max-w-md w-full bg-white rounded-3xl border border-slate-100 p-8 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            This screen hit an unexpected error. Reloading usually fixes it; your data is safe.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-all"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
