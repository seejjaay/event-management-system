import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  Inbox,
  ArrowRight,
} from 'lucide-react';

/**
 * Loading placeholder. It stays invisible (but keeps its space, so nothing jumps) for `delay` ms:
 * most loads finish sooner, and a skeleton that flashes for 50-150ms reads as flicker.
 * Slow loads still get the skeleton, faded in.
 */
export function LoadingSkeleton({ delay = 250, ...props }) {
  const [visible, setVisible] = useState(delay <= 0);
  useEffect(() => {
    if (delay <= 0) return undefined;
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className={visible ? 'skeleton-in' : 'invisible'} aria-busy="true" aria-label="Loading">
      <SkeletonShapes {...props} />
    </div>
  );
}

function SkeletonShapes({ variant = 'card', count = 1 }) {
  const items = Array.from({ length: count });

  if (variant === 'profile') {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 p-8 space-y-6 shadow-sm animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-100"></div>
          <div className="space-y-2 flex-1">
            <div className="h-5 bg-slate-100 rounded w-48"></div>
            <div className="h-4 bg-slate-100 rounded w-32"></div>
          </div>
        </div>
        <div className="space-y-3 pt-2">
          <div className="h-11 bg-slate-100 rounded-xl w-full"></div>
          <div className="h-11 bg-slate-100 rounded-xl w-full"></div>
        </div>
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden animate-pulse">
        <div className="h-14 bg-slate-50 border-b border-slate-100 px-6 flex items-center justify-between">
          <div className="h-4 bg-slate-200 rounded w-32"></div>
          <div className="h-4 bg-slate-200 rounded w-24"></div>
        </div>
        <div className="divide-y divide-slate-100">
          {items.map((_, i) => (
            <div key={i} className="p-4 px-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0"></div>
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 bg-slate-100 rounded w-1/3"></div>
                  <div className="h-3 bg-slate-100 rounded w-1/4"></div>
                </div>
              </div>
              <div className="h-6 bg-slate-100 rounded-full w-20"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default: Event Card Skeleton
  return (
    <div className="space-y-3">
      {items.map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm animate-pulse flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <div className="h-5 bg-slate-100 rounded-full w-28"></div>
            <div className="h-5 bg-slate-100 rounded-full w-20"></div>
          </div>
          <div className="h-6 bg-slate-100 rounded w-2/3"></div>
          <div className="h-4 bg-slate-100 rounded w-1/3"></div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title = 'No items found',
  description = 'There are no records to display.',
  actionText = null,
  actionIcon: ActionIcon = ArrowRight,
  onAction = null,
  className = '',
}) {
  return (
    <div
      className={`bg-white rounded-3xl border border-slate-100 shadow-sm p-12 text-center flex flex-col items-center justify-center ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-4">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 tracking-tight mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-slate-500 max-w-sm mb-4 leading-relaxed">
          {description}
        </p>
      )}
      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium inline-flex items-center gap-1.5 transition-all shadow-sm"
        >
          <span>{actionText}</span>
          <ActionIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function InlineBanner({
  type = 'error',
  title = null,
  message,
  onDismiss = null,
  className = '',
}) {
  if (!message) return null;

  const config = {
    error: {
      container: 'bg-red-50 text-red-900 border-red-100',
      icon: AlertTriangle,
      iconColor: 'text-red-500',
    },
    warning: {
      container: 'bg-amber-50 text-amber-900 border-amber-100',
      icon: AlertCircle,
      iconColor: 'text-amber-500',
    },
    success: {
      container: 'bg-emerald-50 text-emerald-900 border-emerald-100',
      icon: CheckCircle2,
      iconColor: 'text-emerald-500',
    },
    info: {
      container: 'bg-slate-50 text-slate-900 border-slate-100',
      icon: Info,
      iconColor: 'text-slate-500',
    },
  }[type] || {
    container: 'bg-slate-50 text-slate-900 border-slate-100',
    icon: Info,
    iconColor: 'text-slate-500',
  };

  const IconComponent = config.icon;

  return (
    <div
      className={`p-4 rounded-2xl border flex items-start gap-3 text-left transition-all ${config.container} ${className}`}
      role="alert"
    >
      <IconComponent className={`w-5 h-5 shrink-0 mt-0.5 ${config.iconColor}`} />
      <div className="flex-1 min-w-0">
        {title && <p className="text-sm font-semibold mb-0.5">{title}</p>}
        <p className="text-xs sm:text-sm leading-relaxed">{message}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss banner"
          className="p-2 -m-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default {
  LoadingSkeleton,
  EmptyState,
  InlineBanner,
};
