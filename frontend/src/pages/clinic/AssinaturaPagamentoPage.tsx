import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LoadingState } from "../../components/ui/EmptyState";

/** Compatibilidade: abre o modal padrão na página de mensalidade. */
export function AssinaturaPagamentoPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/app/assinatura?pagar=1", { replace: true });
  }, [navigate]);

  return <LoadingState label="Abrindo pagamento…" />;
}
