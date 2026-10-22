/**
 * OrgaVents Mock Backend (mockBackend.js)
 * ────────────────────────────────────────
 * A fully self-contained, localStorage-backed API layer that mirrors every
 * OrgaVents SRS rule so the frontend can be demo'd and tested with zero server.
 *
 * Design rules enforced:
 *  FR-AUTH-01/02  – Registration always creates role=member
 *  FR-AUTH-04/05/06 – Login validates credentials + rejects deactivated accounts (403)
 *  FR-AUTH-12  – Logout clears token/user
 *  FR-EVT-09   – Edit/Delete blocks if capacity would drop below registeredCount
 *  FR-REG-02   – RSVP blocked on past events (409)
 *  FR-REG-04   – RSVP blocked when event is full (409)
 *  FR-REG-09/11 – One-tap check-in sets checkedIn=true and checkedInAt
 *  FR-REG-13   – Unregister blocked after check-in (409)
 *  FR-RPT-05/06 – CSV export with RFC 4180 quoting and formula injection protection
 *  FR-USR-09   – Delete Organizer blocked if they own active events (409)
 *  FR-USR-10   – Delete last active Admin blocked (409)
 *  NFR-SEC-06  – Login rate limiter (5 attempts / 15 min) in memory
 */

import * as V from '../utils/validators.js';

// ─── Storage key constants ────────────────────────────────────────────────────
const KEYS = {
  users: 'ov_mock_users',
  events: 'ov_mock_events',
  registrations: 'ov_mock_registrations',
  token: 'token',
  user: 'user',
};

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Generate a 24-char hex ID similar to MongoDB ObjectId */
function generateId() {
  return Array.from({ length: 24 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

function now() {
  return new Date().toISOString();
}

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

/** Simulate async latency (50-180ms) for realistic feel */
function delay(ms = 80) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Create a mock API error with status code (mirrors real backend shape) */
function apiError(message, status = 400, errors = {}) {
  const err = new Error(message);
  err.status = status;
  err.errors = errors;
  return err;
}

// ─── Password hashing (simple deterministic hash for mock — NOT cryptographic) ──
function hashPassword(plain) {
  // Encode as base64 for localStorage storage. Just obfuscation, not security.
  return btoa(`ov:${plain}`);
}
function checkPassword(plain, hash) {
  return btoa(`ov:${plain}`) === hash;
}

// ─── Rate Limiter (in-memory, resets on page refresh) ──────────────────────────
const _loginAttempts = {}; // { email: { count, resetAt } }
function checkRateLimit(email) {
  const record = _loginAttempts[email];
  if (!record) return;
  if (Date.now() > record.resetAt) {
    delete _loginAttempts[email];
    return;
  }
  if (record.count >= 5) {
    throw apiError('Too many login attempts. Please try again in 15 minutes.', 429);
  }
}
function recordFailedAttempt(email) {
  const record = _loginAttempts[email];
  if (!record || Date.now() > record.resetAt) {
    _loginAttempts[email] = { count: 1, resetAt: Date.now() + 15 * 60 * 1000 };
  } else {
    record.count += 1;
  }
}
function clearAttempts(email) {
  delete _loginAttempts[email];
}

// ─── Seed Data ────────────────────────────────────────────────────────────────
const SEED_VERSION = 'v6'; // bump to force re-seed on next load

/**
 * Build realistic campus demo data.
 * Dates: anchored relative to NOW so events always look "recent".
 */
function buildSeedData() {
  const adminId = generateId();
  const csSocietyOrganizerId = generateId();
  const councilOrganizerId = generateId();
  const alexId = generateId();
  const samId = generateId();
  const jordanId = generateId();
  const taylorId = generateId();
  const caseyId = generateId();
  const morganId = generateId();
  const jamieId = generateId();
  const rileyId = generateId();
  const inactiveId = generateId();

  const users = [
    {
      _id: adminId,
      name: 'System Administrator',
      email: 'admin@orgavents.edu',
      password: hashPassword('Password123!'),
      role: 'admin',
      isActive: true,
      createdAt: new Date(Date.now() - 180 * 86400000).toISOString(),
    },
    {
      _id: csSocietyOrganizerId,
      name: 'Computer Science Society',
      email: 'organizer@campus.edu',
      password: hashPassword('Password123!'),
      role: 'organizer',
      isActive: true,
      createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    },
    {
      _id: councilOrganizerId,
      name: 'Engineering Student Council',
      email: 'engineering.council@campus.edu',
      password: hashPassword('Password123!'),
      role: 'organizer',
      isActive: true,
      createdAt: new Date(Date.now() - 85 * 86400000).toISOString(),
    },
    {
      _id: alexId,
      name: 'Alex Rivera',
      email: 'member@campus.edu',
      password: hashPassword('Password123!'),
      role: 'member',
      isActive: true,
      createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    },
    {
      _id: samId,
      name: 'Sam Cruz',
      email: 'sam.cruz@campus.edu',
      password: hashPassword('Password123!'),
      role: 'member',
      isActive: true,
      createdAt: new Date(Date.now() - 58 * 86400000).toISOString(),
    },
    {
      _id: jordanId,
      name: 'Jordan Reyes',
      email: 'jordan.reyes@campus.edu',
      password: hashPassword('Password123!'),
      role: 'member',
      isActive: true,
      createdAt: new Date(Date.now() - 55 * 86400000).toISOString(),
    },
    {
      _id: taylorId,
      name: 'Taylor Santos',
      email: 'taylor.santos@campus.edu',
      password: hashPassword('Password123!'),
      role: 'member',
      isActive: true,
      createdAt: new Date(Date.now() - 52 * 86400000).toISOString(),
    },
    {
      _id: caseyId,
      name: 'Casey Lim',
      email: 'casey.lim@campus.edu',
      password: hashPassword('Password123!'),
      role: 'member',
      isActive: true,
      createdAt: new Date(Date.now() - 50 * 86400000).toISOString(),
    },
    {
      _id: morganId,
      name: 'Morgan Lee',
      email: 'morgan.lee@campus.edu',
      password: hashPassword('Password123!'),
      role: 'member',
      isActive: true,
      createdAt: new Date(Date.now() - 48 * 86400000).toISOString(),
    },
    {
      _id: jamieId,
      name: 'Jamie Flores',
      email: 'jamie.flores@campus.edu',
      password: hashPassword('Password123!'),
      role: 'member',
      isActive: true,
      createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
    },
    {
      _id: rileyId,
      name: 'Riley Diaz',
      email: 'riley.diaz@campus.edu',
      password: hashPassword('Password123!'),
      role: 'member',
      isActive: true,
      createdAt: new Date(Date.now() - 42 * 86400000).toISOString(),
    },
    {
      _id: inactiveId,
      name: 'Inactive Student',
      email: 'inactive.student@campus.edu',
      password: hashPassword('Password123!'),
      role: 'member',
      isActive: false, // FR-AUTH-06: deactivated account
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
  ];

  // Events anchored relative to now
  const gitWorkshopId = generateId();
  const iotLabId = generateId();
  const aiSymposiumId = generateId();
  const froshieId = generateId();
  const networkingId = generateId();

  const events = [
    {
      _id: gitWorkshopId,
      title: 'Intro to Git & GitHub Workshop',
      description:
        'A hands-on beginner workshop covering Git basics, branching, pull requests, and collaborating on GitHub. Bring your laptop and leave ready to contribute to real projects.',
      date: new Date(Date.now() + 7 * 86400000).toISOString(), // 7 days from now
      venue: 'Tech Building Lab 304',
      capacity: 40,
      registeredCount: 6,
      organizer: {
        _id: csSocietyOrganizerId,
        name: 'Computer Science Society',
        email: 'organizer@campus.edu',
      },
      createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    },
    {
      _id: iotLabId,
      title: 'IoT & LoRa Mesh Prototyping Lab',
      description:
        'Build a working IoT sensor mesh using Arduino, LoRa modules, and a Raspberry Pi gateway. Students will program live sensor nodes and visualize data on a dashboard.',
      date: new Date(Date.now() + 14 * 86400000).toISOString(), // 14 days from now
      venue: 'Engineering Center Room 203',
      capacity: 25,
      registeredCount: 4,
      organizer: {
        _id: csSocietyOrganizerId,
        name: 'Computer Science Society',
        email: 'organizer@campus.edu',
      },
      createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    },
    {
      _id: aiSymposiumId,
      title: 'AI Ethics & Software Security Symposium',
      description:
        'A half-day symposium featuring three talks on AI bias in hiring, responsible ML deployment, and securing web APIs against common OWASP vulnerabilities.',
      date: new Date(Date.now() + 21 * 86400000).toISOString(), // 21 days from now
      venue: 'Auditorium Hall A',
      capacity: 5, // intentionally small so it shows "Full" state
      registeredCount: 5, // FULL — FR-REG-04 demo
      organizer: {
        _id: councilOrganizerId,
        name: 'Engineering Student Council',
        email: 'engineering.council@campus.edu',
      },
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    },
    {
      _id: froshieId,
      title: 'Campus Freshmen Orientation',
      description:
        'Welcome orientation for incoming freshmen. Learn about academic policies, meet your professors, explore student organizations, and enjoy icebreakers with your new batchmates.',
      date: new Date(Date.now() - 10 * 86400000).toISOString(), // 10 days AGO — past event
      venue: 'Student Activity Center',
      capacity: 50,
      registeredCount: 7,
      organizer: {
        _id: councilOrganizerId,
        name: 'Engineering Student Council',
        email: 'engineering.council@campus.edu',
      },
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
    {
      _id: networkingId,
      title: 'Industry Networking Night 2026',
      description:
        'Connect with campus alumni working at top tech companies. Bring your resume and LinkedIn QR code. Refreshments provided.',
      date: new Date(Date.now() + 30 * 86400000).toISOString(),
      venue: 'University Grand Hall',
      capacity: 80,
      registeredCount: 22,
      organizer: {
        _id: councilOrganizerId,
        name: 'Engineering Student Council',
        email: 'engineering.council@campus.edu',
      },
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
  ];

  // Registrations seeded for Git Workshop (6 RSVPs, 2 checked in)
  const reg = (userId, eventId, checkedIn = false, checkedInAt = null) => ({
    _id: generateId(),
    user: userId,
    event: eventId,
    checkedIn,
    checkedInAt: checkedIn ? checkedInAt || new Date(Date.now() - 86400000).toISOString() : null,
    registeredAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  });

  const registrations = [
    // Git Workshop — 6 RSVPs, 2 checked in
    reg(alexId, gitWorkshopId, true),
    reg(samId, gitWorkshopId, true),
    reg(jordanId, gitWorkshopId, false),
    reg(taylorId, gitWorkshopId, false),
    reg(caseyId, gitWorkshopId, false),
    reg(morganId, gitWorkshopId, false),

    // IoT Lab — 4 RSVPs, none checked in
    reg(alexId, iotLabId, false),
    reg(jamieId, iotLabId, false),
    reg(rileyId, iotLabId, false),
    reg(samId, iotLabId, false),

    // AI Symposium — FULL (5/5)
    reg(alexId, aiSymposiumId, false),
    reg(samId, aiSymposiumId, false),
    reg(jordanId, aiSymposiumId, false),
    reg(caseyId, aiSymposiumId, false),
    reg(morganId, aiSymposiumId, false),

    // Freshmen Orientation — past event, 7 RSVPs, 5 checked in
    reg(alexId, froshieId, true),
    reg(samId, froshieId, true),
    reg(jordanId, froshieId, true),
    reg(taylorId, froshieId, true),
    reg(caseyId, froshieId, true),
    reg(morganId, froshieId, false),
    reg(jamieId, froshieId, false),

    // Networking Night
    reg(rileyId, networkingId, false),
    reg(jamieId, networkingId, false),
  ];

  return { users, events, registrations };
}

// ─── DB initialization ────────────────────────────────────────────────────────

export function initMockDB() {
  const storedVersion = localStorage.getItem('ov_mock_seed_version');
  if (storedVersion === SEED_VERSION) return; // already seeded this version

  const { users, events, registrations } = buildSeedData();
  write(KEYS.users, users);
  write(KEYS.events, events);
  write(KEYS.registrations, registrations);
  localStorage.setItem('ov_mock_seed_version', SEED_VERSION);
}

/** Hard reset: clears all mock data and re-seeds. Call from the Reset Demo button. */
export function resetMockDB() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  localStorage.removeItem('ov_mock_seed_version');
  localStorage.removeItem('orgavents_sidebar_collapsed');
  initMockDB();
}

// ─── Internal DB accessors ─────────────────────────────────────────────────────

function getUsers() { return read(KEYS.users) || []; }
function getEvents() { return read(KEYS.events) || []; }
function getRegistrations() { return read(KEYS.registrations) || []; }
function saveUsers(u) { write(KEYS.users, u); }
function saveEvents(e) { write(KEYS.events, e); }
function saveRegistrations(r) { write(KEYS.registrations, r); }

/** Return user without password field */
function safeUser(u) {
  if (!u) return null;
  const { password: _p, ...rest } = u;
  return rest;
}

/** Populate event's organizer field from users */
function populateEventOrganizer(event) {
  const users = getUsers();
  if (event.organizer && typeof event.organizer === 'object') return event;
  const organizer = users.find((u) => u._id === event.organizer);
  return {
    ...event,
    organizer: organizer
      ? { _id: organizer._id, name: organizer.name, email: organizer.email }
      : null,
  };
}

/** Populate registration's event and user fields */
function populateRegistration(reg) {
  const users = getUsers();
  const events = getEvents();
  const user = users.find((u) => u._id === reg.user);
  const event = events.find((e) => e._id === (reg.event?._id || reg.event));
  return {
    ...reg,
    user: user ? safeUser(user) : { _id: reg.user },
    event: event ? populateEventOrganizer(event) : { _id: reg.event },
  };
}

/** Get the currently authenticated user from token (JWT-style id stored in localStorage) */
function getCurrentUser() {
  const token = localStorage.getItem(KEYS.token);
  if (!token) return null;
  const userId = atob(token.split('.')[1] || '');
  const users = getUsers();
  return users.find((u) => u._id === userId) || null;
}

function requireAuth() {
  const u = getCurrentUser();
  if (!u) throw apiError('Unauthorized. Please log in.', 401);
  if (!u.isActive) throw apiError('Your account has been deactivated or privileges revoked. Please contact an administrator.', 403);
  return u;
}

function requireRole(...roles) {
  const u = requireAuth();
  if (!roles.includes(u.role)) throw apiError('Forbidden. Insufficient permissions.', 403);
  return u;
}

// ─── Fake JWT factory ──────────────────────────────────────────────────────────
function makeToken(userId) {
  // header.payload.signature (all base64url encoded stubs — not verifiable)
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(userId); // payload is just the userId for the mock
  const sig = btoa('mock-signature');
  return `${header}.${payload}.${sig}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/users/login
 * Body: { email, password }
 * Returns: { token, user }
 */
export async function mockLogin(email, password) {
  await delay();
  checkRateLimit(email);
  const users = getUsers();
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || !checkPassword(password, user.password)) {
    recordFailedAttempt(email);
    throw apiError('Invalid email or password.', 401);
  }
  if (!user.isActive) {
    throw apiError('Account deactivated. Contact an administrator.', 403);
  }
  clearAttempts(email);
  const token = makeToken(user._id);
  return { token, user: safeUser(user) };
}

/**
 * POST /api/users/register
 * Body: { name, email, password }
 * Returns: { message, user }
 * Note: role is ALWAYS set to 'member' (FR-AUTH-02)
 */
export async function mockRegister({ name, email, password }) {
  return createMockAccount({ name, email, password }, 'member');
}

/**
 * POST /api/admin/users  (admin only) — like register, but honours `role`.
 */
export async function mockAdminCreateUser({ name, email, password, role = 'member' }) {
  requireRole('admin');
  if (!['admin', 'organizer', 'member'].includes(role)) {
    throw apiError('Validation failed.', 400, { role: 'Must be admin, organizer, or member.' });
  }
  return createMockAccount({ name, email, password }, role);
}

async function createMockAccount({ name, email, password }, role) {
  await delay();
  const errors = {};
  const nameErr = V.checkName(name);
  const emailErr = V.checkEmail(email);
  const passwordErr = V.checkPassword(password);
  if (nameErr) errors.name = nameErr;
  if (emailErr) errors.email = emailErr;
  if (passwordErr) errors.password = passwordErr;
  if (Object.keys(errors).length) throw apiError('Validation failed.', 400, errors);

  const users = getUsers();
  if (users.find((u) => u.email.toLowerCase() === V.normalizeEmail(email))) {
    throw apiError('An account with this email already exists.', 409);
  }
  const newUser = {
    _id: generateId(),
    name: V.collapseSpaces(name),
    email: V.normalizeEmail(email),
    password: hashPassword(password),
    role,
    isActive: true,
    createdAt: now(),
  };
  users.push(newUser);
  saveUsers(users);
  return { message: 'Account created successfully.', user: safeUser(newUser) };
}

/**
 * GET /api/users/:userId
 * Returns the user profile (no password)
 */
export async function mockGetUserProfile(userId) {
  await delay(40);
  requireAuth();
  const users = getUsers();
  const user = users.find((u) => u._id === userId);
  if (!user) throw apiError('User not found.', 404);
  return safeUser(user);
}

/**
 * PUT /api/users/:userId
 * Body: { name?, email?, password?, isActive? }
 * Organizer/Admin can update own profile. Admin can update others.
 */
export async function mockUpdateUserProfile(userId, updates) {
  await delay();
  const me = requireAuth();
  const users = getUsers();
  const idx = users.findIndex((u) => u._id === userId);
  if (idx === -1) throw apiError('User not found.', 404);
  if (me.role !== 'admin' && me._id !== userId) {
    throw apiError('Forbidden.', 403);
  }
  const user = users[idx];

  const errors = {};
  if (updates.name !== undefined) {
    const err = V.checkName(updates.name);
    if (err) errors.name = err;
  }
  if (updates.email !== undefined) {
    const err = V.checkEmail(updates.email);
    if (err) errors.email = err;
  }
  if (updates.password !== undefined) {
    const err = V.checkPassword(updates.password);
    if (err) errors.password = err;
  }
  if (Object.keys(errors).length) throw apiError('Validation failed.', 400, errors);

  // Changing your own password requires the current one
  if (updates.password !== undefined && me._id === userId) {
    if (!updates.currentPassword) {
      throw apiError('Validation failed.', 400, { currentPassword: 'Current password is required' });
    }
    if (!checkPassword(updates.currentPassword, user.password)) {
      throw apiError('Current password is incorrect.', 401);
    }
    if (updates.currentPassword === updates.password) {
      throw apiError('Validation failed.', 400, { password: 'New password must be different from the current one' });
    }
  }

  if (updates.name !== undefined) user.name = V.collapseSpaces(updates.name);
  if (updates.email !== undefined) {
    const email = V.normalizeEmail(updates.email);
    const conflict = users.find((u) => u.email.toLowerCase() === email && u._id !== userId);
    if (conflict) throw apiError('Email already in use.', 409);
    user.email = email;
  }
  if (updates.password !== undefined) user.password = hashPassword(updates.password);
  if (me.role === 'admin' && updates.isActive !== undefined) user.isActive = Boolean(updates.isActive);
  users[idx] = user;
  saveUsers(users);
  return safeUser(user);
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENTS ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/events?from=ISO&to=ISO
 * Returns events visible to all authenticated users (with organizer populated)
 */
export async function mockGetEvents(params = {}) {
  await delay(60);
  requireAuth();
  let events = getEvents().map(populateEventOrganizer);

  if (params.from) {
    events = events.filter((e) => new Date(e.date) >= new Date(params.from));
  }
  if (params.to) {
    events = events.filter((e) => new Date(e.date) <= new Date(params.to));
  }
  if (params.organizer) {
    events = events.filter(
      (e) => (e.organizer?._id || e.organizer) === params.organizer
    );
  }
  return events;
}

/**
 * GET /api/admin/events  (admin-only — returns ALL events with full details)
 */
export async function mockGetAdminEvents(params = {}) {
  await delay(60);
  requireRole('admin', 'organizer');
  return mockGetEvents(params);
}

/**
 * GET /api/events/:id
 */
export async function mockGetEventById(id) {
  await delay(40);
  requireAuth();
  const events = getEvents();
  const event = events.find((e) => e._id === id);
  if (!event) throw apiError('Event not found.', 404);
  return populateEventOrganizer(event);
}

/**
 * POST /api/events
 * Body: { title, description, date, venue, capacity }
 * Organizer or Admin only.
 */
export async function mockCreateEvent(eventData) {
  await delay();
  const me = requireRole('organizer', 'admin');
  const errors = {};
  const checks = {
    title: V.checkEventTitle(eventData.title),
    description: V.checkDescription(eventData.description),
    date: V.checkEventDate(eventData.date, { requireFuture: true }),
    venue: V.checkVenue(eventData.venue),
    capacity: V.checkCapacity(eventData.capacity),
  };
  for (const [field, err] of Object.entries(checks)) if (err) errors[field] = err;
  if (Object.keys(errors).length) throw apiError('Validation failed.', 400, errors);

  const events = getEvents();
  const newEvent = {
    _id: generateId(),
    title: V.collapseSpaces(eventData.title),
    description: eventData.description.trim(),
    date: eventData.date,
    venue: V.collapseSpaces(eventData.venue),
    capacity: Number(eventData.capacity),
    registeredCount: 0,
    organizer: me._id,
    createdAt: now(),
  };
  events.push(newEvent);
  saveEvents(events);
  return populateEventOrganizer(newEvent);
}

/**
 * PUT /api/events/:id
 * Body: { title?, description?, date?, venue?, capacity? }
 * FR-EVT-09: capacity cannot be reduced below current registeredCount
 */
export async function mockUpdateEvent(id, eventData) {
  await delay();
  const me = requireRole('organizer', 'admin');
  const events = getEvents();
  const idx = events.findIndex((e) => e._id === id);
  if (idx === -1) throw apiError('Event not found.', 404);

  const event = events[idx];
  const isOwner = (event.organizer?._id || event.organizer) === me._id;
  if (me.role !== 'admin' && !isOwner) throw apiError('Forbidden. You do not own this event.', 403);

  const errors = {};
  const checks = {
    title: eventData.title !== undefined && V.checkEventTitle(eventData.title),
    description: eventData.description !== undefined && V.checkDescription(eventData.description),
    date: eventData.date !== undefined && V.checkEventDate(eventData.date),
    venue: eventData.venue !== undefined && V.checkVenue(eventData.venue),
    capacity: eventData.capacity !== undefined && V.checkCapacity(eventData.capacity),
  };
  for (const [field, err] of Object.entries(checks)) if (err) errors[field] = err;
  if (Object.keys(errors).length) throw apiError('Validation failed.', 400, errors);

  // FR-EVT-09: capacity must remain >= registeredCount
  const newCapacity = eventData.capacity !== undefined ? Number(eventData.capacity) : event.capacity;
  if (newCapacity < event.registeredCount) {
    throw apiError(
      `Capacity cannot be less than the current number of registrations (${event.registeredCount}).`,
      409
    );
  }

  const updated = {
    ...event,
    title: eventData.title !== undefined ? V.collapseSpaces(eventData.title) : event.title,
    description: eventData.description !== undefined ? eventData.description.trim() : event.description,
    date: eventData.date ?? event.date,
    venue: eventData.venue !== undefined ? V.collapseSpaces(eventData.venue) : event.venue,
    capacity: newCapacity,
  };
  events[idx] = updated;
  saveEvents(events);
  return populateEventOrganizer(updated);
}

/**
 * DELETE /api/events/:id
 * Organizer (own events) or Admin. Also cascades to registrations.
 */
export async function mockDeleteEvent(id) {
  await delay();
  const me = requireRole('organizer', 'admin');
  const events = getEvents();
  const idx = events.findIndex((e) => e._id === id);
  if (idx === -1) throw apiError('Event not found.', 404);
  const event = events[idx];
  const isOwner = (event.organizer?._id || event.organizer) === me._id;
  if (me.role !== 'admin' && !isOwner) throw apiError('Forbidden.', 403);
  events.splice(idx, 1);
  saveEvents(events);
  // cascade delete registrations
  const regs = getRegistrations().filter((r) => (r.event?._id || r.event) !== id);
  saveRegistrations(regs);
  return { message: 'Event deleted successfully.' };
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRATIONS ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/registrations
 * Body: { eventId }
 * FR-REG-02: block past events, FR-REG-04: block full events
 */
export async function mockRsvp(eventId) {
  await delay();
  const me = requireRole('member', 'admin'); // matches the API: organizers can't RSVP
  const events = getEvents();
  const eventIdx = events.findIndex((e) => e._id === eventId);
  if (eventIdx === -1) throw apiError('Event not found.', 404);
  const event = events[eventIdx];

  // FR-REG-02: past event block
  if (new Date(event.date) < new Date()) {
    throw apiError('Registration is closed. This event has already started.', 409);
  }

  // FR-REG-04: full event block
  if (event.registeredCount >= event.capacity) {
    throw apiError('Event is full. No seats available.', 409);
  }

  const regs = getRegistrations();
  const alreadyRegistered = regs.find(
    (r) => (r.event?._id || r.event) === eventId && r.user === me._id
  );
  if (alreadyRegistered) throw apiError('You are already registered for this event.', 409);

  const newReg = {
    _id: generateId(),
    user: me._id,
    event: eventId,
    checkedIn: false,
    checkedInAt: null,
    registeredAt: now(),
  };
  regs.push(newReg);
  saveRegistrations(regs);

  // Increment registeredCount on event
  events[eventIdx].registeredCount += 1;
  saveEvents(events);

  return populateRegistration(newReg);
}

/**
 * DELETE /api/registrations/:id
 * FR-REG-13: block cancellation after check-in
 */
export async function mockCancelRsvp(registrationId) {
  await delay();
  const me = requireAuth();
  const regs = getRegistrations();
  const idx = regs.findIndex((r) => r._id === registrationId);
  if (idx === -1) throw apiError('Registration not found.', 404);
  const reg = regs[idx];

  // Only the registrant or admin can cancel
  if (reg.user !== me._id && me.role !== 'admin') throw apiError('Forbidden.', 403);

  // FR-REG-13: block after check-in
  if (reg.checkedIn) {
    throw apiError('Cannot cancel registration after check-in.', 409);
  }

  const eventId = reg.event?._id || reg.event;
  regs.splice(idx, 1);
  saveRegistrations(regs);

  // Decrement registeredCount
  const events = getEvents();
  const eventIdx = events.findIndex((e) => e._id === eventId);
  if (eventIdx !== -1) {
    events[eventIdx].registeredCount = Math.max(0, events[eventIdx].registeredCount - 1);
    saveEvents(events);
  }

  return { message: 'Registration cancelled successfully.' };
}

/**
 * GET /api/registrations/user/:userId
 * Returns all registrations for a user (populated event + organizer)
 */
export async function mockGetUserRegistrations(userId) {
  await delay(50);
  const me = requireAuth();
  if (me._id !== userId && me.role !== 'admin') throw apiError('Forbidden.', 403);
  const regs = getRegistrations().filter((r) => r.user === userId);
  return regs.map(populateRegistration);
}

/**
 * GET /api/registrations/event/:eventId  (roster)
 * Returns all registrations for an event (organizer/admin only)
 */
export async function mockGetRoster(eventId, params = {}) {
  await delay(50);
  const me = requireRole('organizer', 'admin');
  let regs = getRegistrations().filter(
    (r) => (r.event?._id || r.event) === eventId
  );
  if (params.checkedIn !== undefined) {
    const want = params.checkedIn === 'true' || params.checkedIn === true;
    regs = regs.filter((r) => r.checkedIn === want);
  }
  return regs.map(populateRegistration);
}

/**
 * GET /api/registrations?eventId=xxx  (admin bulk query)
 */
export async function mockGetAllRegistrations(params = {}) {
  await delay(50);
  requireRole('admin', 'organizer');
  let regs = getRegistrations();
  if (params.eventId) {
    regs = regs.filter((r) => (r.event?._id || r.event) === params.eventId);
  }
  return regs.map(populateRegistration);
}

/**
 * PATCH /api/registrations/:id/check-in
 * FR-REG-09 & FR-REG-11: sets checkedIn=true and checkedInAt=now
 */
export async function mockCheckIn(registrationId) {
  await delay();
  requireRole('organizer', 'admin');
  const regs = getRegistrations();
  const idx = regs.findIndex((r) => r._id === registrationId);
  if (idx === -1) throw apiError('Registration not found.', 404);
  if (regs[idx].checkedIn) throw apiError('Attendee is already checked in.', 409);
  regs[idx].checkedIn = true;
  regs[idx].checkedInAt = now();
  saveRegistrations(regs);
  return populateRegistration(regs[idx]);
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS & EXPORT ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/reports/events/:eventId/attendance
 * Returns: { eventId, title, capacity, registered, checkedIn, noShows, attendanceRate }
 */
export async function mockGetAttendance(eventId) {
  await delay(60);
  requireRole('organizer', 'admin');
  const events = getEvents();
  const event = events.find((e) => e._id === eventId);
  if (!event) throw apiError('Event not found.', 404);
  const regs = getRegistrations().filter((r) => (r.event?._id || r.event) === eventId);
  const checkedIn = regs.filter((r) => r.checkedIn).length;
  const registered = regs.length;
  const noShows = registered - checkedIn;
  const attendanceRate = registered > 0 ? Math.round((checkedIn / registered) * 100) : 0;
  return {
    eventId,
    title: event.title,
    capacity: event.capacity,
    registered,
    checkedIn,
    noShows,
    attendanceRate,
  };
}

/** RFC 4180 CSV quoting + formula injection protection (FR-RPT-05/06) */
function csvEscape(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);
  // Formula injection protection (FR-RPT-06): prefix dangerous chars with single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  // RFC 4180 quoting: wrap in double quotes if it contains comma, newline, or double-quote
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Simulates /api/reports/events/:eventId/export?format=csv|json
 * Triggers a real browser file download.
 */
export async function mockExportRegistrants(eventId, format = 'csv') {
  await delay(100);
  requireRole('organizer', 'admin');
  const events = getEvents();
  const event = events.find((e) => e._id === eventId);
  if (!event) throw apiError('Event not found.', 404);

  const regs = getRegistrations()
    .filter((r) => (r.event?._id || r.event) === eventId)
    .map(populateRegistration);

  const safeTitle = event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filename = `${safeTitle}_registrants.${format}`;

  let content, mimeType;

  if (format === 'json') {
    content = JSON.stringify(
      regs.map((r) => ({
        name: r.user?.name || '',
        email: r.user?.email || '',
        registeredAt: r.registeredAt,
        checkedIn: r.checkedIn,
        checkedInAt: r.checkedInAt || '',
      })),
      null,
      2
    );
    mimeType = 'application/json';
  } else {
    // CSV
    const headers = ['Name', 'Email', 'Registered At', 'Checked In', 'Checked In At'];
    const rows = regs.map((r) => [
      csvEscape(r.user?.name || ''),
      csvEscape(r.user?.email || ''),
      csvEscape(r.registeredAt),
      csvEscape(r.checkedIn ? 'Yes' : 'No'),
      csvEscape(r.checkedInAt || ''),
    ]);
    content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    mimeType = 'text/csv';
  }

  // Trigger browser download
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return filename;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN USER MANAGEMENT ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/users?search=&role=&isActive=
 */
export async function mockGetAdminUsers(params = {}) {
  await delay(50);
  requireRole('admin');
  let users = getUsers().map(safeUser);
  if (params.search) {
    const q = params.search.toLowerCase();
    users = users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }
  if (params.role && params.role !== 'all') {
    users = users.filter((u) => u.role === params.role);
  }
  if (params.isActive !== undefined && params.isActive !== '' && params.isActive !== 'all') {
    const want = params.isActive === 'true' || params.isActive === true;
    users = users.filter((u) => u.isActive === want);
  }
  return users;
}

/**
 * PATCH /api/users/:userId/role
 * Body: { role: 'admin' | 'organizer' | 'member' }
 */
export async function mockUpdateUserRole(userId, role) {
  await delay();
  requireRole('admin');
  if (!['admin', 'organizer', 'member'].includes(role)) {
    throw apiError('Invalid role.', 400, { role: 'Must be admin, organizer, or member.' });
  }
  const users = getUsers();
  const idx = users.findIndex((u) => u._id === userId);
  if (idx === -1) throw apiError('User not found.', 404);
  users[idx].role = role;
  saveUsers(users);
  return safeUser(users[idx]);
}

/**
 * DELETE /api/admin/users/:userId
 * FR-USR-09: block if organizer owns active events
 * FR-USR-10: block deletion of last active admin
 */
export async function mockDeleteUser(userId) {
  await delay();
  requireRole('admin');
  const users = getUsers();
  const idx = users.findIndex((u) => u._id === userId);
  if (idx === -1) throw apiError('User not found.', 404);
  const target = users[idx];

  // FR-USR-10: cannot delete last active admin
  if (target.role === 'admin') {
    const activeAdmins = users.filter((u) => u.role === 'admin' && u.isActive);
    if (activeAdmins.length <= 1) {
      throw apiError('Cannot delete the last active administrator.', 409);
    }
  }

  // FR-USR-09: cannot delete organizer who owns events
  if (target.role === 'organizer') {
    const events = getEvents();
    const ownsEvents = events.some(
      (e) => (e.organizer?._id || e.organizer) === userId
    );
    if (ownsEvents) {
      throw apiError(
        'Cannot delete an organizer who owns events. Reassign or delete their events first.',
        409
      );
    }
  }

  users.splice(idx, 1);
  saveUsers(users);
  return { message: 'User deleted successfully.' };
}

/**
 * POST /api/admin/users/:userId/reset-password
 * Body: { newPassword }
 */
export async function mockResetPassword(userId, newPassword) {
  await delay();
  requireRole('admin');
  const users = getUsers();
  const idx = users.findIndex((u) => u._id === userId);
  if (idx === -1) throw apiError('User not found.', 404);
  if (!newPassword || newPassword.length < 8) {
    throw apiError('Password must be at least 8 characters.', 400);
  }
  users[idx].password = hashPassword(newPassword);
  saveUsers(users);
  return { message: 'Password reset successfully.' };
}
