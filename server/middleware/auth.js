import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const httpError = (status, message) => Object.assign(new Error(message), { status });

// Reads "Authorization: Bearer <token>", verifies it, and attaches the live user.
export async function verifyToken(req, res, next) {
  try {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw httpError(401, 'Authentication required.');
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      // Expired, tampered, or garbage token
      throw httpError(401, 'Session expired. Please log in again.');
    }

    // Always re-read the user so role changes and deactivation apply immediately (FR-AUTH-09)
    const user = await User.findById(payload.id);
    if (!user) throw httpError(401, 'Session expired. Please log in again.');
    if (!user.isActive) {
      throw httpError(403, 'Account deactivated. Contact an administrator.');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Usage: requireRole(['organizer', 'admin']). Must run AFTER verifyToken.
export const requireRole = (roles = []) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(httpError(403, 'Access denied. Insufficient permissions.'));
  }
  next();
};

