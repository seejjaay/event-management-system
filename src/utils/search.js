/**
 * Shared search for events. Every whitespace-separated word in the query has to appear somewhere
 * in the event's searchable text, so "october 2024 gym" finds October 2024 events in a gym.
 * Searchable text = title, venue, description, organizer name/email and the date written
 * several ways (month names, weekday, day, year, ISO, numeric, start time).
 */

const MONTHS_LONG = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const WEEKDAYS_LONG = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Lowercased, space-joined text for every way a date can be searched. */
export function dateSearchText(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  const month = MONTHS_LONG[m];
  const weekday = WEEKDAYS_LONG[d.getDay()];
  const pad = (n) => String(n).padStart(2, '0');

  return [
    month,
    month.slice(0, 3),
    weekday,
    weekday.slice(0, 3),
    String(day),
    String(y),
    `${month} ${day}`,
    `${month} ${day} ${y}`,
    `${month} ${y}`,
    `${y}-${pad(m + 1)}-${pad(day)}`,
    `${m + 1}/${day}/${y}`,
    `${pad(m + 1)}/${pad(day)}/${y}`,
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
  ]
    .join(' ')
    .toLowerCase();
}

export function searchTokens(query) {
  return (query || '')
    .toLowerCase()
    .replace(/[,]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** True when every token of `query` appears in at least one of the given text parts. */
export function matchesTokens(query, parts) {
  const tokens = searchTokens(query);
  if (!tokens.length) return true;
  const haystack = parts.filter(Boolean).join(' ').toLowerCase();
  return tokens.every((t) => haystack.includes(t));
}

export function matchesEventSearch(evt, query) {
  if (!evt) return false;
  return matchesTokens(query, [
    evt.title,
    evt.venue,
    evt.description,
    evt.organizer?.name,
    evt.organizer?.email,
    dateSearchText(evt.date),
  ]);
}
