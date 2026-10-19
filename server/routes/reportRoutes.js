import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { getAttendance, exportRegistrants } from '../controllers/reportController.js';

const router = Router();

// Organizer or admin (own-event check is inside the controller)
router.use(verifyToken, requireRole(['organizer', 'admin']));

router.get('/events/:eventId/attendance', getAttendance);
router.get('/events/:eventId/export', exportRegistrants); // ?format=csv|json

export default router;
