import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const RequireAuth: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-50 text-slate-600" role="status" aria-live="polite">
        <div className="rounded-lg bg-navy-900 p-2.5 text-white">
          <ShieldAlert className="h-5 w-5" aria-hidden />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Restoring your session…
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
};

export const RedirectIfAuthed: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (!isLoading && isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
};
