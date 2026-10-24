import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppShell from './AppShell';
import { LoadingSkeleton } from './ui/StateViews';

/**
 * Route protection wrapper strictly enforcing authentication and RBAC roles (NFR-USE-04, FR-AUTH-10)
 */
export default function ProtectedRoute({ children, allowedRoles = null }) {
  const { isAuthenticated, loading, role } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <LoadingSkeleton variant="card" count={2} />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check RBAC role permission
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/calendar" replace />;
  }

  return <AppShell>{children}</AppShell>;
}
