import { SearchX } from "lucide-react";
import { ErrorPage } from "./ErrorPage";

export function NotFoundPage() {
  return (
    <ErrorPage
      code="404"
      icon={SearchX}
      title="Ops... Essa página não existe."
      description="A página que você tentou acessar não foi encontrada."
    />
  );
}
