import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, matchPath } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastProvider } from './components/ui/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import { LoadingSkeleton } from './components/ui/StateViews';

// Pages (login is eager as the entry point; the rest are split per route)
import LoginPage from './pages/LoginPage';
const pageLoaders = {
  SignUpPage: () => import('./pages/SignUpPage'),
  ProfilePage: () => import('./pages/ProfilePage'),
  CalendarPage: () => import('./pages/CalendarPage'),
  MyRegistrationsPage: () => import('./pages/MyRegistrationsPage'),
  OrganizerDashboardPage: () => import('./pages/OrganizerDashboardPage'),
  ReportsPage: () => import('./pages/ReportsPage'),
  EventFormPage: () => import('./pages/EventFormPage'),
  RosterCheckInPage: () => import('./pages/RosterCheckInPage'),
  AdminUsersPage: () => import('./pages/AdminUsersPage'),
  AdminEventsPage: () => import('./pages/AdminEventsPage'),
  AdminVenuesPage: () => import('./pages/AdminVenuesPage'),
  EventDetailsPage: () => import('./pages/EventDetailsPage'),
  NotFoundPage: () => import('./pages/NotFoundPage'),
};
const SignUpPage = lazy(pageLoaders.SignUpPage);
const ProfilePage = lazy(pageLoaders.ProfilePage);
const CalendarPage = lazy(pageLoaders.CalendarPage);
const MyRegistrationsPage = lazy(pageLoaders.MyRegistrationsPage);
const OrganizerDashboardPage = lazy(pageLoaders.OrganizerDashboardPage);
const ReportsPage = lazy(pageLoaders.ReportsPage);
const EventFormPage = lazy(pageLoaders.EventFormPage);
const RosterCheckInPage = lazy(pageLoaders.RosterCheckInPage);
const AdminUsersPage = lazy(pageLoaders.AdminUsersPage);
const AdminEventsPage = lazy(pageLoaders.AdminEventsPage);
const AdminVenuesPage = lazy(pageLoaders.AdminVenuesPage);
const EventDetailsPage = lazy(pageLoaders.EventDetailsPage);
const NotFoundPage = lazy(pageLoaders.NotFoundPage);

/** Fetch every page's code in the background once the app is idle, so first visits open instantly. */
function usePrefetchPages() {
  useEffect(() => {
    const prefetch = () => Object.values(pageLoaders).forEach((load) => load().catch(() => {}));
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(prefetch, 2000);
    return () => clearTimeout(t);
  }, []);
}

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
  ['/admin/venues', 'Venues'],
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
  usePrefetchPages();

  return (
    <ErrorBoundary>
    <ThemeProvider>
    <AuthProvider>
      <ToastProvider>
      <BrowserRouter future={{ v7_startTransition: true }}>
        <TitleManager />
        <Suspense
          fallback={
            <div className="min-h-screen bg-canvas p-8 max-w-5xl mx-auto">
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

          <Route
            path="/admin/venues"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminVenuesPage />
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
    </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
