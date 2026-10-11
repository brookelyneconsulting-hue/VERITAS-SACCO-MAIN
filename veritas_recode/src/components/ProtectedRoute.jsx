import { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isPlatformAdmin } from '@/lib/roles';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const { user, isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth } = useAuth();

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    return unauthenticatedElement;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  // Gate: pending or rejected (non-platform-admin) users cannot access admin pages
  if (user && !isPlatformAdmin(user) && (user.account_status === "pending" || user.account_status === "rejected")) {
    return <Navigate to="/pending-approval" replace />;
  }

  return <Outlet />;
}