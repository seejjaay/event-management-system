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

const USER_FIELDS = 'name email';

// ---------------------------------------------------------------------------
// POST /api/registrations                      (member, admin)   FR-REG-01
// Body: { eventId }
// ---------------------------------------------------------------------------
export const rsvp = async (req, res, next) => {
  try {
    const { eventId } = req.body;
    if (!isObjectId(eventId)) {
      throw httpError(400, 'Validation failed.', { eventId: 'A valid event ID is required.' });
    }

    const event = await Event.findById(eventId);
    if (!event) throw httpError(404, 'Event not found.');

    // FR-REG-02: no RSVPs once the event has started
    if (event.date <= new Date()) {
      throw httpError(409, 'Registration is closed. This event has already started.');
    }

    // Friendly duplicate check (the unique index is still the real guard, see below)
    if (await Registration.exists({ user: req.user._id, event: eventId })) {
      throw httpError(409, 'You are already registered for this event.');
    }

    // FR-REG-04 + Appendix A.4: reserve a seat atomically.
    // The capacity check is part of the filter, so two concurrent requests can't both
    // grab the last seat. No read -> add 1 -> write.
    const reserved = await Event.findOneAndUpdate(
      { _id: eventId, $expr: { $lt: ['$registeredCount', '$capacity'] } },
      { $inc: { registeredCount: 1 } }
    );
    if (!reserved) throw httpError(409, 'Event is full. No seats available.');

    let registration;
    try {
      registration = await Registration.create({ user: req.user._id, event: eventId });
    } catch (err) {
      // Give the seat back if the registration couldn't be saved
      await Event.updateOne({ _id: eventId }, { $inc: { registeredCount: -1 } });
      if (err.code === 11000) {
        throw httpError(409, 'You are already registered for this event.');
      }
      throw err;
    }

    await registration.populate([
      { path: 'user', select: USER_FIELDS },
      { path: 'event', select: 'title date' },
    ]);

    res.status(201).json(registration);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/registrations/:id                (own registrant, admin)   FR-REG-12
// ---------------------------------------------------------------------------
export const cancelRsvp = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) throw httpError(404, 'Registration not found.');

    const registration = await Registration.findById(id);
    if (!registration) throw httpError(404, 'Registration not found.');

    if (!isAdmin(req.user) && !sameId(registration.user, req.user._id)) {
      throw httpError(403, 'Access denied. You can only cancel your own registration.');
    }

    // FR-REG-13: atomic delete that only succeeds if the attendee isn't checked in,
    // so a check-in landing at the same moment can't be silently erased.
    const deleted = await Registration.findOneAndDelete({ _id: id, checkedIn: false });
    if (!deleted) {
      const current = await Registration.findById(id).select('checkedIn');
      if (!current) throw httpError(404, 'Registration not found.');
      throw httpError(409, 'Cannot cancel registration after check-in.');
    }

    // Release the seat (guard keeps the counter from ever going negative)
    await Event.updateOne(
      { _id: deleted.event, registeredCount: { $gt: 0 } },
      { $inc: { registeredCount: -1 } }
    );

    res.status(200).json({ message: 'Registration cancelled.' });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/registrations/user/:userId          (own user, admin)
// ---------------------------------------------------------------------------
export const getUserRegistrations = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isObjectId(userId)) throw httpError(404, 'User not found.');

    if (!isAdmin(req.user) && !sameId(userId, req.user._id)) {
      throw httpError(403, 'Access denied.');
    }

    const registrations = await Registration.find({ user: userId })
      .sort({ registeredAt: -1 })
      .populate('user', USER_FIELDS)
      .populate({
        path: 'event',
        populate: { path: 'organizer', select: USER_FIELDS },
      });

    res.status(200).json(registrations);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/registrations/event/:eventId        (organizer of event, admin)
// ---------------------------------------------------------------------------
export const getRoster = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    if (!isObjectId(eventId)) throw httpError(404, 'Event not found.');

    const event = await Event.findById(eventId).select('organizer');
    if (!event) throw httpError(404, 'Event not found.');

    if (!isAdmin(req.user) && !sameId(event.organizer, req.user._id)) {
      throw httpError(403, 'Access denied. You can only view rosters for your own events.');
    }

    const roster = await Registration.find({ event: eventId })
      .sort({ registeredAt: 1 })
      .populate('user', USER_FIELDS)
      .populate('event', 'title');

    res.status(200).json(roster);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/registrations/:id/check-in        (organizer of event, admin)
// FR-REG-09, FR-REG-11
// Idempotent: a double-tap returns the existing check-in (200) without changing checkedInAt.
// ---------------------------------------------------------------------------
export const checkIn = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) throw httpError(404, 'Registration not found.');

    const registration = await Registration.findById(id).populate('event', 'organizer');
    if (!registration || !registration.event) throw httpError(404, 'Registration not found.');

    if (!isAdmin(req.user) && !sameId(registration.event.organizer, req.user._id)) {
      throw httpError(403, 'Access denied. You can only check in attendees for your own events.');
    }

    // Only flips false -> true once, so checkedInAt is set exactly one time
    const updated = await Registration.findOneAndUpdate(
      { _id: id, checkedIn: false },
      { $set: { checkedIn: true, checkedInAt: new Date() } },
      { new: true }
    ).populate('user', 'name');

    if (updated) return res.status(200).json(updated);

    // Already checked in -> return the current state
    const existing = await Registration.findById(id).populate('user', 'name');
    res.status(200).json(existing);
  } catch (err) {
    next(err);
  }
};
