import User from '../models/User.js';
import Event from '../models/Event.js';
import Registration from '../models/Registration.js';

// Admin event management lives with the Event model; re-exported here so
// adminRoutes.js can import everything admin-related from one place.
export { getAllEventsAdmin as getEvents, deleteEvent } from './eventController.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Error shape consumed by middleware/errorHandler.js ({ status, message, errors }). */
const httpError = (status, message, errors) =>
  Object.assign(new Error(message), { status, ...(errors && { errors }) });

const isObjectId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

const ROLES = ['admin', 'organizer', 'member'];

/** Escape user input before using it inside a RegExp. */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------------------------------------------------------------------------
// GET /api/admin/users?search=&role=&isActive=      (admin)
// ---------------------------------------------------------------------------
export const getUsers = async (req, res, next) => {
  try {
    const { search, role, isActive } = req.query;
    const filter = {};
    const errors = {};

    if (search !== undefined) {
      if (typeof search !== 'string') {
        errors.search = 'search must be text';
      } else if (search.trim()) {
        // Case-insensitive match against name OR email
        const rx = new RegExp(escapeRegex(search.trim().slice(0, 100)), 'i');
        filter.$or = [{ name: rx }, { email: rx }];
      }
    }

    if (role !== undefined && role !== '') {
      if (!ROLES.includes(role)) errors.role = 'role must be one of: admin, organizer, member';
      else filter.role = role;
    }

    if (isActive !== undefined && isActive !== '') {
      if (isActive !== 'true' && isActive !== 'false') errors.isActive = 'isActive must be true or false';
      else filter.isActive = isActive === 'true';
    }

    if (Object.keys(errors).length) throw httpError(400, 'Validation failed.', errors);

    // password is select:false, so it is never included
    const users = await User.find(filter).sort({ createdAt: -1 });

    res.status(200).json(users);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/admin/users/:id                       (admin)
// FR-USR-09: can't delete an organizer who still owns events
// FR-USR-10: can't delete the last active administrator
// ---------------------------------------------------------------------------
export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) throw httpError(404, 'User not found.');

    const user = await User.findById(id);
    if (!user) throw httpError(404, 'User not found.');

    if (user.role === 'organizer' && (await Event.exists({ organizer: user._id }))) {
      throw httpError(
        409,
        'Cannot delete an organizer who owns events. Reassign or delete their events first.'
      );
    }

    if (user.role === 'admin' && user.isActive) {
      const activeAdmins = await User.countDocuments({ role: 'admin', isActive: true });
      if (activeAdmins <= 1) {
        throw httpError(409, 'Cannot delete the last active administrator.');
      }
    }

    // Free the seats this user was holding, otherwise events would look fuller than they are.
    // (A user has at most one registration per event, so each one is exactly -1.)
    const registrations = await Registration.find({ user: user._id }).select('event').lean();

    await User.deleteOne({ _id: user._id });

    if (registrations.length) {
      await Event.bulkWrite(
        registrations.map((r) => ({
          updateOne: {
            filter: { _id: r.event, registeredCount: { $gt: 0 } },
            update: { $inc: { registeredCount: -1 } },
          },
        }))
      );
      await Registration.deleteMany({ user: user._id });
    }

    res.status(200).json({ message: 'User deleted successfully.' });
  } catch (err) {
    next(err);
  }
};
