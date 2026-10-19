import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Error shape consumed by middleware/errorHandler.js ({ status, message, errors }). */
const httpError = (status, message, errors) =>
  Object.assign(new Error(message), { status, ...(errors && { errors }) });

const isObjectId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);
const isAdmin = (user) => user.role === 'admin';
const sameId = (a, b) => String(a?._id ?? a) === String(b?._id ?? b);

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const ROLES = ['admin', 'organizer', 'member'];

/** Never leaks the password hash. */
const toPublicUser = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  isActive: u.isActive,
  createdAt: u.createdAt,
});

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// Field validators: return an error string, or null when valid
const checkName = (v) => {
  if (typeof v !== 'string' || !v.trim()) return 'Full name is required';
  if (v.trim().length > 100) return 'Name cannot exceed 100 characters';
  return null;
};

const checkEmail = (v) => {
  if (typeof v !== 'string' || !v.trim()) return 'Email is required';
  if (!EMAIL_RE.test(v.trim())) return 'Please enter a valid email';
  return null;
};

const checkPassword = (v) => {
  if (typeof v !== 'string' || !v) return 'Password is required';
  if (v.length < 8) return 'Password must be at least 8 characters';
  // bcrypt silently ignores everything past 72 bytes
  if (Buffer.byteLength(v) > 72) return 'Password cannot exceed 72 bytes';
  return null;
};

const normalizeEmail = (v) => v.trim().toLowerCase();

/** True when `user` is the only active admin left (FR-USR-10 lockout guard). */
const isLastActiveAdmin = async (user) =>
  user.role === 'admin' &&
  user.isActive &&
  (await User.countDocuments({ role: 'admin', isActive: true })) <= 1;

// ---------------------------------------------------------------------------
// POST /api/users/register                     (public)   FR-AUTH-02
// ---------------------------------------------------------------------------
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const errors = {};
    const nameErr = checkName(name);
    const emailErr = checkEmail(email);
    const passwordErr = checkPassword(password);
    if (nameErr) errors.name = nameErr;
    if (emailErr) errors.email = emailErr;
    if (passwordErr) errors.password = passwordErr;
    if (Object.keys(errors).length) throw httpError(400, 'Validation failed.', errors);

    const normalizedEmail = normalizeEmail(email);
    if (await User.exists({ email: normalizedEmail })) {
      throw httpError(409, 'An account with this email already exists.');
    }

    let user;
    try {
      user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password,          // hashed by the model's pre-save hook
        role: 'member',    // FR-AUTH-02: always member, whatever the body says
      });
    } catch (err) {
      if (err.code === 11000) throw httpError(409, 'An account with this email already exists.');
      throw err;
    }

    res.status(201).json({
      message: 'Account created successfully.',
      user: toPublicUser(user),
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/users/login                        (public, rate limited)
// ---------------------------------------------------------------------------
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const errors = {};
    if (typeof email !== 'string' || !email.trim()) errors.email = 'Email is required';
    if (typeof password !== 'string' || !password) errors.password = 'Password is required';
    if (Object.keys(errors).length) throw httpError(400, 'Validation failed.', errors);

    // password is select:false, so it has to be requested explicitly here
    const user = await User.findOne({ email: normalizeEmail(email) }).select('+password');

    // Same message for "no such user" and "wrong password" so emails can't be enumerated
    const passwordOk = user ? await user.comparePassword(password) : false;
    if (!passwordOk) throw httpError(401, 'Invalid email or password.');

    // Checked after the password so only the real owner learns the account is deactivated
    if (!user.isActive) {
      throw httpError(403, 'Account deactivated. Contact an administrator.');
    }

    res.status(200).json({ token: signToken(user), user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/users/:userId                       (own profile, admin)
// Also the FR-AUTH-09 hydration check: a deactivated account gets 403.
// ---------------------------------------------------------------------------
export const getProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isObjectId(userId)) throw httpError(404, 'User not found.');

    if (!isAdmin(req.user) && !sameId(userId, req.user._id)) {
      throw httpError(403, 'Access denied.');
    }

    const user = await User.findById(userId);
    if (!user) throw httpError(404, 'User not found.');

    if (!user.isActive && sameId(user, req.user._id)) {
      throw httpError(403, 'Account deactivated. Contact an administrator.');
    }

    res.status(200).json(toPublicUser(user));
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PUT /api/users/:userId                       (own profile, admin)
// Body (all optional): name, email, password, isActive (admin only)
// Role is deliberately NOT updatable here, use PATCH /:id/role.
// ---------------------------------------------------------------------------
export const updateProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isObjectId(userId)) throw httpError(404, 'User not found.');

    const admin = isAdmin(req.user);
    if (!admin && !sameId(userId, req.user._id)) throw httpError(403, 'Access denied.');

    const user = await User.findById(userId);
    if (!user) throw httpError(404, 'User not found.');

    const { name, email, password, isActive } = req.body;

    if (isActive !== undefined && !admin) {
      throw httpError(403, 'Only an administrator can change account status.');
    }

    const errors = {};
    let newEmail;

    if (name !== undefined) {
      const err = checkName(name);
      if (err) errors.name = err;
    }
    if (email !== undefined) {
      const err = checkEmail(email);
      if (err) errors.email = err;
      else newEmail = normalizeEmail(email);
    }
    if (password !== undefined) {
      const err = checkPassword(password);
      if (err) errors.password = err;
    }
    if (isActive !== undefined && typeof isActive !== 'boolean') {
      errors.isActive = 'isActive must be true or false';
    }
    if (Object.keys(errors).length) throw httpError(400, 'Validation failed.', errors);

    if (newEmail && newEmail !== user.email) {
      const taken = await User.exists({ email: newEmail, _id: { $ne: user._id } });
      if (taken) throw httpError(409, 'An account with this email already exists.');
    }

    if (isActive === false && (await isLastActiveAdmin(user))) {
      throw httpError(409, 'Cannot deactivate the last active administrator.');
    }

    if (name !== undefined) user.name = name.trim();
    if (newEmail) user.email = newEmail;
    if (password !== undefined) user.password = password; // re-hashed by the pre-save hook
    if (isActive !== undefined) user.isActive = isActive;

    try {
      await user.save(); // save() (not findByIdAndUpdate) so the hash hook runs
    } catch (err) {
      if (err.code === 11000) throw httpError(409, 'An account with this email already exists.');
      throw err;
    }

    res.status(200).json(toPublicUser(user));
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/users/:id/role                    (admin)
// Body: { role }
// ---------------------------------------------------------------------------
export const updateRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) throw httpError(404, 'User not found.');

    const { role } = req.body;
    if (!ROLES.includes(role)) {
      throw httpError(400, 'Validation failed.', {
        role: 'Role must be one of: admin, organizer, member',
      });
    }

    const user = await User.findById(id);
    if (!user) throw httpError(404, 'User not found.');

    if (role !== 'admin' && (await isLastActiveAdmin(user))) {
      throw httpError(409, 'Cannot demote the last active administrator.');
    }

    user.role = role;
    await user.save();

    res.status(200).json(toPublicUser(user));
  } catch (err) {
    next(err);
  }
};
