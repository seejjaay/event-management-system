import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const toInputValue = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Popover for jumping the calendar to any month/year or an exact date.
 * onSelect(date) receives a local Date; the parent decides how to apply it.
 */
export default function JumpPicker({ value, onSelect, onClose }) {
  const [year, setYear] = useState(value.getFullYear());
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [onClose]);

  const today = new Date();

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Jump to month or date"
      className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-30 w-72 bg-white rounded-2xl border border-slate-100 shadow-[0_8px_32px_rgba(15,23,42,0.14)] p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setYear((y) => y - 1)}
          aria-label="Previous year"
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <input
          type="number"
          value={year}
          min={1970}
          max={2100}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!Number.isNaN(n)) setYear(Math.min(2100, Math.max(1970, n)));
          }}
          aria-label="Year"
          className="w-20 h-8 text-center text-sm font-bold text-slate-900 bg-transparent rounded-lg focus:bg-slate-50 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => setYear((y) => y + 1)}
          aria-label="Next year"
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {MONTH_LABELS.map((label, i) => {
          const isSelected = value.getFullYear() === year && value.getMonth() === i;
          const isThisMonth = today.getFullYear() === year && today.getMonth() === i;
          return (
            <button
              key={label}
              type="button"
              onClick={() => onSelect(new Date(year, i, 1))}
              className={`h-9 rounded-xl text-xs font-semibold transition-colors ${
                isSelected
                  ? 'bg-slate-900 text-white'
                  : isThisMonth
                    ? 'border border-slate-300 text-slate-800 hover:bg-slate-50'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100">
        <label htmlFor="jump-to-date" className="block text-[11px] font-semibold text-slate-500 mb-1">
          Go to a specific date
        </label>
        <input
          id="jump-to-date"
          type="date"
          defaultValue={toInputValue(value)}
          onChange={(e) => {
            if (!e.target.value) return;
            const [y, m, d] = e.target.value.split('-').map(Number);
            if (y < 1970 || y > 2100) return; // ignore half-typed years
            onSelect(new Date(y, m - 1, d));
          }}
          className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-slate-900"
        />
      </div>
    </div>
  );
}
