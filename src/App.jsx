import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, matchPath } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastProvider } from './components/ui/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import { LoadingSkeleton } from './components/ui/StateViews';

// Pages (login is eager as the entry point; the rest are split per route)
import LoginPage from './pages/LoginPage';
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const MyRegistrationsPage = lazy(() => import('./pages/MyRegistrationsPage'));
const OrganizerDashboardPage = lazy(() => import('./pages/OrganizerDashboardPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const EventFormPage = lazy(() => import('./pages/EventFormPage'));
const RosterCheckInPage = lazy(() => import('./pages/RosterCheckInPage'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const AdminEventsPage = lazy(() => import('./pages/AdminEventsPage'));
const EventDetailsPage = lazy(() => import('./pages/EventDetailsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const ROUTE_TITLES = [
  ['/login', 'Sign in'],
  ['/signup', 'Create account'],
  ['/calendar', 'Calendar'],
  ['/events/new', 'New event'],
  ['/events/:id/edit', 'Edit event'],
  ['/events/:id/roster', 'Check-in roster'],
  ['/events/:id', 'Event details'],
  ['/profile', 'Profile'],
  ['/my-registrations', 'My registrations'],
  ['/organizer', 'Organizer dashboard'],
  ['/reports', 'Reports'],
  ['/admin/users', 'Users'],
  ['/admin/events', 'All events'],
];

/** Keeps the tab/history title in step with the route (screen readers announce it on navigation). */
function TitleManager() {
  const { pathname } = useLocation();
  useEffect(() => {
    const match = ROUTE_TITLES.find(([pattern]) => matchPath(pattern, pathname));
    document.title = match ? `${match[1]} · OrgaVents` : 'Page not found · OrgaVents';
  }, [pathname]);
  return null;
}

function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <ToastProvider>
      <BrowserRouter>
        <TitleManager />
        <Suspense
          fallback={
            <div className="min-h-screen bg-[#F5F7F9] p-8 max-w-5xl mx-auto">
              <LoadingSkeleton variant="card" count={2} />
            </div>
          }
        >
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />

          {/* Protected Routes (Role-Aware AppShell layout automatically attached) */}
          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <CalendarPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/events/:id"
            element={
              <ProtectedRoute>
                <EventDetailsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/my-registrations"
            element={
              <ProtectedRoute allowedRoles={['member', 'admin']}>
                <MyRegistrationsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/organizer"
            element={
              <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                <OrganizerDashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/events/new"
            element={
              <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                <EventFormPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/events/:id/edit"
            element={
              <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                <EventFormPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/events/:id/roster"
            element={
              <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                <RosterCheckInPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports"
            element={
              <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                <ReportsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminUsersPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/events"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminEventsPage />
              </ProtectedRoute>
            }
          />

          {/* Root and Fallback redirection */}
          <Route path="/" element={<Navigate to="/calendar" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
