# OrgaVents UI Handoff

> Standalone frontend for OrgaVents — runs fully in **Mock Mode** (no server required) or connects to the **Live Backend** with a single `.env` change.

## Quick Start (Mock Mode — No Server Needed)

```bash
npm install
npm run dev
# → http://localhost:5173
```

Use the **⚡ Instant Demo Login** buttons on the login page:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@orgavents.edu` | `Password123!` |
| Organizer | `organizer@campus.edu` | `Password123!` |
| Member | `member@campus.edu` | `Password123!` |

> **Reset Demo Data**: Click the "Reset Demo Data" button (bottom-right corner) to wipe `localStorage` back to seed state.

## Switch to Live Backend

Needs Node 20+ and a MongoDB (local `mongod`, Docker, or Atlas).

```bash
npm install
cp .env.example .env        # then edit .env (see below)
npm run seed                # admin account only
npm run seed:demo           # optional: demo users/events/registrations (dev only, idempotent)
npm run server:dev          # API on http://localhost:5000
npm run dev                 # UI on http://localhost:5173 (second terminal)
```

In `.env`: set `VITE_USE_MOCK=false`, point `MONGO_URI` at your database, and generate a `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Seeded accounts all use `Password123!` (admin: `admin@orgavents.edu`). Health check: `GET /api`.

## Project Structure

```
src/
├── pages/           # All UI screens (LoginPage, EventCalendarPage, etc.)
├── components/      # Shared UI components (AppShell, ConfirmModal, etc.)
├── context/         # AuthContext (auth state, login/logout/register)
└── services/
    ├── api.js           # Dual-mode API client (Mock ↔ Live)
    └── mockBackend.js   # Full localStorage mock implementation
server/              # Express + Mongoose API (config, middleware, models, controllers, routes, scripts)
```

## Backend Integration

See **[BACKEND_INTEGRATION_GUIDE.md](./BACKEND_INTEGRATION_GUIDE.md)** for:
- Required server folder architecture
- Mongoose schemas with exact fields and indexes
- Screen-by-screen API contract (endpoint, method, request/response JSON)
- Standard error format
- 10-point integration testing checklist
