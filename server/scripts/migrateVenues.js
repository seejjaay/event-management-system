// One-time (and safe to re-run) migration for the venues + end-time feature:
//   1. creates a Venue for every distinct Event.venue text already in use
//   2. links each event to its venue (venueId) and normalises the stored name
//   3. gives events without an end time one (start + DEFAULT_EVENT_HOURS)
// Usage: npm run migrate:venues        (uses MONGO_URI from .env; pass --dry to only report)
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Event from '../models/Event.js';
import Venue from '../models/Venue.js';
import { collapseSpaces, LIMITS } from '../utils/validators.js';
dotenv.config();

const dryRun = process.argv.includes('--dry');
const keyOf = (name) => collapseSpaces(name).toLowerCase();

await mongoose.connect(process.env.MONGO_URI);
console.log(`[Migrate] connected to ${mongoose.connection.host}/${mongoose.connection.name}${dryRun ? ' (dry run)' : ''}`);

const venuesByKey = new Map((await Venue.find({})).map((v) => [v.nameKey, v]));
const events = await Event.find({ $or: [{ venueId: null }, { endDate: null }] });

let createdVenues = 0;
let linked = 0;
let endsAdded = 0;

for (const evt of events) {
  if (!evt.venueId) {
    const key = keyOf(evt.venue);
    let venue = venuesByKey.get(key);
    if (!venue) {
      if (!dryRun) venue = await Venue.create({ name: collapseSpaces(evt.venue), nameKey: key });
      else venue = { _id: null, name: collapseSpaces(evt.venue) };
      venuesByKey.set(key, venue);
      createdVenues += 1;
    }
    evt.venueId = venue._id;
    evt.venue = venue.name;
    linked += 1;
  }
  if (!evt.endDate) {
    evt.endDate = new Date(evt.date.getTime() + LIMITS.DEFAULT_EVENT_HOURS * 3600 * 1000);
    endsAdded += 1;
  }
  if (!dryRun) await evt.save();
}

console.log(`[Migrate] ${events.length} events checked: ${createdVenues} venues created, ${linked} events linked, ${endsAdded} end times added.`);
await mongoose.disconnect();
