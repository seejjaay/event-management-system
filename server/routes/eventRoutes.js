import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
} from '../controllers/eventController.js';

const router = Router();

// Every route needs a valid token
router.use(verifyToken);

// Any logged-in user
router.get('/', getEvents);
router.get('/:id', getEventById);

// Organizer or admin (ownership of the event is checked inside updateEvent)
router.post('/', requireRole(['organizer', 'admin']), createEvent);
router.put('/:id', requireRole(['organizer', 'admin']), updateEvent);

export default router;
