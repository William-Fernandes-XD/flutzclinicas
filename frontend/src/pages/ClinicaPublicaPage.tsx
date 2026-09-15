import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { ClinicaPublicaView } from "../components/clinic/ClinicaPublicaView";
import { PublicClinicShell } from "../components/layout/PublicClinicShell";
import { ErrorState, LoadingState } from "../components/ui/EmptyState";
import { HttpError } from "../lib/http";
import { api } from "../services/api";

export function ClinicaPublicaPage() {
  const { slug } = useParams();
  const page = useQuery({
    queryKey: ["public-clinic", slug],
    enabled: Boolean(slug),
    queryFn: () => api.publicClinic(slug!),
    retry: false,
  });

  useEffect(() => {
    if (!page.data) return;
    document.title = `${page.data.clinica.nome} | Clínica veterinária`;
    const description = page.data.clinica.sobre || `Página oficial de ${page.data.clinica.nome}`;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description);
  }, [page.data]);

  if (page.isLoading) {
    return (
      <PublicClinicShell>
        <div className="min-h-svh bg-white px-4 py-16">
          <LoadingState label="Carregando a clínica…" />
        </div>
      </PublicClinicShell>
    );
  }
  if (page.error instanceof HttpError && page.error.status === 404) {
    return (
      <PublicClinicShell>
        <div className="min-h-svh bg-white px-4 py-16">
          <ErrorState message="Clínica não encontrada." />
        </div>
      </PublicClinicShell>
    );
  }
  if (!page.data) {
    return (
      <PublicClinicShell>
        <div className="min-h-svh bg-white px-4 py-16">
          <ErrorState message="Não foi possível abrir esta clínica." />
        </div>
      </PublicClinicShell>
    );
  }

  return (
    <PublicClinicShell>
      <ClinicaPublicaView data={page.data} />
    </PublicClinicShell>
  );
}
