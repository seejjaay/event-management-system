import React from 'react';
import { Check, Circle } from 'lucide-react';
import { LIMITS } from '../../utils/validators';

const RULES = [
  { label: `${LIMITS.PASSWORD_MIN}+ characters`, test: (v) => v.length >= LIMITS.PASSWORD_MIN },
  { label: 'Lowercase letter', test: (v) => /[a-z]/.test(v) },
  { label: 'Uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'Number', test: (v) => /\d/.test(v) },
  { label: 'Symbol', test: (v) => /[^A-Za-z0-9\s]/.test(v) },
  { label: 'No spaces', test: (v) => !/\s/.test(v) },
];

/** Live checklist of the new-password rules (mirrors checkPassword in utils/validators.js). */
export default function PasswordChecklist({ value = '', className = '' }) {
  if (!value) return null;
  return (
    <ul className={`grid grid-cols-2 gap-x-3 gap-y-1 mt-2 ${className}`} aria-label="Password requirements">
      {RULES.map(({ label, test }) => {
        const ok = test(value);
        return (
          <li
            key={label}
            className={`flex items-center gap-1.5 text-[11px] ${ok ? 'text-emerald-600' : 'text-slate-400'}`}
          >
            {ok ? <Check className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
            {label}
          </li>
        );
      })}
    </ul>
  );
}
