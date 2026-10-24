import Venue from '../models/Venue.js';
import Event from '../models/Event.js';
import {
  checkVenue,
  checkDescription,
  checkCapacity,
  collapseSpaces,
} from '../utils/validators.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Error shape consumed by middleware/errorHandler.js ({ status, message, errors }). */
const httpError = (status, message, errors) =>
  Object.assign(new Error(message), { status, ...(errors && { errors }) });

const isObjectId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

const nameKeyOf = (name) => collapseSpaces(name).toLowerCase();

const toPublicVenue = (v, eventCount) => ({
  _id: v._id,
  name: v.name,
  capacity: v.capacity ?? null,
  description: v.description || '',
  isActive: v.isActive,
  createdAt: v.createdAt,
  ...(eventCount !== undefined && { eventCount }),
});

/**
 * Validates and whitelists venue input. partial=true (PUT) only validates fields that were sent.
 * capacity: null/'' clears the limit.
 */
function parseVenueInput(body = {}, { partial = false } = {}) {
  const values = {};
  const errors = {};
  const sent = (k) => body[k] !== undefined;

  if (!partial || sent('name')) {
    const err = checkVenue(body.name);
    if (err) errors.name = err.replace(/^Venue/, 'Venue name');
    else values.name = collapseSpaces(body.name);
  }

  if (sent('capacity')) {
    if (body.capacity === null || body.capacity === '') values.capacity = null;
    else {
      const err = checkCapacity(body.capacity);
      if (err) errors.capacity = err;
      else values.capacity = Number(body.capacity);
    }
  }

  if (sent('description')) {
    const err = checkDescription(body.description || '', { required: false });
    if (err) errors.description = err;
    else values.description = (body.description || '').trim();
  }

  if (sent('isActive')) {
    if (typeof body.isActive !== 'boolean') errors.isActive = 'isActive must be true or false';
    else values.isActive = body.isActive;
  }

  return { values, errors };
}

/** event counts per venue, from the venueId reference (migrated events) */
async function eventCountsByVenue() {
  const rows = await Event.aggregate([
    { $match: { venueId: { $ne: null } } },
    { $group: { _id: '$venueId', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

// ---------------------------------------------------------------------------
// GET /api/venues                              (any logged-in user)
// Everyone gets the bookable (active) venues. Admins can pass ?all=1 for the full list with usage.
// ---------------------------------------------------------------------------
export const getVenues = async (req, res, next) => {
  try {
    const wantsAll = req.user.role === 'admin' && req.query.all === '1';
    const venues = await Venue.find(wantsAll ? {} : { isActive: true }).sort({ nameKey: 1 });

    if (!wantsAll) return res.status(200).json(venues.map((v) => toPublicVenue(v)));

    const counts = await eventCountsByVenue();
    res.status(200).json(venues.map((v) => toPublicVenue(v, counts.get(String(v._id)) || 0)));
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/admin/venues                       (admin)
// ---------------------------------------------------------------------------
export const createVenue = async (req, res, next) => {
  try {
    const { values, errors } = parseVenueInput(req.body);
    if (Object.keys(errors).length) throw httpError(400, 'Validation failed.', errors);

    const venue = await Venue.create({ ...values, nameKey: nameKeyOf(values.name) });
    res.status(201).json(toPublicVenue(venue, 0));
  } catch (err) {
    if (err.code === 11000) {
      return next(httpError(409, 'A venue with this name already exists.', { name: 'A venue with this name already exists.' }));
    }
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PUT /api/admin/venues/:id                    (admin)
// Renaming also renames the venue on every event that uses it.
// ---------------------------------------------------------------------------
export const updateVenue = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) throw httpError(404, 'Venue not found.');

    const venue = await Venue.findById(id);
    if (!venue) throw httpError(404, 'Venue not found.');

    const { values, errors } = parseVenueInput(req.body, { partial: true });
    if (Object.keys(errors).length) throw httpError(400, 'Validation failed.', errors);

    const renamed = values.name !== undefined && values.name !== venue.name;
    const update = { ...values };
    if (values.name !== undefined) update.nameKey = nameKeyOf(values.name);

    const updated = await Venue.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });

    if (renamed) await Event.updateMany({ venueId: id }, { $set: { venue: updated.name } });

    const count = await Event.countDocuments({ venueId: id });
    res.status(200).json(toPublicVenue(updated, count));
  } catch (err) {
    if (err.code === 11000) {
      return next(httpError(409, 'A venue with this name already exists.', { name: 'A venue with this name already exists.' }));
    }
    next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/admin/venues/:id                 (admin)
// Refused while any event uses the venue: deactivate it instead.
// ---------------------------------------------------------------------------
export const deleteVenue = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) throw httpError(404, 'Venue not found.');

    const venue = await Venue.findById(id);
    if (!venue) throw httpError(404, 'Venue not found.');

    const inUse = await Event.countDocuments({ venueId: id });
    if (inUse > 0) {
      throw httpError(
        409,
        `${venue.name} is used by ${inUse} event${inUse === 1 ? '' : 's'}. Deactivate it instead of deleting.`
      );
    }

    await Venue.deleteOne({ _id: id });
    res.status(200).json({ message: 'Venue deleted successfully.' });
  } catch (err) {
    next(err);
  }
};
