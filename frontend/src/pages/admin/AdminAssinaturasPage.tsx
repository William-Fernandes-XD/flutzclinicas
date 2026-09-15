import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { DataTable } from "../../components/ui/DataTable";
import { EmptyState, LoadingState } from "../../components/ui/EmptyState";
import { Surface } from "../../components/ui/Field";
import { PageHeader } from "../../components/ui/PageHeader";
import { api } from "../../services/api";

const FILTERS = ["", "TRIAL", "ATIVA", "INADIMPLENTE", "SUSPENSA", "CANCELADA"] as const;

export function AdminAssinaturasPage() {
  const [status, setStatus] = useState("");
  const lista = useQuery({
    queryKey: ["admin", "assinaturas", status],
    queryFn: () => api.subscriptions(status || undefined),
  });

  return (
    <div>
      <PageHeader eyebrow="Negócio" title="Assinaturas" description="Estados oficiais do modelo: TRIAL, ATIVA, INADIMPLENTE, SUSPENSA e CANCELADA." />
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item || "todas"}
            type="button"
            onClick={() => setStatus(item)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status === item ? "bg-brand text-white" : "bg-white ring-1 ring-line dark:bg-zinc-900"}`}
          >
            {item || "Todas"}
          </button>
        ))}
      </div>
      {lista.isLoading ? <LoadingState /> : null}
      {!lista.data?.length && !lista.isLoading ? (
        <EmptyState
          title="Nenhum resultado encontrado"
          description="Não encontramos assinaturas com os filtros selecionados. Tente ajustar ou remover algum filtro para ver mais opções."
        />
      ) : (
        <DataTable
          rows={lista.data ?? []}
          exportTitle="Assinaturas"
          exportColumns={[
            { header: "Clínica", value: (row) => row.clinica },
            { header: "Plano", value: (row) => row.plano },
            { header: "Valor", value: (row) => row.valorMensal },
            { header: "Status", value: (row) => row.status },
            { header: "Início", value: (row) => row.inicio },
            { header: "Próximo vencimento", value: (row) => row.proximoVencimento },
          ]}
          columns={[
            { key: "clinica", header: "Clínica", cell: (row) => <span className="font-medium">{row.clinica}</span> },
            { key: "plano", header: "Plano", cell: (row) => row.plano },
            { key: "valor", header: "Valor", cell: (row) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(row.valorMensal) },
            { key: "status", header: "Status", cell: (row) => (
              <Badge tone={row.status === "CANCELADA" || row.status === "INADIMPLENTE" ? "danger" : "brand"}>{row.status}</Badge>
            ) },
            { key: "inicio", header: "Início", cell: (row) => row.inicio },
            { key: "venc", header: "Próximo vencimento", cell: (row) => row.proximoVencimento ?? "—" },
          ]}
          mobile={(row) => (
            <Surface>
              <p className="font-medium">{row.clinica}</p>
              <p className="text-sm text-muted">{row.plano} · {row.status}</p>
            </Surface>
          )}
        />
      )}
    </div>
  );
}
