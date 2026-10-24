import 'dotenv/config';              // 1. FIRST, or JWT_SECRET will be undefined
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import sanitize from './middleware/sanitize.js';
import errorHandler from './middleware/errorHandler.js';
import userRoutes from './routes/userRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import registrationRoutes from './routes/registrationRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import venueRoutes from './routes/venueRoutes.js';

await connectDB();
const app = express();

// app.set('trust proxy', 1);        // only when behind exactly one proxy

app.use(cors({
  origin: process.env.CLIENT_ORIGIN,
  credentials: true,
  exposedHeaders: ['Content-Disposition'],  // lets the UI read the CSV filename
}));
// Profile pictures arrive as a base64 data URL (<=200KB image ≈ 270KB of text), so this one route
// gets a bigger cap. It must be registered first: the parser below skips bodies already parsed.
app.put('/api/users/:userId/avatar', express.json({ limit: '300kb' }));
app.use(express.json({ limit: '50kb' })); // 2. parse the body (small cap: no other endpoint needs more)
app.use(sanitize);                   // 3. then clean it, before any route

app.get('/api', (req, res) => res.json({ status: 'ok' }));   // health check

app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/venues', venueRoutes);

app.use((req, res) => {              // 4. 404 catch-all, after all routes
  res.status(404).json({ message: `Endpoint ${req.method} ${req.path} not found` });
});
app.use(errorHandler);               // 5. LAST

app.listen(process.env.PORT || 5000, () =>
  console.log(`[Server] OrgaVents API running on port ${process.env.PORT || 5000}`)
);

