import mongoose from 'mongoose';
import User from '../models/User.js';
import dotenv from 'dotenv';
dotenv.config();

await mongoose.connect(process.env.MONGO_URI);

const existing = await User.findOne({ email: 'admin@orgavents.edu' });
if (!existing) {
  await User.create({
    name: 'System Administrator',
    email: 'admin@orgavents.edu',
    password: 'Password123!',  // hashed by pre-save hook
    role: 'admin',
    isActive: true,
  });
  console.log('[Seed] Admin account created.');
} else {
  console.log('[Seed] Admin already exists.');
}
await mongoose.disconnect();