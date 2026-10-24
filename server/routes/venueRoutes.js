import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { getVenues } from '../controllers/venueController.js';

const router = Router();

// Any logged-in user can read the bookable venues; writes live under /api/admin/venues
router.get('/', verifyToken, getVenues);

export default router;
