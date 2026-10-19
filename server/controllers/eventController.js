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

/** organizer may be a populated doc or a raw ObjectId */
const ownsEvent = (user, event) =>
  String(event.organizer?._id ?? event.organizer) === String(user._id);

const ORGANIZER_FIELDS = 'name email';

/**
 * Validates and whitelists event input.
 * partial=true (PUT) only validates fields that were actually sent.
 * Returns { values, errors } where errors is keyed by field name (for inline UI errors).
 */
function parseEventInput(body = {}, { partial = false } = {}) {
  const values = {};
  const errors = {};
  const sent = (k) => body[k] !== undefined;

  if (!partial || sent('title')) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) errors.title = 'Event title is required';
    else if (title.length > 200) errors.title = 'Title cannot exceed 200 characters';
    else values.title = title;
  }

  if (sent('description')) {
    const description = typeof body.description === 'string' ? body.description.trim() : null;
    if (description === null) errors.description = 'Description must be text';
    else if (description.length > 2000) errors.description = 'Description cannot exceed 2000 characters';
    else values.description = description;
  }

  if (!partial || sent('date')) {
    const date = body.date ? new Date(body.date) : null;
    if (!date || Number.isNaN(date.getTime())) errors.date = 'A valid event date is required';
    else values.date = date;
  }

  if (!partial || sent('venue')) {
    const venue = typeof body.venue === 'string' ? body.venue.trim() : '';
    if (!venue) errors.venue = 'Venue is required';
    else values.venue = venue;
  }

  if (!partial || sent('capacity')) {
    const raw = body.capacity;
    const capacity =
      (typeof raw === 'number' || (typeof raw === 'string' && raw.trim() !== '')) ? Number(raw) : NaN;
    if (!Number.isInteger(capacity) || capacity < 1) errors.capacity = 'Capacity must be a whole number of at least 1';
    else values.capacity = capacity;
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
// ---------------------------------------------------------------------------
export const createEvent = async (req, res, next) => {
  try {
    const { values, errors } = parseEventInput(req.body);
    if (Object.keys(errors).length) throw httpError(400, 'Validation failed.', errors);

    const event = await Event.create({
      ...values,
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

    const { values, errors } = parseEventInput(req.body, { partial: true });
    if (Object.keys(errors).length) throw httpError(400, 'Validation failed.', errors);

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
