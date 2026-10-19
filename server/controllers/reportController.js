import Event from '../models/Event.js';
import Registration from '../models/Registration.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Error shape consumed by middleware/errorHandler.js ({ status, message, errors }). */
const httpError = (status, message, errors) =>
  Object.assign(new Error(message), { status, ...(errors && { errors }) });

const isObjectId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);
const isAdmin = (user) => user.role === 'admin';
const sameId = (a, b) => String(a?._id ?? a) === String(b?._id ?? b);

/** Loads the event and enforces "own event or admin". */
async function loadAuthorizedEvent(eventId, user) {
  if (!isObjectId(eventId)) throw httpError(404, 'Event not found.');

  const event = await Event.findById(eventId).select('title capacity organizer');
  if (!event) throw httpError(404, 'Event not found.');

  if (!isAdmin(user) && !sameId(event.organizer, user._id)) {
    throw httpError(403, 'Access denied. You can only view reports for your own events.');
  }
  return event;
}

/**
 * FR-RPT-06 + RFC 4180.
 * 1. Neutralise spreadsheet formulas: values starting with = + - @ (or a tab / CR,
 *    which Excel also treats as a formula lead-in) get a leading single quote.
 * 2. Quote fields containing a comma, double quote or newline; escape " as "".
 */
function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Safe for a Content-Disposition filename: ASCII letters/digits/_/- only. */
function safeFilename(title) {
  const cleaned = String(title)
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80);
  return cleaned || 'event';
}

const iso = (d) => (d ? new Date(d).toISOString() : '');

// ---------------------------------------------------------------------------
// GET /api/reports/events/:eventId/attendance   (own organizer, admin)
// Keys are read directly by the UI, do not rename.
// ---------------------------------------------------------------------------
export const getAttendance = async (req, res, next) => {
  try {
    const event = await loadAuthorizedEvent(req.params.eventId, req.user);

    // Counted from the registrations themselves (the source of truth)
    const [registered, checkedIn] = await Promise.all([
      Registration.countDocuments({ event: event._id }),
      Registration.countDocuments({ event: event._id, checkedIn: true }),
    ]);

    res.status(200).json({
      eventId: String(event._id),
      title: event.title,
      capacity: event.capacity,
      registered,
      checkedIn,
      noShows: registered - checkedIn,
      attendanceRate: registered > 0 ? Math.round((checkedIn / registered) * 100) : 0,
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/reports/events/:eventId/export?format=csv|json   (own organizer, admin)
// FR-RPT-05, FR-RPT-06
// ---------------------------------------------------------------------------
export const exportRegistrants = async (req, res, next) => {
  try {
    const format = req.query.format === undefined ? 'csv' : req.query.format;
    if (format !== 'csv' && format !== 'json') {
      throw httpError(400, 'Validation failed.', { format: 'format must be csv or json' });
    }

    const event = await loadAuthorizedEvent(req.params.eventId, req.user);

    const registrations = await Registration.find({ event: event._id })
      .sort({ registeredAt: 1 })
      .populate('user', 'name email')
      .lean();

    const filenameBase = `${safeFilename(event.title)}_registrants`;

    if (format === 'json') {
      const rows = registrations.map((r) => ({
        name: r.user?.name ?? '',
        email: r.user?.email ?? '',
        registeredAt: iso(r.registeredAt),
        checkedIn: r.checkedIn,
        checkedInAt: r.checkedInAt ? iso(r.checkedInAt) : null,
      }));

      res.set('Content-Type', 'application/json');
      res.set('Content-Disposition', `attachment; filename="${filenameBase}.json"`);
      return res.status(200).send(JSON.stringify(rows));
    }

    const header = ['Name', 'Email', 'Registered At', 'Checked In', 'Checked In At'];
    const lines = [header.map(csvCell).join(',')];

    for (const r of registrations) {
      lines.push(
        [
          r.user?.name,
          r.user?.email,
          iso(r.registeredAt),
          r.checkedIn ? 'Yes' : 'No',
          r.checkedInAt ? iso(r.checkedInAt) : '',
        ]
          .map(csvCell)
          .join(',')
      );
    }

    // \uFEFF (UTF-8 BOM) makes Excel show non-ASCII names correctly
    const csv = '\uFEFF' + lines.join('\r\n') + '\r\n';

    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
    res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
};
