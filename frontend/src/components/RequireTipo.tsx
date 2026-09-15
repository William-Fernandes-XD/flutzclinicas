import { Navigate } from "react-router-dom";
import type { Session } from "../lib/session";
import { homeFor } from "../lib/session";
import { useAuth } from "../providers/AuthProvider";

export function RequireTipo({
  tipos,
  children,
}: {
  tipos: Session["tipo"][];
  children: React.ReactNode;
}) {
  const { session, loading } = useAuth();

  if (loading) return null;
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (!tipos.includes(session.tipo)) {
    return <Navigate to={homeFor(session)} replace />;
  }
  return children;
}
