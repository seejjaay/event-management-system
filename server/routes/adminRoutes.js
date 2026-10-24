import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { getUsers, deleteUser, getEvents, deleteEvent } from '../controllers/adminController.js';
import { adminCreateUser } from '../controllers/userController.js';
import { createVenue, updateVenue, deleteVenue } from '../controllers/venueController.js';

const router = Router();

// Everything under /api/admin is admin only
router.use(verifyToken, requireRole(['admin']));

router.get('/users', getUsers);        // ?search=&role=&isActive=
router.post('/users', adminCreateUser); // body: { name, email, password, role? }
router.delete('/users/:id', deleteUser);

router.get('/events', getEvents);
router.delete('/events/:id', deleteEvent);

router.post('/venues', createVenue);       // body: { name, capacity?, description? }
router.put('/venues/:id', updateVenue);    // body: any of name, capacity, description, isActive
router.delete('/venues/:id', deleteVenue); // 409 while events use it

export default router;
