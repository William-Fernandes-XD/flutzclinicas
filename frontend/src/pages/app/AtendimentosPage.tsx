import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AtendimentosPorPetPanel,
  fromAgendaSolicitacao,
  type AtendimentoItem,
} from "../../components/clinic/AtendimentosPorPetPanel";
import { WalkInRegistroModal } from "../../components/clinic/WalkInRegistroModal";
import { Button } from "../../components/ui/Button";
import { EmptyState, LoadingState } from "../../components/ui/EmptyState";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { PageHeader } from "../../components/ui/PageHeader";
import { statusAgenda } from "../../lib/agenda";
import { http } from "../../lib/http";
import { api } from "../../services/api";

type AtendimentoApi = {
  id: number;
  petId: number;
  pet: string;
  especie?: string | null;
  tutor: string;
  status: string;
  resumo: string | null;
  fotoUrl?: string | null;
  clinica?: string | null;
  veterinario?: string | null;
  dataInicio?: string | null;
};

function fromAtendimentoClinico(item: AtendimentoApi): AtendimentoItem {
  const statusLower = (item.status || "").toLowerCase();
  const concluido = statusLower.includes("conclu");
  return {
    id: item.id + 1_000_000_000,
    petId: item.petId,
    pet: item.pet,
    especie: item.especie,
    fotoUrl: item.fotoUrl,
    tutor: item.tutor,
    clinica: item.clinica || "",
    profissional: item.veterinario ?? null,
    statusCodigo: concluido ? "CONCLUIDO" : "EM_ANDAMENTO",
    status: item.status,
    tipo: "Atendimento",
    resumo: item.resumo,
    quando: item.dataInicio || new Date().toISOString(),
  };
}

export function AtendimentosPage() {
  const queryClient = useQueryClient();
  const [walkInOpen, setWalkInOpen] = useState(false);
  const agenda = useQuery({ queryKey: ["agenda-solicitacoes"], queryFn: () => api.agendaSolicitacoes() });
  const clinicos = useQuery({
    queryKey: ["atendimentos"],
    queryFn: () => http<AtendimentoApi[]>("/api/atendimentos"),
  });

  const itens = useMemo(() => {
    const fromAgenda = (agenda.data ?? []).map(fromAgendaSolicitacao);
    const fromClinico = (clinicos.data ?? []).map(fromAtendimentoClinico);
    return [...fromAgenda, ...fromClinico];
  }, [agenda.data, clinicos.data]);

  if (agenda.isLoading || clinicos.isLoading) return <LoadingState />;
  if (agenda.isError && clinicos.isError) {
    return <EmptyState title="Não foi possível carregar" description="Tente atualizar a página." />;
  }

  return (
    <div>
      <PageHeader
        title="Atendimentos"
        description="Todos os horários marcados e registros feitos na recepção, agrupados por pet."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => setWalkInOpen(true)}>
              Atendimento sem cadastro
            </Button>
            <ExportMenu
              filename="atendimentos"
              title="Atendimentos"
              columns={[
                { header: "Quando", value: (row) => new Date(row.quando).toLocaleString("pt-BR") },
                { header: "Pet", value: (row) => row.pet },
                { header: "Tutor", value: (row) => row.tutor },
                { header: "Tipo", value: (row) => row.tipo },
                { header: "Profissional", value: (row) => row.profissional },
                { header: "Status", value: (row) => statusAgenda(row.statusCodigo, row.status) },
                { header: "Resumo", value: (row) => row.resumo },
              ]}
              rows={itens}
            />
          </div>
        }
      />
      <AtendimentosPorPetPanel itens={itens} clinicMode />
      <WalkInRegistroModal
        open={walkInOpen}
        tipoFixo="ATENDIMENTO"
        onClose={() => setWalkInOpen(false)}
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: ["atendimentos"] });
          void queryClient.invalidateQueries({ queryKey: ["agenda-solicitacoes"] });
        }}
      />
    </div>
  );
}
