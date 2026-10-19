import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import {
  rsvp,
  cancelRsvp,
  getUserRegistrations,
  getRoster,
  checkIn,
} from '../controllers/registrationController.js';

const router = Router();

router.use(verifyToken);

// RSVP
router.post('/', requireRole(['member', 'admin']), rsvp);

// Specific paths first, so '/:id' never swallows them
router.get('/user/:userId', getUserRegistrations);                              // own user or admin (controller)
router.get('/event/:eventId', requireRole(['organizer', 'admin']), getRoster);  // own event or admin (controller)

// Single registration
router.patch('/:id/check-in', requireRole(['organizer', 'admin']), checkIn);    // own event or admin (controller)
router.delete('/:id', cancelRsvp);                                              // own registration or admin (controller)

export default router;
