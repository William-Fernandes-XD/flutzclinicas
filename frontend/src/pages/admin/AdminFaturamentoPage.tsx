import { useQuery } from "@tanstack/react-query";
import { CategoryBars, TrendArea } from "../../components/charts/AppCharts";
import { Badge } from "../../components/ui/Badge";
import { DataTable } from "../../components/ui/DataTable";
import { EmptyState, LoadingState } from "../../components/ui/EmptyState";
import { Surface } from "../../components/ui/Field";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatsCard } from "../../components/ui/StatsCard";
import { api } from "../../services/api";

function money(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function AdminFaturamentoPage() {
  const stats = useQuery({ queryKey: ["admin", "indicadores"], queryFn: () => api.platformStats() });
  const faturas = useQuery({ queryKey: ["admin", "faturas"], queryFn: api.invoices });

  if (stats.isLoading) return <LoadingState />;
  const data = stats.data;

  return (
    <div>
      <PageHeader
        eyebrow="Negócio"
        title="Faturamento da plataforma"
        description="Valores oficiais das faturas da plataforma. Sem provedor, o status pago só aparece quando a fatura for registrada."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatsCard label="Faturamento do mês" value={money(data?.faturamentoMes ?? 0)} />
        <StatsCard label="No período" value={money(data?.faturamentoPeriodo ?? 0)} />
        <StatsCard label="Em aberto / atrasado" value={money(data?.inadimplencia ?? 0)} />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="living-card p-5">
          <h2 className="font-semibold">Evolução</h2>
          <TrendArea data={data?.receitaMensal ?? []} currency />
        </section>
        <section className="living-card p-5">
          <h2 className="font-semibold">Por plano</h2>
          <CategoryBars data={data?.receitaPorPlano ?? []} currency />
        </section>
      </div>
      <section className="mt-6">
        {!faturas.data?.length ? (
          <EmptyState
            title="Nenhuma fatura lançada"
            description="A cobrança mensal da clínica aparece aqui quando as competências forem geradas."
          />
        ) : (
          <DataTable
            rows={faturas.data}
            exportTitle="Faturamento"
            exportColumns={[
              { header: "Clínica", value: (row) => row.clinica },
              { header: "Competência", value: (row) => row.competencia },
              { header: "Valor", value: (row) => money(row.valor) },
              { header: "Status", value: (row) => row.status },
            ]}
            columns={[
              { key: "clinica", header: "Clínica", cell: (row) => row.clinica },
              { key: "competencia", header: "Competência", cell: (row) => row.competencia },
              { key: "valor", header: "Valor", cell: (row) => money(row.valor) },
              { key: "status", header: "Status", cell: (row) => (
                <Badge tone={row.status === "PAGA" ? "ok" : row.status === "ATRASADA" ? "danger" : "warn"}>{row.status}</Badge>
              ) },
            ]}
            mobile={(row) => (
              <Surface>
                <p className="font-medium">{row.clinica}</p>
                <p className="text-sm text-muted">{row.competencia} · {money(row.valor)}</p>
                <Badge tone={row.status === "PAGA" ? "ok" : row.status === "ATRASADA" ? "danger" : "warn"}>{row.status}</Badge>
              </Surface>
            )}
          />
        )}
      </section>
    </div>
  );
}
