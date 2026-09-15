import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { EmptyState, LoadingState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { useAuth } from "../../providers/AuthProvider";
import { useClinicBrand } from "../../providers/ClinicContext";
import { api } from "../../services/api";

export function ClientClinicContextPage() {
  const { session } = useAuth();
  const clinic = useClinicBrand();
  const page = useQuery({
    queryKey: ["public-clinic", clinic?.slug],
    enabled: Boolean(clinic?.slug),
    queryFn: () => api.publicClinic(clinic!.slug),
  });

  if (!session?.empresaId) {
    return <Navigate to="/cliente/clinicas" replace />;
  }
  if (!clinic || page.isLoading) {
    return <LoadingState label="Abrindo a clínica…" />;
  }

  const data = page.data;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Clínica selecionada"
        title={clinic.nome}
        description={[clinic.cidade, clinic.uf].filter(Boolean).join(" · ") || "Informações desta clínica, sem o painel interno da equipe."}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button to="/cliente/agenda">Agenda</Button>
            <Button to="/cliente/pets" variant="secondary">Pets</Button>
            {clinic.slug ? (
              <Button href={`/clinica/${clinic.slug}`} target="_blank" rel="noreferrer" variant="secondary">
                Página pública
              </Button>
            ) : null}
          </div>
        }
      />
      {clinic.sobre ? <p className="max-w-3xl leading-relaxed text-muted">{clinic.sobre}</p> : null}
      <section>
        <h2 className="font-semibold">Serviços</h2>
        {!data?.servicos.length ? (
          <div className="mt-3">
            <EmptyState title="Serviços ainda não publicados" description="A clínica publica a oferta na página pública." />
          </div>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.servicos.map((item) => (
              <li key={item.id} className="living-card px-4 py-3">
                {item.nome}
              </li>
            ))}
          </ul>
        )}
      </section>
      {data?.especialidades.length ? (
        <section>
          <h2 className="font-semibold">Especialidades</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {data.especialidades.map((item) => (
              <li key={item} className="rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand">
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section>
        <h2 className="font-semibold">Equipe visível</h2>
        {!data?.equipe.length ? (
          <p className="mt-2 text-sm text-muted">Nenhum colaborador autorizado a aparecer publicamente.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.equipe.map((membro) => (
              <li key={membro.nome} className="living-card px-4 py-3">
                <p>{membro.nome}</p>
                {membro.cargo ? <p className="text-sm text-muted">{membro.cargo}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
