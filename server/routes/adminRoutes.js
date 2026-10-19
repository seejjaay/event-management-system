import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { getUsers, deleteUser, getEvents, deleteEvent } from '../controllers/adminController.js';

const router = Router();

// Everything under /api/admin is admin only
router.use(verifyToken, requireRole(['admin']));

router.get('/users', getUsers);        // ?search=&role=&isActive=
router.delete('/users/:id', deleteUser);

router.get('/events', getEvents);
router.delete('/events/:id', deleteEvent);

export default router;
