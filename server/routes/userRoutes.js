import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import {
  register,
  login,
  getProfile,
  updateProfile,
  updateRole,
} from '../controllers/userController.js';

const router = Router();

// Public
router.post('/register', register);
router.post('/login', loginLimiter, login); // NFR-SEC-06: 5 attempts / 15 min

// Logged-in (own-profile vs admin is enforced inside the controller)
router.get('/:userId', verifyToken, getProfile);
router.put('/:userId', verifyToken, updateProfile);

// Admin only
router.patch('/:id/role', verifyToken, requireRole(['admin']), updateRole);

export default router;
