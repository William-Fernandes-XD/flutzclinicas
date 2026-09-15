import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Breadcrumb } from "../../components/ui/Breadcrumb";
import { ErrorState, LoadingState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { HttpError } from "../../lib/http";
import { mediaUrl } from "../../lib/media";
import { photoForSpecies } from "../../lib/pets-art";
import { api } from "../../services/api";

export function PetDetailPage() {
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
    <div className="space-y-8">
      <Breadcrumb items={[{ to: "/app/consulta-pets", label: "Consulta de pets" }, { label: data.nome }]} />
      <PageHeader
        eyebrow="Prontuário"
        title={data.nome}
        description={`${data.especie}${data.raca ? ` · ${data.raca}` : ""} · Tutor ${data.tutor}`}
        art={foto}
        hideArt={false}
      />
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Info label="Sexo" value={data.sexo === "M" ? "Macho" : data.sexo === "F" ? "Fêmea" : "Indefinido"} />
        <Info label="Nascimento" value={data.nascimento ?? "Não informado"} />
        <Info label="Peso" value={data.peso != null ? `${data.peso} kg` : "Não informado"} />
      </section>
      <Block
        title="Vacinação"
        empty="Nenhuma aplicação registrada para este pet."
        count={data.vacinacoes.length}
      >
        {data.vacinacoes.map((item) => (
          <li key={item.id} className="py-3">
            <p className="font-medium">{item.vacina}</p>
            <p className="text-sm text-muted">
              Aplicada em {item.aplicacao}
              {item.proxima ? ` · próxima ${item.proxima}` : ""}
            </p>
          </li>
        ))}
      </Block>
      <Block title="Doenças" empty="Nenhum diagnóstico no prontuário." count={data.doencas.length}>
        {data.doencas.map((item) => (
          <li key={item.id} className="py-3">
            <p className="font-medium">{item.titulo}</p>
            <p className="text-sm text-muted">{item.quando}{item.detalhe ? ` · ${item.detalhe}` : ""}</p>
          </li>
        ))}
      </Block>
      <Block title="Atendimentos" empty="Nenhuma visita registrada." count={data.atendimentos.length}>
        {data.atendimentos.map((item) => (
          <li key={item.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{item.titulo}</p>
              <Badge>{item.quando?.slice(0, 10) ?? "—"}</Badge>
            </div>
            {item.detalhe ? <p className="text-sm text-muted">{item.detalhe}</p> : null}
          </li>
        ))}
      </Block>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="living-card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function Block({
  title,
  empty,
  count,
  children,
}: {
  title: string;
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="living-card p-5">
      <h2 className="font-semibold">{title}</h2>
      {count === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line dark:divide-zinc-800">{children}</ul>
      )}
    </section>
  );
}
