/**
 * Shared input rules. Each check returns an error string, or null when valid.
 *
 * IMPORTANT: server/utils/validators.js is a byte-for-byte copy of this file
 * (the API can be deployed without src/). Edit both together.
 */

export const LIMITS = {
  NAME_MIN: 2,
  NAME_MAX: 100,
  EMAIL_MAX: 254,
  PASSWORD_MIN: 8,
  PASSWORD_MAX_BYTES: 72, // bcrypt silently ignores everything past 72 bytes
  TITLE_MIN: 3,
  TITLE_MAX: 150,
  VENUE_MIN: 3,
  VENUE_MAX: 200,
  DESCRIPTION_MIN: 10,
  DESCRIPTION_MAX: 2000,
  CAPACITY_MAX: 10000,
  MAX_YEARS_AHEAD: 5,
};

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;
const NAME_RE = /^\p{L}[\p{L}\p{M}'’.\- ]*$/u;
const SINGLE_LINE_CONTROL = /[\u0000-\u001F\u007F]/;
const MULTI_LINE_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/; // allows \t \n \r
const HTML_TAG = /<\s*\/?\s*[a-z!]/i;

const isString = (v) => typeof v === 'string';
const byteLength = (v) => new TextEncoder().encode(v).length;

export const collapseSpaces = (v) => (isString(v) ? v.trim().replace(/\s+/g, ' ') : v);
export const normalizeEmail = (v) => (isString(v) ? v.trim().toLowerCase() : v);

export function checkName(v) {
  if (!isString(v) || !v.trim()) return 'Full name is required';
  const name = collapseSpaces(v);
  if (name.length < LIMITS.NAME_MIN) return `Name must be at least ${LIMITS.NAME_MIN} characters`;
  if (name.length > LIMITS.NAME_MAX) return `Name cannot exceed ${LIMITS.NAME_MAX} characters`;
  if (!NAME_RE.test(name)) return 'Name can only contain letters, spaces, apostrophes, hyphens and periods';
  return null;
}

export function checkEmail(v) {
  if (!isString(v) || !v.trim()) return 'Email is required';
  const email = v.trim();
  if (email.length > LIMITS.EMAIL_MAX) return `Email cannot exceed ${LIMITS.EMAIL_MAX} characters`;
  const local = email.split('@')[0];
  if (
    !EMAIL_RE.test(email) ||
    local.length > 64 ||
    local.startsWith('.') ||
    local.endsWith('.') ||
    email.includes('..')
  ) {
    return 'Please enter a valid email address';
  }
  return null;
}

/** For new passwords only. Never apply this to login: existing accounts may predate the rules. */
export function checkPassword(v) {
  if (!isString(v) || !v) return 'Password is required';
  if (v.length < LIMITS.PASSWORD_MIN) return `Password must be at least ${LIMITS.PASSWORD_MIN} characters`;
  if (byteLength(v) > LIMITS.PASSWORD_MAX_BYTES) return `Password cannot exceed ${LIMITS.PASSWORD_MAX_BYTES} bytes`;
  if (/\s/.test(v)) return 'Password cannot contain spaces';
  if (!/[a-z]/.test(v)) return 'Password needs a lowercase letter';
  if (!/[A-Z]/.test(v)) return 'Password needs an uppercase letter';
  if (!/\d/.test(v)) return 'Password needs a number';
  if (!/[^A-Za-z0-9]/.test(v)) return 'Password needs a symbol (e.g. ! @ # $)';
  return null;
}

function checkText(v, { label, min, max, multiline = false, required = true }) {
  if (!isString(v) || !v.trim()) return required ? `${label} is required` : null;
  const text = multiline ? v.trim() : collapseSpaces(v);
  if (text.length < min) return `${label} must be at least ${min} characters`;
  if (text.length > max) return `${label} cannot exceed ${max} characters`;
  if ((multiline ? MULTI_LINE_CONTROL : SINGLE_LINE_CONTROL).test(text)) {
    return `${label} contains invalid characters`;
  }
  if (HTML_TAG.test(text)) return `${label} cannot contain HTML`;
  return null;
}

export const checkEventTitle = (v) =>
  checkText(v, { label: 'Title', min: LIMITS.TITLE_MIN, max: LIMITS.TITLE_MAX });

export const checkVenue = (v) =>
  checkText(v, { label: 'Venue', min: LIMITS.VENUE_MIN, max: LIMITS.VENUE_MAX });

export const checkDescription = (v, { required = true } = {}) =>
  checkText(v, {
    label: 'Description',
    min: LIMITS.DESCRIPTION_MIN,
    max: LIMITS.DESCRIPTION_MAX,
    multiline: true,
    required,
  });

/** Accepts a number or a digits-only string. */
export function checkCapacity(v) {
  const isNumeric = (typeof v === 'number' && Number.isFinite(v)) || (isString(v) && /^\d+$/.test(v.trim()));
  if (!isNumeric) return 'Capacity must be a whole number';
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) return 'Capacity must be at least 1';
  if (n > LIMITS.CAPACITY_MAX) return `Capacity cannot exceed ${LIMITS.CAPACITY_MAX.toLocaleString('en-US')}`;
  return null;
}

export function checkEventDate(v, { requireFuture = false } = {}) {
  if (!v) return 'Date and start time are required';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return 'Please enter a valid date and time';
  const now = new Date();
  if (requireFuture && d <= now) return 'Event date must be in the future';
  const limit = new Date(now);
  limit.setFullYear(limit.getFullYear() + LIMITS.MAX_YEARS_AHEAD);
  if (d > limit) return `Event date cannot be more than ${LIMITS.MAX_YEARS_AHEAD} years ahead`;
  if (d.getFullYear() < 2000) return 'Please enter a valid date and time';
  return null;
}
