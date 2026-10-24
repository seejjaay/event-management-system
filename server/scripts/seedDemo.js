// Demo data for the integration checklist. Mirrors src/services/mockBackend.js.
// Idempotent: existing users/events/registrations are left alone, and
// registeredCount is recomputed from real registrations. Does not delete anything.
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Event from '../models/Event.js';
import Venue from '../models/Venue.js';
import Registration from '../models/Registration.js';

if (process.env.NODE_ENV === 'production') {
  console.error('[SeedDemo] Refusing to seed demo data in production.');
  process.exit(1);
}

const DAY = 86400000;
const PASSWORD = 'Password123!';

await mongoose.connect(process.env.MONGO_URI);

const userSeeds = [
  ['System Administrator', 'admin@orgavents.edu', 'admin'],
  ['Computer Science Society', 'organizer@campus.edu', 'organizer'],
  ['Engineering Student Council', 'engineering.council@campus.edu', 'organizer'],
  ['Alex Rivera', 'member@campus.edu', 'member'],
  ['Sam Cruz', 'sam.cruz@campus.edu', 'member'],
  ['Jordan Reyes', 'jordan.reyes@campus.edu', 'member'],
  ['Taylor Santos', 'taylor.santos@campus.edu', 'member'],
  ['Casey Lim', 'casey.lim@campus.edu', 'member'],
  ['Morgan Lee', 'morgan.lee@campus.edu', 'member'],
  ['Jamie Flores', 'jamie.flores@campus.edu', 'member'],
  ['Riley Diaz', 'riley.diaz@campus.edu', 'member'],
  ['Inactive Student', 'inactive.student@campus.edu', 'member', false],
];

const users = {};
for (const [name, email, role, isActive = true] of userSeeds) {
  users[email] =
    (await User.findOne({ email })) ||
    (await User.create({ name, email, password: PASSWORD, role, isActive }));
}
const u = (email) => users[email]._id;

const cs = u('organizer@campus.edu');
const council = u('engineering.council@campus.edu');

const eventSeeds = [
  {
    key: 'git',
    title: 'Intro to Git & GitHub Workshop',
    description: 'A hands-on beginner workshop covering Git basics, branching, pull requests, and collaborating on GitHub. Bring your laptop and leave ready to contribute to real projects.',
    date: Date.now() + 7 * DAY, venue: 'Tech Building Lab 304', capacity: 40, organizer: cs,
  },
  {
    key: 'iot',
    title: 'IoT & LoRa Mesh Prototyping Lab',
    description: 'Build a working IoT sensor mesh using Arduino, LoRa modules, and a Raspberry Pi gateway. Students will program live sensor nodes and visualize data on a dashboard.',
    date: Date.now() + 14 * DAY, venue: 'Engineering Center Room 203', capacity: 25, organizer: cs,
  },
  {
    key: 'ai',
    title: 'AI Ethics & Software Security Symposium',
    description: 'A half-day symposium featuring three talks on AI bias in hiring, responsible ML deployment, and securing web APIs against common OWASP vulnerabilities.',
    date: Date.now() + 21 * DAY, venue: 'Auditorium Hall A', capacity: 5, organizer: council, // full
  },
  {
    key: 'frosh',
    title: 'Campus Freshmen Orientation',
    description: 'Welcome orientation for incoming freshmen. Learn about academic policies, meet your professors, explore student organizations, and enjoy icebreakers with your new batchmates.',
    date: Date.now() - 10 * DAY, venue: 'Student Activity Center', capacity: 50, organizer: council, // past
  },
  {
    key: 'net',
    title: 'Industry Networking Night 2026',
    description: 'Connect with campus alumni working at top tech companies. Bring your resume and LinkedIn QR code. Refreshments provided.',
    date: Date.now() + 30 * DAY, venue: 'University Grand Hall', capacity: 80, organizer: council,
  },
];

const events = {};
for (const { key, date, ...rest } of eventSeeds) {
  const nameKey = rest.venue.toLowerCase();
  const venue =
    (await Venue.findOne({ nameKey })) || (await Venue.create({ name: rest.venue, nameKey }));
  const start = new Date(date);
  events[key] =
    (await Event.findOne({ title: rest.title, organizer: rest.organizer })) ||
    (await Event.create({
      ...rest,
      date: start,
      endDate: new Date(start.getTime() + 2 * 3600 * 1000),
      venueId: venue._id,
    }));
}

// [member email, event key, checkedIn]
const regSeeds = [
  ['member@campus.edu', 'git', true], ['sam.cruz@campus.edu', 'git', true],
  ['jordan.reyes@campus.edu', 'git'], ['taylor.santos@campus.edu', 'git'],
  ['casey.lim@campus.edu', 'git'], ['morgan.lee@campus.edu', 'git'],

  ['member@campus.edu', 'iot'], ['jamie.flores@campus.edu', 'iot'],
  ['riley.diaz@campus.edu', 'iot'], ['sam.cruz@campus.edu', 'iot'],

  ['member@campus.edu', 'ai'], ['sam.cruz@campus.edu', 'ai'],
  ['jordan.reyes@campus.edu', 'ai'], ['casey.lim@campus.edu', 'ai'],
  ['morgan.lee@campus.edu', 'ai'],

  ['member@campus.edu', 'frosh', true], ['sam.cruz@campus.edu', 'frosh', true],
  ['jordan.reyes@campus.edu', 'frosh', true], ['taylor.santos@campus.edu', 'frosh', true],
  ['casey.lim@campus.edu', 'frosh', true], ['morgan.lee@campus.edu', 'frosh'],
  ['jamie.flores@campus.edu', 'frosh'],

  ['riley.diaz@campus.edu', 'net'], ['jamie.flores@campus.edu', 'net'],
];

for (const [email, key, checkedIn = false] of regSeeds) {
  const filter = { user: u(email), event: events[key]._id };
  if (await Registration.exists(filter)) continue;
  await Registration.create({
    ...filter,
    checkedIn,
    checkedInAt: checkedIn ? new Date(Date.now() - DAY) : null,
    registeredAt: new Date(Date.now() - 5 * DAY),
  });
}

for (const ev of Object.values(events)) {
  ev.registeredCount = await Registration.countDocuments({ event: ev._id });
  await ev.save();
}

console.log(`[SeedDemo] ${Object.keys(users).length} users, ${Object.keys(events).length} events, ${await Registration.countDocuments()} registrations. Password for all: ${PASSWORD}`);
await mongoose.disconnect();
