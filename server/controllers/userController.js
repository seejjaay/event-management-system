import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { checkName, checkEmail, checkPassword, normalizeEmail, collapseSpaces } from '../utils/validators.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Error shape consumed by middleware/errorHandler.js ({ status, message, errors }). */
const httpError = (status, message, errors) =>
  Object.assign(new Error(message), { status, ...(errors && { errors }) });

const isObjectId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);
const isAdmin = (user) => user.role === 'admin';
const sameId = (a, b) => String(a?._id ?? a) === String(b?._id ?? b);

const ROLES = ['admin', 'organizer', 'member'];

/** Never leaks the password hash. */
const toPublicUser = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  isActive: u.isActive,
  createdAt: u.createdAt,
  avatarUpdatedAt: u.avatarUpdatedAt ?? null, // only the timestamp; the image itself is served by GET /:userId/avatar
});

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

/** True when `user` is the only active admin left (FR-USR-10 lockout guard). */
const isLastActiveAdmin = async (user) =>
  user.role === 'admin' &&
  user.isActive &&
  (await User.countDocuments({ role: 'admin', isActive: true })) <= 1;

// ---------------------------------------------------------------------------
// POST /api/users/register                     (public)   FR-AUTH-02
// ---------------------------------------------------------------------------
/** Validates the body, enforces unique email and creates the account with the given role. */
const createAccount = async (body, role) => {
  const { name, email, password } = body;

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

  try {
    return await User.create({
      name: collapseSpaces(name),
      email: normalizedEmail,
      password,          // hashed by the model's pre-save hook
      role,
    });
  } catch (err) {
    if (err.code === 11000) throw httpError(409, 'An account with this email already exists.');
    throw err;
  }
};

export const register = async (req, res, next) => {
  try {
    // FR-AUTH-02: public sign-up is always member, whatever the body says
    const user = await createAccount(req.body, 'member');
    res.status(201).json({
      message: 'Account created successfully.',
      user: toPublicUser(user),
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/admin/users                        (admin)    admin creates an account with a role
// ---------------------------------------------------------------------------
export const adminCreateUser = async (req, res, next) => {
  try {
    const role = req.body.role ?? 'member';
    if (!ROLES.includes(role)) {
      throw httpError(400, 'Validation failed.', { role: 'role must be one of: admin, organizer, member' });
    }
    const user = await createAccount(req.body, role);
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

    const user = await User.findById(userId).select('+password');
    if (!user) throw httpError(404, 'User not found.');

    const { name, email, password, currentPassword, isActive } = req.body;

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
    if (Object.keys(errors).length) throw httpError(400, 'Validation failed.', errors);

    // Changing your own password requires proving you know the current one
    // (an admin resetting someone else's password does not).
    if (password !== undefined && sameId(userId, req.user._id)) {
      if (typeof currentPassword !== 'string' || !currentPassword) {
        throw httpError(400, 'Validation failed.', { currentPassword: 'Current password is required' });
      }
      if (!(await user.comparePassword(currentPassword))) {
        throw httpError(401, 'Current password is incorrect.');
      }
      if (currentPassword === password) {
        throw httpError(400, 'Validation failed.', { password: 'New password must be different from the current one' });
      }
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

    if (name !== undefined) user.name = collapseSpaces(name);
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

// ---------------------------------------------------------------------------
// Profile pictures
// Stored on the user document (select:false), served with a long cache lifetime; the client
// adds ?v=<avatarUpdatedAt> so a new upload gets a new URL.
// ---------------------------------------------------------------------------
const AVATAR_MAX_BYTES = 200 * 1024;
const AVATAR_DATA_URL = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/;

/** The declared content type has to match the bytes, so a renamed file can't masquerade as an image. */
const matchesImageSignature = (buf, type) => {
  if (type === 'image/png') return buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === 'image/jpeg') return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (type === 'image/webp') return buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
  return false;
};

// PUT /api/users/:userId/avatar               (own account)   body: { image: "data:image/webp;base64,..." }
export const setAvatar = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isObjectId(userId)) throw httpError(404, 'User not found.');
    if (!sameId(userId, req.user._id)) throw httpError(403, 'You can only change your own profile picture.');

    const match = typeof req.body?.image === 'string' ? AVATAR_DATA_URL.exec(req.body.image) : null;
    if (!match) throw httpError(400, 'Validation failed.', { image: 'Please upload a PNG, JPEG or WebP image.' });

    const [, contentType, b64] = match;
    const data = Buffer.from(b64, 'base64');
    if (data.length > AVATAR_MAX_BYTES) {
      throw httpError(400, 'Validation failed.', { image: 'Image is too large (max 200 KB after resizing).' });
    }
    if (!matchesImageSignature(data, contentType)) {
      throw httpError(400, 'Validation failed.', { image: 'That file is not a valid image.' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { avatar: { data, contentType }, avatarUpdatedAt: new Date() } },
      { new: true }
    );
    if (!user) throw httpError(404, 'User not found.');

    res.status(200).json(toPublicUser(user));
  } catch (err) {
    next(err);
  }
};

// DELETE /api/users/:userId/avatar            (own account)
export const removeAvatar = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isObjectId(userId)) throw httpError(404, 'User not found.');
    if (!sameId(userId, req.user._id)) throw httpError(403, 'You can only change your own profile picture.');

    const user = await User.findByIdAndUpdate(
      userId,
      { $unset: { avatar: 1 }, $set: { avatarUpdatedAt: null } },
      { new: true }
    );
    if (!user) throw httpError(404, 'User not found.');

    res.status(200).json(toPublicUser(user));
  } catch (err) {
    next(err);
  }
};

// GET /api/users/:userId/avatar               (public: an <img> tag can't send the Bearer token)
export const getAvatar = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isObjectId(userId)) throw httpError(404, 'Not found.');

    const user = await User.findById(userId).select('+avatar');
    if (!user?.avatar?.data) throw httpError(404, 'Not found.');

    res.set('Content-Type', user.avatar.contentType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.status(200).send(user.avatar.data);
  } catch (err) {
    next(err);
  }
};
