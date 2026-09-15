import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CategoryBars, Spark, TrendArea } from "../../components/charts/AppCharts";
import { PanelHero } from "../../components/clinic/PanelHero";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { ErrorState, LoadingState } from "../../components/ui/EmptyState";
import { StatsCard } from "../../components/ui/StatsCard";
import { HttpError } from "../../lib/http";
import { petArt } from "../../lib/pets-art";
import { api } from "../../services/api";

const RANGES = [
  { id: "7", label: "7 dias", days: 7 },
  { id: "30", label: "30 dias", days: 30 },
  { id: "90", label: "90 dias", days: 90 },
  { id: "180", label: "6 meses", days: 180 },
  { id: "365", label: "12 meses", days: 365 },
] as const;

function money(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function AdminDashboardPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("365");
  const period = useMemo(() => {
    const days = RANGES.find((item) => item.id === range)?.days ?? 365;
    const ate = new Date();
    const de = new Date();
    de.setDate(ate.getDate() - days);
    return { de: de.toISOString().slice(0, 10), ate: ate.toISOString().slice(0, 10) };
  }, [range]);
  const stats = useQuery({
    queryKey: ["admin", "indicadores", period],
    queryFn: () => api.platformStats(period.de, period.ate),
  });

  if (stats.isLoading) return <LoadingState label="Montando o panorama do Flutz…" />;
  if (stats.error) {
    return <ErrorState message={stats.error instanceof HttpError ? stats.error.message : "Falha ao carregar indicadores"} />;
  }
  const data = stats.data;
  if (!data) return null;

  return (
    <div>
      <PanelHero
        image={petArt.puppy}
        eyebrow="Casa Flutz"
        title="O Flutz está crescendo"
        description="Receita recorrente, clínicas e assinaturas oficiais — o visual é que ganhou vida."
      />
      <div className="mb-6 flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap gap-2">
        {RANGES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setRange(item.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              range === item.id ? "bg-brand text-white" : "bg-white/90 text-muted ring-1 ring-brand/15"
            }`}
          >
            {item.label}
          </button>
        ))}
        </div>
        <ExportMenu
          filename="painel-plataforma"
          title="Painel da plataforma"
          columns={[
            { header: "Indicador", value: (row) => row.rotulo },
            { header: "Valor", value: (row) => row.valor },
          ]}
          rows={[
            { id: "mrr", rotulo: "MRR", valor: money(data.mrr) },
            { id: "arr", rotulo: "ARR", valor: money(data.arr) },
            { id: "fat", rotulo: "Faturamento do mês", valor: money(data.faturamentoMes) },
            { id: "ativas", rotulo: "Assinaturas ativas", valor: data.assinaturasAtivas },
            { id: "novas", rotulo: "Novas assinaturas", valor: data.novasAssinaturas },
            { id: "cancel", rotulo: "Cancelamentos", valor: data.cancelamentos },
          ]}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="MRR" value={money(data.mrr)} hint="Soma mensal das assinaturas ativas e em período de testes" chart={<Spark data={data.receitaMensal} />} />
        <StatsCard label="ARR" value={money(data.arr)} hint="Receita recorrente anual" />
        <StatsCard label="Faturamento do mês" value={money(data.faturamentoMes)} hint="Faturas pagas neste mês" />
        <StatsCard label="Assinaturas ativas" value={data.assinaturasAtivas} trend={`${data.novasAssinaturas} novas · ${data.cancelamentos} canceladas`} />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="living-card p-5">
          <h2 className="font-semibold">Receita reconhecida</h2>
          <TrendArea data={data.receitaMensal} currency />
        </section>
        <section className="living-card p-5">
          <h2 className="font-semibold">Novas assinaturas</h2>
          <TrendArea data={data.assinaturasMes} />
        </section>
        <section className="living-card p-5">
          <h2 className="font-semibold">Receita por plano</h2>
          <CategoryBars data={data.receitaPorPlano} currency />
        </section>
        <section className="living-card p-5">
          <h2 className="font-semibold">Clínicas por plano</h2>
          <CategoryBars data={data.clinicasPorPlano} />
        </section>
      </div>
      <section className="living-card mt-6 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Atividade recente</h2>
          <ExportMenu
            filename="atividade-recente"
            title="Atividade recente"
            columns={[
              { header: "Clínica", value: (row) => row.clinica },
              { header: "Status", value: (row) => row.status },
              { header: "Plano", value: (row) => row.plano },
              { header: "Quando", value: (row) => row.quando },
            ]}
            rows={data.atividade.map((item, index) => ({ ...item, id: index }))}
          />
        </div>
        <ul className="mt-4 divide-y divide-line dark:divide-zinc-800">
          {data.atividade.length === 0 ? (
            <li className="py-6 text-sm text-muted">Nenhuma assinatura registrada ainda.</li>
          ) : (
            data.atividade.map((item) => (
              <li key={`${item.clinica}-${item.quando}`} className="py-3">
                <p className="font-medium">{item.clinica}</p>
                <p className="text-sm text-muted">
                  {item.status} · {item.plano} · {item.quando}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
