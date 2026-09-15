import { Navigate } from "react-router-dom";
import { homeFor } from "../lib/session";
import { useAuth } from "../providers/AuthProvider";

export function RequireClinic({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (session.tipo === "CLIENTE") {
    return <Navigate to="/cliente" replace />;
  }
  if (session.tipo === "ADMINISTRADOR_SISTEMA" && !session.empresaId) {
    return <Navigate to="/admin" replace />;
  }
  if (session.tipo === "COLABORADOR" || session.empresaId) {
    return children;
  }
  return <Navigate to={homeFor(session)} replace />;
}
