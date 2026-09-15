import { Navigate } from "react-router-dom";
import { homeFor, isClinicAdmin, isPlatformAdmin } from "../lib/session";
import { useAuth } from "../providers/AuthProvider";

export function RequireClinicAdmin({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (isPlatformAdmin(session) || isClinicAdmin(session)) {
    return children;
  }
  return <Navigate to={homeFor(session)} replace />;
}
