import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Breadcrumb } from "../../components/ui/Breadcrumb";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/EmptyState";
import { Surface } from "../../components/ui/Field";
import { PageHeader } from "../../components/ui/PageHeader";
import { HttpError } from "../../lib/http";
import { mediaUrl } from "../../lib/media";
import { photoForSpecies } from "../../lib/pets-art";
import { api } from "../../services/api";
import { PetSettingsFields } from "../app/SettingsPage";

export function ClientPetDetailPage() {
  const { id } = useParams();
  const petId = Number(id);
  const pet = useQuery({
    queryKey: ["pet", petId],
    enabled: Number.isFinite(petId),
    queryFn: () => api.pet(petId),
  });

  if (pet.isLoading) return <LoadingState />;
  if (pet.error) {
    return <ErrorState message={pet.error instanceof HttpError ? pet.error.message : "Pet não encontrado"} />;
  }
  const data = pet.data;
  if (!data) return null;
  const foto = mediaUrl(data.fotoUrl) || photoForSpecies(data.especie, data.id);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ to: "/cliente/pets", label: "Meus pets" }, { label: data.nome }]} />
      <PageHeader
        title={data.nome}
        description={`${data.especie}${data.raca ? ` · ${data.raca}` : ""}`}
        art={foto}
        hideArt={false}
      />
      <Surface>
        <h2 className="mb-4 font-semibold">Perfil do pet</h2>
        <PetSettingsFields petId={data.id} />
      </Surface>
      <Surface>
        <p className="text-sm text-muted">Nascimento</p>
        <p className="font-medium">{data.nascimento ?? "Não informado"}</p>
      </Surface>
      <section>
        <h2 className="font-semibold">Vacinação</h2>
        {!data.vacinacoes.length ? (
          <div className="mt-3"><EmptyState title="Sem doses ainda" description="As aplicações feitas na clínica aparecem automaticamente." /></div>
        ) : (
          <ol className="mt-3 space-y-3">
            {data.vacinacoes.map((item) => {
              const atrasada = item.proxima ? new Date(item.proxima) < new Date() : false;
              return (
                <li key={item.id} className="living-card p-4">
                  <p className="font-medium">{item.vacina}</p>
                  <p className="text-sm text-muted">Aplicada em {item.aplicacao}</p>
                  {item.proxima ? (
                    <p className={`text-sm ${atrasada ? "text-danger" : "text-brand"}`}>
                      {atrasada ? "Dose atrasada" : "Próxima"}: {item.proxima}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>
      <section>
        <h2 className="font-semibold">Atendimentos</h2>
        {!data.atendimentos.length ? (
          <p className="mt-2 text-sm text-muted">Nenhuma visita registrada.</p>
        ) : (
          <ul className="living-card mt-3 divide-y divide-line">
            {data.atendimentos.map((item) => (
              <li key={item.id} className="px-4 py-3">
                <p className="font-medium">{item.titulo}</p>
                <p className="text-sm text-muted">{item.quando?.slice(0, 10)}{item.detalhe ? ` · ${item.detalhe}` : ""}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
