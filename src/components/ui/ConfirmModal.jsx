import React, { useId } from 'react';
import { AlertTriangle, AlertCircle, X, Loader2 } from 'lucide-react';
import useDialog from '../../hooks/useDialog';

export default function ConfirmModal({
  isOpen,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = true,
  isLoading = false,
  warningAlert = null,
  onConfirm,
  onClose,
}) {
  const titleId = useId();
  const dialogRef = useDialog({ isOpen, onClose, canClose: !isLoading });

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Soft blur backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={!isLoading ? onClose : undefined}
      />

      {/* Apple style Bento modal card */}
      <div className="relative w-full max-w-sm bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.08)] p-6 z-10 transition-all">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                isDestructive ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-800'
              }`}
            >
              {isDestructive ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
            </div>
            <h3 id={titleId} className="text-lg font-bold tracking-tight text-slate-900">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close"
            className="p-2 -m-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          {message}
        </p>

        {warningAlert && (
          <div className="mt-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-600 leading-relaxed">
            {warningAlert}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            data-autofocus
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 transition-all shadow-sm ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700 text-white-fixed'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
