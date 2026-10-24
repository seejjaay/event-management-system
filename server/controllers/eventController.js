import Event from '../models/Event.js';
import Registration from '../models/Registration.js';
import Venue from '../models/Venue.js';
import {
  checkEventTitle,
  checkDescription,
  checkEventDate,
  checkEventEnd,
  checkCapacity,
  collapseSpaces,
  LIMITS,
} from '../utils/validators.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Error shape consumed by middleware/errorHandler.js ({ status, message, errors }). */
const httpError = (status, message, errors) =>
  Object.assign(new Error(message), { status, ...(errors && { errors }) });

const isObjectId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

const isAdmin = (user) => user.role === 'admin';

/** organizer may be a populated doc or a raw ObjectId */
const ownsEvent = (user, event) =>
  String(event.organizer?._id ?? event.organizer) === String(user._id);

const ORGANIZER_FIELDS = 'name email';

const DEFAULT_DURATION_MS = LIMITS.DEFAULT_EVENT_HOURS * 3600 * 1000;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sameTime = (a, b) => (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);

/** End of an event; ones saved before end times existed are assumed to run DEFAULT_EVENT_HOURS. */
const effectiveEnd = (start, end) =>
  end ? new Date(end) : new Date(new Date(start).getTime() + DEFAULT_DURATION_MS);

/**
 * Mongo filter for events whose time range overlaps [start, end).
 * Back-to-back events (one ends exactly when the next starts) do not overlap.
 */
const overlapFilter = (start, end) => ({
  date: { $lt: end },
  $or: [
    { endDate: { $gt: start } },
    // legacy events with no endDate: use the default length
    { endDate: null, date: { $gt: new Date(start.getTime() - DEFAULT_DURATION_MS) } },
  ],
});

/** 409 carrying `code` and the clashing event so the UI can explain it. */
const clashError = (code, message, other) =>
  Object.assign(new Error(message), {
    status: 409,
    code,
    conflict: {
      _id: other._id,
      title: other.title,
      venue: other.venue,
      date: other.date,
      endDate: effectiveEnd(other.date, other.endDate),
    },
  });

/**
 * Throws when the venue is already booked for an overlapping time (always blocked), or when the
 * organizer is already running another event at that time (blocked unless allowOverlap).
 */
async function assertNoClash({ venue, start, end, organizerId, excludeId, allowOverlap }) {
  const base = excludeId ? { _id: { $ne: excludeId } } : {};
  const overlap = overlapFilter(start, end);

  const venueMatch = [{ venue: new RegExp(`^${escapeRegex(venue.name)}$`, 'i') }];
  if (venue.id) venueMatch.push({ venueId: venue.id });

  const venueClash = await Event.findOne({ $and: [base, overlap, { $or: venueMatch }] })
    .sort({ date: 1 })
    .select('title venue date endDate');
  if (venueClash) {
    throw clashError(
      'VENUE_CLASH',
      `${venue.name} is already booked for "${venueClash.title}" during that time.`,
      venueClash
    );
  }

  if (allowOverlap) return;
  const organizerClash = await Event.findOne({ $and: [base, overlap, { organizer: organizerId }] })
    .sort({ date: 1 })
    .select('title venue date endDate');
  if (organizerClash) {
    throw clashError(
      'ORGANIZER_OVERLAP',
      `You're already running "${organizerClash.title}" at this time.`,
      organizerClash
    );
  }
}

/** Loads the chosen venue; only active venues can be newly booked (an event may keep its current one). */
async function resolveVenue(venueId, existing, errors) {
  const venue = await Venue.findById(venueId);
  if (!venue) {
    errors.venueId = 'That venue no longer exists';
    return null;
  }
  const keepingCurrent = existing && String(existing.venueId) === String(venue._id);
  if (!venue.isActive && !keepingCurrent) {
    errors.venueId = `${venue.name} is not available for booking`;
    return null;
  }
  return venue;
}

/**
 * Validates and whitelists event input.
 * partial=true (PUT) only validates fields that were actually sent; `existing` supplies the stored
 * start/end for checks that depend on a field the client didn't resend.
 * Returns { values, errors } where errors is keyed by field name (for inline UI errors).
 * The venue name is never taken from the client: it is copied from the chosen venue (venueId).
 */
function parseEventInput(body = {}, { partial = false, existing = null } = {}) {
  const values = {};
  const errors = {};
  const sent = (k) => body[k] !== undefined;

  if (!partial || sent('title')) {
    const err = checkEventTitle(body.title);
    if (err) errors.title = err;
    else values.title = collapseSpaces(body.title);
  }

  if (!partial || sent('description')) {
    const err = checkDescription(body.description);
    if (err) errors.description = err;
    else values.description = body.description.trim();
  }

  if (!partial || sent('date')) {
    // Creating requires a future date; editing may keep an event's existing (possibly past) date
    const err = checkEventDate(body.date, { requireFuture: !partial });
    if (err) errors.date = err;
    else values.date = new Date(body.date);
  }

  if (!partial || sent('endDate') || sent('date')) {
    const startRaw = sent('date') ? body.date : existing?.date;
    const endRaw = sent('endDate') ? body.endDate : existing?.endDate;
    // events saved before end times existed stay editable until someone sets one
    if (!(partial && !sent('endDate') && !endRaw)) {
      const err = checkEventEnd(startRaw, endRaw);
      if (err) errors.endDate = err;
      else if (!partial || sent('endDate')) values.endDate = new Date(endRaw);
    }
  }

  if (!partial || sent('venueId')) {
    if (!isObjectId(body.venueId)) errors.venueId = 'Please choose a venue';
    else values.venueId = body.venueId;
  }

  if (!partial || sent('capacity')) {
    const err = checkCapacity(body.capacity);
    if (err) errors.capacity = err;
    else values.capacity = Number(body.capacity);
  }

  return { values, errors };
}

// ---------------------------------------------------------------------------
// GET /api/events?from=&to=&organizer=        (any logged-in user)
// ---------------------------------------------------------------------------
export const getEvents = async (req, res, next) => {
  try {
    const { from, to, organizer } = req.query;
    const filter = {};
    const errors = {};

    if (from !== undefined || to !== undefined) {
      filter.date = {};
      if (from !== undefined) {
        const d = new Date(from);
        if (typeof from !== 'string' || Number.isNaN(d.getTime())) errors.from = 'from must be a valid ISO date';
        else filter.date.$gte = d;
      }
      if (to !== undefined) {
        const d = new Date(to);
        if (typeof to !== 'string' || Number.isNaN(d.getTime())) errors.to = 'to must be a valid ISO date';
        else filter.date.$lte = d;
      }
    }

    if (organizer !== undefined) {
      if (!isObjectId(organizer)) errors.organizer = 'organizer must be a valid user ID';
      else filter.organizer = organizer;
    }

    if (Object.keys(errors).length) throw httpError(400, 'Validation failed.', errors);

    const events = await Event.find(filter)
      .sort({ date: 1 })
      .populate('organizer', ORGANIZER_FIELDS);

    res.status(200).json(events);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/events/:id                          (any logged-in user)
// ---------------------------------------------------------------------------
export const getEventById = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) throw httpError(404, 'Event not found.');

    const event = await Event.findById(req.params.id).populate('organizer', ORGANIZER_FIELDS);
    if (!event) throw httpError(404, 'Event not found.');

    res.status(200).json(event);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/events                             (organizer, admin)
// Body: title, description, date, endDate, venueId, capacity, allowOverlap?
// 409 VENUE_CLASH / ORGANIZER_OVERLAP when the time is taken (see assertNoClash)
// ---------------------------------------------------------------------------
export const createEvent = async (req, res, next) => {
  try {
    const { values, errors } = parseEventInput(req.body);

    const venue = values.venueId ? await resolveVenue(values.venueId, null, errors) : null;
    if (venue?.capacity && values.capacity > venue.capacity) {
      errors.capacity = `${venue.name} seats at most ${venue.capacity}`;
    }
    if (Object.keys(errors).length) throw httpError(400, 'Validation failed.', errors);

    await assertNoClash({
      venue: { id: venue._id, name: venue.name },
      start: values.date,
      end: values.endDate,
      organizerId: req.user._id,
      allowOverlap: req.body.allowOverlap === true,
    });

    const event = await Event.create({
      ...values,
      venue: venue.name,
      venueId: venue._id,
      registeredCount: 0,          // never trust client-supplied counts
      organizer: req.user._id,     // always the authenticated user
    });
    await event.populate('organizer', ORGANIZER_FIELDS);

    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PUT /api/events/:id                          (owner organizer, admin)
// Clash checks only run when the time or venue actually changed, so unrelated edits
// are never blocked by an older overlap.
// ---------------------------------------------------------------------------
export const updateEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) throw httpError(404, 'Event not found.');

    const event = await Event.findById(id);
    if (!event) throw httpError(404, 'Event not found.');

    if (!isAdmin(req.user) && !ownsEvent(req.user, event)) {
      throw httpError(403, 'Access denied. You can only edit your own events.');
    }

    const { values, errors } = parseEventInput(req.body, { partial: true, existing: event });

    const venue = values.venueId ? await resolveVenue(values.venueId, event, errors) : null;

    // Seat limit of whichever venue the event ends up in
    const capacityChanged = values.capacity !== undefined && values.capacity !== event.capacity;
    const venueChanged = venue && String(venue._id) !== String(event.venueId);
    if (capacityChanged || venueChanged) {
      const limitVenue = venue || (event.venueId ? await Venue.findById(event.venueId) : null);
      const cap = values.capacity ?? event.capacity;
      if (limitVenue?.capacity && cap > limitVenue.capacity) {
        errors.capacity = `${limitVenue.name} seats at most ${limitVenue.capacity}`;
      }
    }
    if (Object.keys(errors).length) throw httpError(400, 'Validation failed.', errors);

    if (venue) {
      values.venue = venue.name;
      values.venueId = venue._id;
    }

    const start = values.date ?? event.date;
    const end = effectiveEnd(start, values.endDate ?? event.endDate);
    const timeOrVenueChanged =
      venueChanged ||
      (values.date !== undefined && !sameTime(values.date, event.date)) ||
      (values.endDate !== undefined && !sameTime(values.endDate, event.endDate));

    if (timeOrVenueChanged) {
      await assertNoClash({
        venue: venue
          ? { id: venue._id, name: venue.name }
          : { id: event.venueId, name: event.venue },
        start: new Date(start),
        end,
        organizerId: event.organizer?._id ?? event.organizer,
        excludeId: event._id,
        allowOverlap: req.body.allowOverlap === true,
      });
    }

    // FR-EVT-09: capacity can't drop below current registrations.
    // The check lives in the query filter so a concurrent RSVP can't slip in between read and write.
    const filter = { _id: id };
    if (values.capacity !== undefined) filter.registeredCount = { $lte: values.capacity };

    const updated = await Event.findOneAndUpdate(
      filter,
      { $set: values },
      { new: true, runValidators: true }
    ).populate('organizer', ORGANIZER_FIELDS);

    if (!updated) {
      const current = await Event.findById(id).select('registeredCount');
      if (!current) throw httpError(404, 'Event not found.');
      throw httpError(
        409,
        `Capacity cannot be less than the current number of registrations (${current.registeredCount}).`
      );
    }

    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// ADMIN: GET /api/admin/events                 (admin)
// Wire this up in adminRoutes.js
// ---------------------------------------------------------------------------
export const getAllEventsAdmin = async (req, res, next) => {
  try {
    const events = await Event.find({})
      .sort({ date: -1 })
      .populate('organizer', ORGANIZER_FIELDS);

    res.status(200).json(events);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// ADMIN: DELETE /api/admin/events/:id          (admin)
// Cascades to the event's registrations.
// ---------------------------------------------------------------------------
export const deleteEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) throw httpError(404, 'Event not found.');

    const event = await Event.findById(id);
    if (!event) throw httpError(404, 'Event not found.');

    if (!isAdmin(req.user) && !ownsEvent(req.user, event)) {
      throw httpError(403, 'Access denied.');
    }

    await Event.deleteOne({ _id: id });
    const { deletedCount } = await Registration.deleteMany({ event: id });

    res.status(200).json({
      message: 'Event deleted successfully.',
      deletedRegistrations: deletedCount,
    });
  } catch (err) {
    next(err);
  }
};
