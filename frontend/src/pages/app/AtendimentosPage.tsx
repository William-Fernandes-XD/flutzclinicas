import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { AtendimentosPorPetPanel, fromAgendaSolicitacao } from "../../components/clinic/AtendimentosPorPetPanel";
import { EmptyState, LoadingState } from "../../components/ui/EmptyState";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { PageHeader } from "../../components/ui/PageHeader";
import { statusAgenda } from "../../lib/agenda";
import { api } from "../../services/api";

export function AtendimentosPage() {
  const agenda = useQuery({ queryKey: ["agenda-solicitacoes"], queryFn: () => api.agendaSolicitacoes() });

  const itens = useMemo(() => (agenda.data ?? []).map(fromAgendaSolicitacao), [agenda.data]);

  if (agenda.isLoading) return <LoadingState />;
  if (agenda.isError) {
    return <EmptyState title="Não foi possível carregar" description="Tente atualizar a página." />;
  }

  return (
    <div>
      <PageHeader
        title="Atendimentos"
        description="Todos os horários marcados, agrupados por pet. Abra o histórico completo de cada animal."
        actions={
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
        }
      />
      <AtendimentosPorPetPanel itens={itens} clinicMode />
    </div>
  );
}
