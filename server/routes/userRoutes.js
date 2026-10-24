import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import {
  register,
  login,
  getProfile,
  updateProfile,
  updateRole,
  setAvatar,
  removeAvatar,
  getAvatar,
} from '../controllers/userController.js';

const router = Router();

// Public
router.post('/register', register);
router.post('/login', loginLimiter, login); // NFR-SEC-06: 5 attempts / 15 min

// Public: profile pictures load through <img>, which can't send the Bearer token
router.get('/:userId/avatar', getAvatar);

// Own account only (enforced inside the controller)
router.put('/:userId/avatar', verifyToken, setAvatar);
router.delete('/:userId/avatar', verifyToken, removeAvatar);

// Logged-in (own-profile vs admin is enforced inside the controller)
router.get('/:userId', verifyToken, getProfile);
router.put('/:userId', verifyToken, updateProfile);

// Admin only
router.patch('/:id/role', verifyToken, requireRole(['admin']), updateRole);

export default router;
