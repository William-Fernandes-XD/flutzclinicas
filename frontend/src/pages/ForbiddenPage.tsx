import { ShieldOff } from "lucide-react";
import { ErrorPage } from "./ErrorPage";

export function ForbiddenPage() {
  return (
    <ErrorPage
      code="403"
      icon={ShieldOff}
      title="Você não tem permissão para acessar esta página."
      description="Sua conta não possui autorização para acessar este recurso. Isso é diferente de não estar autenticado."
      showHome
    />
  );
}
