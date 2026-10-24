/**
 * Date & Time Formatting Utilities (Section 3.4.4, FR-EVT-06)
 * Stored in UTC (ISO 8601), rendered in user's local timezone with clean indicators.
 */

export function getEventDateObj(dateString) {
  return new Date(dateString);
}

export function formatEventDate(dateString, options = {}) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    weekday: options.weekday || 'short',
    month: options.month || 'short',
    day: options.day || 'numeric',
    year: options.year || 'numeric',
    ...options,
  });
}

export function formatEventTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatEventDateTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const formattedDate = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  // Extract short timezone abbreviation if available
  let tzAbbr = '';
  try {
    const tzMatch = date.toLocaleTimeString(undefined, { timeZoneName: 'short' }).split(' ');
    tzAbbr = tzMatch[tzMatch.length - 1] || '';
  } catch {
    tzAbbr = '';
  }

  return `${formattedDate} • ${formattedTime} ${tzAbbr}`.trim();
}

/**
 * Determine the visual event state per FR-EVT-06:
 * - 'past': event date is in the past
 * - 'full': registeredCount >= capacity
 * - 'open': available seats remaining
 */
export function getEventState(event) {
  if (!event) return 'open';
  const now = new Date();
  const eventDate = new Date(event.date);

  if (eventDate <= now) {
    return 'past';
  }
  if (event.registeredCount >= event.capacity) {
    return 'full';
  }
  return 'open';
}

export function isEventPast(dateString) {
  if (!dateString) return false;
  return new Date(dateString) <= new Date();
}

export function isEventFull(event) {
  if (!event) return false;
  return (event.registeredCount || 0) >= (event.capacity || 1);
}

/**
 * "9:00 AM – 11:00 AM". Falls back to the start time alone for events saved before end times
 * existed, and adds the end date when the event runs past midnight.
 */
export function formatEventTimeRange(start, end) {
  if (!start) return '';
  if (!end) return formatEventTime(start);
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(e.getTime())) return formatEventTime(start);
  const endLabel =
    s.toDateString() === e.toDateString()
      ? formatEventTime(end)
      : `${e.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${formatEventTime(end)}`;
  return `${formatEventTime(start)} – ${endLabel}`;
}
