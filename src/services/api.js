/**
 * OrgaVents API Client Service — Dual-Mode (Mock + Live)
 * ═══════════════════════════════════════════════════════
 * Controlled by VITE_USE_MOCK in .env:
 *   VITE_USE_MOCK=true  → All calls routed to mockBackend.js (no server needed)
 *   VITE_USE_MOCK=false → All calls routed to VITE_API_URL via fetch with Bearer token
 *
 * NFR-MNT-01, FR-AUTH-07, FR-AUTH-09, FR-AUTH-12
 */

// ─── Mock imports (tree-shaken away in production when VITE_USE_MOCK=false) ──
import * as mock from './mockBackend.js';

// ─── Mode detection ───────────────────────────────────────────────────────────
const USE_MOCK =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_MOCK === 'true') ||
  false;

/** True when the app runs on mockBackend.js; live-only screens use it to explain themselves. */
export const isMockMode = USE_MOCK;

const API_BASE_URL =
  (typeof import.meta !== 'undefined' &&
    (import.meta.env?.VITE_API_URL || import.meta.env?.VITE_API_BASE_URL)) ||
  'http://localhost:5000/api';

// Initialise the mock DB on first import (no-op if already seeded)
if (USE_MOCK) {
  mock.initMockDB();
}

// ─── Live HTTP layer ──────────────────────────────────────────────────────────

// Callback registered by AuthContext to clear session on 401/403
let onSessionExpiredCallback = null;

export function registerSessionExpiredHandler(callback) {
  onSessionExpiredCallback = callback;
}

/**
 * Perform an authenticated or public fetch to the OrgaVents API (live mode).
 * @param {string} endpoint  - e.g. '/users/login'
 * @param {RequestInit} [options={}]
 * @returns {Promise<any>}
 */
export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (networkErr) {
    const error = new Error('Network error. Unable to reach the server.');
    error.status = 0;
    throw error;
  }

  let data = {};
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = {};
    }
  }

  // Intercept a dead session mid-session (FR-AUTH-09). Only the API's explicit auth codes
  // count: a plain 401/403 (wrong current password, "organizers can't RSVP", ...) is an
  // ordinary refusal and must not sign the user out.
  const isAuthEndpoint =
    endpoint.includes('/users/login') || endpoint.includes('/users/register');
  if (token && !isAuthEndpoint && typeof onSessionExpiredCallback === 'function') {
    if (data.code === 'ACCOUNT_DEACTIVATED') {
      onSessionExpiredCallback('Your account has been deactivated. Please contact an administrator.');
    } else if (data.code === 'SESSION_EXPIRED') {
      onSessionExpiredCallback('Your session has expired. Please sign in again to continue.');
    }
  }

  if (!response.ok) {
    const error = new Error(data.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.errors = data.errors || {};
    if (data.code) error.code = data.code;           // e.g. VENUE_CLASH / ORGANIZER_OVERLAP
    if (data.conflict) error.conflict = data.conflict; // the event that clashes
    throw error;
  }

  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH & USER API
// ─────────────────────────────────────────────────────────────────────────────

export const authAPI = {
  /**
   * POST /api/users/login
   * Body:    { email: string, password: string }
   * Returns: { token: string, user: { _id, name, email, role, isActive } }
   */
  login: (email, password) =>
    USE_MOCK
      ? mock.mockLogin(email, password)
      : apiRequest('/users/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        }),

  /**
   * POST /api/users/register
   * Body:    { name: string, email: string, password: string }
   * Returns: { message: string, user: { _id, name, email, role, isActive } }
   * Note:    role is ALWAYS 'member' (FR-AUTH-02)
   */
  register: (userData) =>
    USE_MOCK
      ? mock.mockRegister(userData)
      : apiRequest('/users/register', {
          method: 'POST',
          body: JSON.stringify(userData),
        }),

  /**
   * GET /api/users/:userId
   * Returns: { _id, name, email, role, isActive, createdAt }
   */
  getUserProfile: (userId) =>
    USE_MOCK
      ? mock.mockGetUserProfile(userId)
      : apiRequest(`/users/${userId}`),

  /**
   * PUT /api/users/:userId
   * Body:    { name?, email?, password?, isActive? }  (isActive admin-only)
   * Returns: { _id, name, email, role, isActive }
   */
  updateUserProfile: (userId, updates) =>
    USE_MOCK
      ? mock.mockUpdateUserProfile(userId, updates)
      : apiRequest(`/users/${userId}`, {
          method: 'PUT',
          body: JSON.stringify(updates),
        }),

  /**
   * PUT /api/users/:userId/avatar   Body: { image: 'data:image/webp;base64,...' } (<=200KB)
   * Returns: public user (with avatarUpdatedAt). Own account only. Live backend only.
   */
  setAvatar: (userId, image) =>
    USE_MOCK
      ? Promise.reject(mockUnsupported('Profile pictures'))
      : apiRequest(`/users/${userId}/avatar`, {
          method: 'PUT',
          body: JSON.stringify({ image }),
        }),

  /** DELETE /api/users/:userId/avatar — Returns: public user */
  removeAvatar: (userId) =>
    USE_MOCK
      ? Promise.reject(mockUnsupported('Profile pictures'))
      : apiRequest(`/users/${userId}/avatar`, { method: 'DELETE' }),
};

/** Public URL of a user's profile picture (loads through <img>, no token). `version` busts the cache. */
export const avatarUrl = (userId, version) =>
  USE_MOCK || !userId || !version
    ? null
    : `${API_BASE_URL}/users/${userId}/avatar?v=${encodeURIComponent(new Date(version).getTime())}`;

/** Features that only exist on the live backend reject with this in mock mode. */
function mockUnsupported(feature) {
  const error = new Error(`${feature} are not available in mock mode.`);
  error.status = 501;
  return error;
}

// ─────────────────────────────────────────────────────────────────────────────
// VENUES API
// ─────────────────────────────────────────────────────────────────────────────

export const venuesAPI = {
  /**
   * GET /api/venues            → bookable (active) venues, for the event form
   * GET /api/venues?all=1      → admin only: every venue with `eventCount`
   * Venue: { _id, name, capacity|null, description, isActive, eventCount? }
   * Mock mode: read-only list built from the venue names already on mock events.
   */
  getAll: async ({ all = false } = {}) => {
    if (USE_MOCK) {
      const events = await mock.mockGetEvents({});
      const names = [...new Set(events.map((e) => e.venue).filter(Boolean))].sort();
      return names.map((name) => ({ _id: name, name, capacity: null, description: '', isActive: true }));
    }
    return apiRequest(`/venues${all ? '?all=1' : ''}`);
  },

  /** POST /api/admin/venues  Body: { name, capacity?, description? } */
  create: (venue) =>
    USE_MOCK
      ? Promise.reject(mockUnsupported('Venue management'))
      : apiRequest('/admin/venues', { method: 'POST', body: JSON.stringify(venue) }),

  /** PUT /api/admin/venues/:id  Body: any of { name, capacity, description, isActive } */
  update: (id, updates) =>
    USE_MOCK
      ? Promise.reject(mockUnsupported('Venue management'))
      : apiRequest(`/admin/venues/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),

  /** DELETE /api/admin/venues/:id — 409 while events use it */
  delete: (id) =>
    USE_MOCK
      ? Promise.reject(mockUnsupported('Venue management'))
      : apiRequest(`/admin/venues/${id}`, { method: 'DELETE' }),
};

// ─────────────────────────────────────────────────────────────────────────────
// EVENTS API
// ─────────────────────────────────────────────────────────────────────────────

export const eventsAPI = {
  /**
   * GET /api/events?from=ISO&to=ISO&organizer=userId
   * Returns: Event[]  (organizer field populated: { _id, name, email })
   * Event shape: { _id, title, description, date, venue, capacity, registeredCount, organizer }
   */
  getAll: (params = {}) =>
    USE_MOCK
      ? mock.mockGetEvents(params)
      : apiRequest(`/events${_qs(params)}`),

  /**
   * GET /api/admin/events?from=ISO&to=ISO&organizer=userId
   * Admin/Organizer only — returns ALL events.
   * Returns: Event[]
   */
  getAdminAll: (params = {}) =>
    USE_MOCK
      ? mock.mockGetAdminEvents(params)
      : apiRequest(`/admin/events${_qs(params)}`),

  /**
   * GET /api/events/:id
   * Returns: Event (fully populated)
   */
  getById: (id) =>
    USE_MOCK
      ? mock.mockGetEventById(id)
      : apiRequest(`/events/${id}`),

  /**
   * POST /api/events
   * Body:    { title, description, date: ISO, endDate: ISO, venueId, capacity: number, allowOverlap? }
   * Returns: Event
   * Auth:    organizer | admin
   * 409 + code VENUE_CLASH (blocked) / ORGANIZER_OVERLAP (retry with allowOverlap: true); error.conflict = the other event
   * (Mock mode ignores venueId/endDate and uses the plain `venue` name.)
   */
  create: (eventData) =>
    USE_MOCK
      ? mock.mockCreateEvent(eventData)
      : apiRequest('/events', {
          method: 'POST',
          body: JSON.stringify(eventData),
        }),

  /**
   * PUT /api/events/:id
   * Body:    { title?, description?, date?, endDate?, venueId?, capacity?, allowOverlap? }
   * Returns: Event
   * Note:    409 if capacity < registeredCount (FR-EVT-09), or VENUE_CLASH / ORGANIZER_OVERLAP as on create
   */
  update: (id, eventData) =>
    USE_MOCK
      ? mock.mockUpdateEvent(id, eventData)
      : apiRequest(`/events/${id}`, {
          method: 'PUT',
          body: JSON.stringify(eventData),
        }),

  /**
   * DELETE /api/events/:id
   * Returns: { message: string }
   * Auth:    owner organizer | admin
   */
  delete: (id) =>
    USE_MOCK
      ? mock.mockDeleteEvent(id)
      : apiRequest(`/events/${id}`, { method: 'DELETE' }),
};

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRATIONS API
// ─────────────────────────────────────────────────────────────────────────────

export const registrationsAPI = {
  /**
   * POST /api/registrations
   * Body:    { eventId: string }
   * Returns: Registration (populated)
   * Errors:  409 "Event is full" | 409 "Event already started" | 409 "Already registered"
   */
  rsvp: (eventId) =>
    USE_MOCK
      ? mock.mockRsvp(eventId)
      : apiRequest('/registrations', {
          method: 'POST',
          body: JSON.stringify({ eventId }),
        }),

  /**
   * DELETE /api/registrations/:registrationId
   * Returns: { message: string }
   * Errors:  409 "Cannot cancel after check-in" (FR-REG-13)
   */
  cancelRsvp: (registrationId) =>
    USE_MOCK
      ? mock.mockCancelRsvp(registrationId)
      : apiRequest(`/registrations/${registrationId}`, { method: 'DELETE' }),

  /**
   * GET /api/registrations/user/:userId
   * Returns: Registration[] — each with event: { _id, title, date, venue, organizer }
   */
  getUserRegistrations: (userId) =>
    USE_MOCK
      ? mock.mockGetUserRegistrations(userId)
      : apiRequest(`/registrations/user/${userId}`),

  /**
   * GET /api/registrations?eventId=xxx
   * Admin/Organizer bulk query.
   * Returns: Registration[]
   */
  getAll: (params = {}) =>
    USE_MOCK
      ? mock.mockGetAllRegistrations(params)
      : apiRequest(`/registrations${_qs(params)}`),

  /**
   * GET /api/registrations/event/:eventId?checkedIn=true|false
   * Returns the attendance roster for an event.
   * Returns: Registration[] (each with populated user: { _id, name, email })
   * Auth:    organizer | admin
   */
  getRoster: (eventId, params = {}) =>
    USE_MOCK
      ? mock.mockGetRoster(eventId, params)
      : apiRequest(`/registrations/event/${eventId}${_qs(params)}`),

  /**
   * PATCH /api/registrations/:registrationId/check-in
   * Returns: Registration with checkedIn=true and checkedInAt=ISO timestamp (FR-REG-09/11)
   * Auth:    organizer | admin
   */
  checkIn: (registrationId) =>
    USE_MOCK
      ? mock.mockCheckIn(registrationId)
      : apiRequest(`/registrations/${registrationId}/check-in`, { method: 'PATCH' }),
};

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS & EXPORT API
// ─────────────────────────────────────────────────────────────────────────────

export const reportsAPI = {
  /**
   * GET /api/reports/events/:eventId/attendance
   * Returns: {
   *   eventId: string,
   *   title: string,
   *   capacity: number,
   *   registered: number,
   *   checkedIn: number,
   *   noShows: number,
   *   attendanceRate: number  // 0-100 percentage
   * }
   * Auth: organizer | admin
   */
  getAttendance: (eventId) =>
    USE_MOCK
      ? mock.mockGetAttendance(eventId)
      : apiRequest(`/reports/events/${eventId}/attendance`),

  /**
   * GET /api/reports/events/:eventId/export?format=csv|json
   * Triggers a browser file download.
   * CSV: RFC 4180 quoted, formula-injection protected (FR-RPT-05/06)
   * Returns: filename string
   * Auth: organizer | admin
   */
  exportRegistrants: async (eventId, format = 'csv') => {
    if (USE_MOCK) {
      return mock.mockExportRegistrants(eventId, format);
    }

    // Live mode — streamed download
    const token = localStorage.getItem('token');
    const url = `${API_BASE_URL}/reports/events/${eventId}/export?format=${format}`;
    const response = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Export failed');
    }
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition');
    let filename = `event_${eventId}_registrants.${format}`;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) filename = match[1];
    }
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
    return filename;
  },

  /**
   * Returns a CSV export URL for browser <a href> usage (live mode only).
   * In mock mode, use exportRegistrants() instead.
   */
  getRegistrationsCsvUrl: (eventId) => {
    const token = localStorage.getItem('token');
    return `${API_BASE_URL}/reports/events/${eventId}/export?format=csv&token=${token || ''}`;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN USER MANAGEMENT API
// ─────────────────────────────────────────────────────────────────────────────

export const adminAPI = {
  /**
   * GET /api/admin/users?search=&role=admin|organizer|member|all&isActive=true|false|all
   * Returns: User[] (no passwords)
   * Auth: admin
   */
  getUsers: (params = {}) =>
    USE_MOCK
      ? mock.mockGetAdminUsers(params)
      : apiRequest(`/admin/users${_qs(params)}`),

  /**
   * POST /api/admin/users  (admin creates user with a role)
   * Body:    { name, email, password, role? }
   * Returns: { message, user }
   * Auth:    admin
   */
  createUser: (userData) =>
    USE_MOCK
      ? mock.mockAdminCreateUser(userData)
      : apiRequest('/admin/users', {
          method: 'POST',
          body: JSON.stringify(userData),
        }),

  /**
   * PUT /api/users/:userId
   * Body:    { name?, email?, isActive? }
   * Returns: User
   */
  updateUser: (userId, userData) =>
    USE_MOCK
      ? mock.mockUpdateUserProfile(userId, userData)
      : apiRequest(`/users/${userId}`, {
          method: 'PUT',
          body: JSON.stringify(userData),
        }),

  /**
   * PATCH /api/users/:userId/role
   * Body:    { role: 'admin' | 'organizer' | 'member' }
   * Returns: User
   * Auth:    admin
   */
  updateRole: (userId, role) =>
    USE_MOCK
      ? mock.mockUpdateUserRole(userId, role)
      : apiRequest(`/users/${userId}/role`, {
          method: 'PATCH',
          body: JSON.stringify({ role }),
        }),

  /**
   * PUT /api/users/:userId  (toggle isActive)
   * Body:    { isActive: boolean }
   * Returns: User
   * Auth:    admin
   */
  updateStatus: (userId, isActive) =>
    USE_MOCK
      ? mock.mockUpdateUserProfile(userId, { isActive })
      : apiRequest(`/users/${userId}`, {
          method: 'PUT',
          body: JSON.stringify({ isActive }),
        }),

  /**
   * DELETE /api/admin/users/:userId
   * Returns: { message: string }
   * Errors:
   *   409 – Organizer owns events (FR-USR-09)
   *   409 – Last active admin (FR-USR-10)
   * Auth:    admin
   */
  deleteUser: (userId) =>
    USE_MOCK
      ? mock.mockDeleteUser(userId)
      : apiRequest(`/admin/users/${userId}`, { method: 'DELETE' }),

  /**
   * GET /api/admin/events?from=ISO&to=ISO&organizer=userId
   * Returns: Event[] — admin view of all events
   */
  getEvents: (params = {}) =>
    USE_MOCK
      ? mock.mockGetAdminEvents(params)
      : apiRequest(`/admin/events${_qs(params)}`),

  /**
   * DELETE /api/admin/events/:eventId
   * Returns: { message: string }
   * Auth:    admin
   */
  deleteEvent: (eventId) =>
    USE_MOCK
      ? mock.mockDeleteEvent(eventId)
      : apiRequest(`/admin/events/${eventId}`, { method: 'DELETE' }),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a query string from a params object (omits empty values) */
function _qs(params) {
  const q = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
  ).toString();
  return q ? `?${q}` : '';
}

// ─── Default export (convenience) ─────────────────────────────────────────────
export default {
  USE_MOCK,
  API_BASE_URL,
  apiRequest,
  registerSessionExpiredHandler,
  authAPI,
  eventsAPI,
  registrationsAPI,
  reportsAPI,
  adminAPI,
};
