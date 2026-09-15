import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ErrorState, LoadingState } from "../../components/ui/EmptyState";
import { useAuth } from "../../providers/AuthProvider";

export function AdminEnterClinicPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setClinic } = useAuth();
  const empresaId = Number(id);

  useEffect(() => {
    if (!Number.isFinite(empresaId)) {
      navigate("/admin/clinicas", { replace: true });
      return;
    }
    let cancelled = false;
    void setClinic(empresaId)
      .then(() => {
        if (!cancelled) navigate("/app", { replace: true });
      })
      .catch(() => {
        if (!cancelled) navigate("/admin/clinicas", { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [empresaId, navigate, setClinic]);

  if (!Number.isFinite(empresaId)) {
    return <ErrorState message="Clínica inválida." />;
  }
  return <LoadingState label="Entrando na clínica…" />;
}
