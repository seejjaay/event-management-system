import mongoose from 'mongoose';

const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 3000;

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('[DB] MONGO_URI is not set. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }
  if (!process.env.JWT_SECRET) {
    console.error('[DB] JWT_SECRET is not set. Refusing to start.');
    process.exit(1);
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await mongoose.connect(uri);
      console.log('[DB] MongoDB connected.');
      return;
    } catch (err) {
      console.error(`[DB] Connection attempt ${attempt}/${MAX_ATTEMPTS} failed: ${err.message}`);
      if (attempt === MAX_ATTEMPTS) process.exit(1);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
}
