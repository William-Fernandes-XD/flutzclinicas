import { useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { Button } from "../../components/ui/Button";
import { ErrorState, LoadingState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Tabs } from "../../components/ui/Tabs";
import { HttpError } from "../../lib/http";
import { statusAgenda } from "../../lib/agenda";
import { api, type VisaoGeralReport } from "../../services/api";
import { ReportBarChart, ReportLineChart, ReportPieChart, type ReportPoint } from "../../components/reports/ReportCharts";

type TabId = "visao" | "financeiro" | "agenda" | "tutores" | "vacinacao" | "equipe";
type Preset = "hoje" | "7d" | "30d" | "mes" | "mes_ant" | "custom";

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function money(value: number | string | null | undefined): string {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(n) ? n : 0);
}

function pct(value: number | string | null | undefined): string {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function toPoints(rows: { rotulo: string; valor: number | string }[] | undefined): ReportPoint[] {
  return (rows ?? []).map((r) => ({ rotulo: r.rotulo, valor: Number(r.valor) }));
}

function rangeForPreset(preset: Preset, customDe: string, customAte: string): { de: string; ate: string } {
  const hoje = new Date();
  if (preset === "hoje") return { de: iso(hoje), ate: iso(hoje) };
  if (preset === "7d") return { de: iso(addDays(hoje, -6)), ate: iso(hoje) };
  if (preset === "30d") return { de: iso(addDays(hoje, -29)), ate: iso(hoje) };
  if (preset === "mes") return { de: iso(startOfMonth(hoje)), ate: iso(hoje) };
  if (preset === "mes_ant") {
    const ant = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    return { de: iso(startOfMonth(ant)), ate: iso(endOfMonth(ant)) };
  }
  return { de: customDe || iso(addDays(hoje, -29)), ate: customAte || iso(hoje) };
}

export function RelatoriosPage() {
  const [tab, setTab] = useState<TabId>("visao");
  const [preset, setPreset] = useState<Preset>("30d");
  const [customDe, setCustomDe] = useState("");
  const [customAte, setCustomAte] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const range = useMemo(() => rangeForPreset(preset, customDe, customAte), [preset, customDe, customAte]);

  const visao = useQuery({
    queryKey: ["clinica", "relatorios", "visao-geral", range.de, range.ate, statusFilter],
    queryFn: () =>
      api.relatorioVisaoGeral({
        de: range.de,
        ate: range.ate,
        status: statusFilter ?? undefined,
      }),
    enabled: tab === "visao",
  });

  return (
    <div>
      <PageHeader
        eyebrow="Gestão"
        title="Relatórios"
        description="Analytics da sua clínica: desempenho, operação e clientes — só os dados desta empresa."
        actions={
          tab === "visao" && visao.data ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => exportVisaoExcel(visao.data!)}>
                Exportar Excel
              </Button>
              <Button type="button" variant="secondary" onClick={() => exportVisaoPdf(visao.data!, reportRef.current)}>
                Exportar PDF
              </Button>
            </div>
          ) : null
        }
      />

      <div className="mb-5">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: "visao", label: "Visão geral" },
            { id: "financeiro", label: "Financeiro" },
            { id: "agenda", label: "Agenda" },
            { id: "tutores", label: "Tutores e pets" },
            { id: "vacinacao", label: "Vacinação" },
            { id: "equipe", label: "Equipe" },
          ]}
        />
      </div>

      {tab === "visao" ? (
        <VisaoGeralSection
          preset={preset}
          setPreset={setPreset}
          customDe={customDe}
          customAte={customAte}
          setCustomDe={setCustomDe}
          setCustomAte={setCustomAte}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          query={visao}
          reportRef={reportRef}
        />
      ) : (
        <ComingSoon
          title={
            tab === "financeiro"
              ? "Financeiro"
              : tab === "agenda"
                ? "Agenda e atendimentos"
                : tab === "tutores"
                  ? "Tutores e pets"
                  : tab === "vacinacao"
                    ? "Vacinação"
                    : "Equipe"
          }
        />
      )}
    </div>
  );
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="living-card p-8 text-center">
      <h2 className="text-lg font-semibold text-[#1f1630]">{title}</h2>
      <p className="mt-2 text-sm text-muted">
        Este relatório será liberado na próxima etapa. A Visão geral já está disponível acima.
      </p>
    </div>
  );
}

function VisaoGeralSection({
  preset,
  setPreset,
  customDe,
  customAte,
  setCustomDe,
  setCustomAte,
  statusFilter,
  setStatusFilter,
  query,
  reportRef,
}: {
  preset: Preset;
  setPreset: (p: Preset) => void;
  customDe: string;
  customAte: string;
  setCustomDe: (v: string) => void;
  setCustomAte: (v: string) => void;
  statusFilter: string | null;
  setStatusFilter: (v: string | null) => void;
  query: { isLoading: boolean; isError: boolean; error: unknown; data?: VisaoGeralReport };
  reportRef: RefObject<HTMLDivElement | null>;
}) {
  if (query.isLoading) return <LoadingState label="Calculando indicadores da clínica…" />;
  if (query.isError) {
    return <ErrorState message={query.error instanceof HttpError ? query.error.message : "Falha ao carregar visão geral"} />;
  }
  const data = query.data;
  if (!data) return null;

  const kpis = data.kpis;
  const deltas = data.deltas;

  return (
    <div ref={reportRef} className="space-y-6">
      <PeriodChips
        preset={preset}
        setPreset={setPreset}
        customDe={customDe}
        customAte={customAte}
        setCustomDe={setCustomDe}
        setCustomAte={setCustomAte}
      />

      <p className="text-xs text-muted">
        Período {data.periodoDe} → {data.periodoAte}
        {statusFilter ? ` · filtro: ${statusAgenda(statusFilter)}` : ""} · comparação com {data.periodoAnteriorDe} →{" "}
        {data.periodoAnteriorAte}
        {statusFilter ? (
          <button type="button" className="ml-2 font-semibold text-brand hover:underline" onClick={() => setStatusFilter(null)}>
            Limpar filtro
          </button>
        ) : null}
      </p>

      <section>
        <h2 className="mb-3 text-sm font-bold tracking-wide text-[#7828c8] uppercase">KPIs</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Faturamento" value={money(kpis.faturamento)} delta={deltas.faturamento} />
          <KpiCard label="Atendimentos" value={String(kpis.atendimentos)} delta={deltas.atendimentos} />
          <KpiCard label="Ticket médio" value={money(kpis.ticketMedio)} delta={deltas.ticketMedio} />
          <KpiCard label="Ocupação (aprox.)" value={`${Number(kpis.ocupacaoPercentual).toLocaleString("pt-BR")}%`} />
          <KpiCard label="Novos tutores" value={String(kpis.novosTutores)} delta={deltas.novosTutores} />
          <KpiCard label="Novos pets" value={String(kpis.novosPets)} delta={deltas.novosPets} />
          <KpiCard label="Cancelamentos" value={String(kpis.cancelamentos)} delta={deltas.cancelamentos} invert />
          <KpiCard label="Faltas" value={String(kpis.faltas)} delta={deltas.faltas} invert />
          <KpiCard label="Retornos" value={String(kpis.retornos)} delta={deltas.retornos} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold tracking-wide text-[#7828c8] uppercase">Principais indicadores</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Faturamento ao longo do tempo" subtitle="Recebimentos (ou valor dos agendamentos)">
            <ReportLineChart data={toPoints(data.faturamentoSerie)} currency />
          </ChartCard>
          <ChartCard title="Atendimentos ao longo do tempo" subtitle="Agendamentos no período">
            <ReportLineChart data={toPoints(data.atendimentosSerie)} />
          </ChartCard>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold tracking-wide text-[#7828c8] uppercase">Operação</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Agendamentos por status" subtitle="Clique para filtrar">
            <ReportPieChart
              data={toPoints(data.porStatus).map((p) => ({ ...p, rotulo: statusAgenda(p.rotulo) }))}
              onSelect={(name) => {
                if (!name) return;
                const match = data.porStatus.find((p) => statusAgenda(p.rotulo) === name || p.rotulo === name);
                setStatusFilter(match?.rotulo ?? name);
              }}
            />
          </ChartCard>
          <ChartCard title="Ocupação da agenda" subtitle="Volume de horários ocupados por dia">
            <ReportBarChart data={toPoints(data.ocupacaoSerie)} />
          </ChartCard>
          <ChartCard title="Serviços mais realizados" subtitle="Top 10 por volume">
            <ReportBarChart data={toPoints(data.servicosVolume)} />
          </ChartCard>
          <ChartCard title="Serviços que mais geram receita" subtitle="Top 10 por valor">
            <ReportBarChart data={toPoints(data.servicosReceita)} currency />
          </ChartCard>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold tracking-wide text-[#7828c8] uppercase">Clientes e pets</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MiniStat label="Novos tutores" value={kpis.novosTutores} hint="Vinculados no período" />
          <MiniStat label="Novos pets" value={kpis.novosPets} hint="Cadastrados no período" />
          <MiniStat label="Tutores em retorno" value={kpis.retornos} hint="Já tinham vindo antes" />
        </div>
        {kpis.faltas > 0 ? (
          <p className="mt-3 text-sm text-muted">Faltas registradas no período: {kpis.faltas}</p>
        ) : null}
      </section>
    </div>
  );
}

function PeriodChips({
  preset,
  setPreset,
  customDe,
  customAte,
  setCustomDe,
  setCustomAte,
}: {
  preset: Preset;
  setPreset: (p: Preset) => void;
  customDe: string;
  customAte: string;
  setCustomDe: (v: string) => void;
  setCustomAte: (v: string) => void;
}) {
  const items: { id: Preset; label: string }[] = [
    { id: "hoje", label: "Hoje" },
    { id: "7d", label: "7 dias" },
    { id: "30d", label: "30 dias" },
    { id: "mes", label: "Este mês" },
    { id: "mes_ant", label: "Mês anterior" },
    { id: "custom", label: "Personalizado" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPreset(item.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
              preset === item.id ? "bg-[#7828c8] text-white" : "bg-[#f3eafc] text-[#5c4d78] hover:bg-[#ebe0fa]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {preset === "custom" ? (
        <div className="flex flex-wrap gap-3">
          <label className="text-sm text-muted">
            De{" "}
            <input
              type="date"
              value={customDe}
              onChange={(e) => setCustomDe(e.target.value)}
              className="ml-1 rounded-xl border border-line px-2 py-1"
            />
          </label>
          <label className="text-sm text-muted">
            Até{" "}
            <input
              type="date"
              value={customAte}
              onChange={(e) => setCustomAte(e.target.value)}
              className="ml-1 rounded-xl border border-line px-2 py-1"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  invert,
}: {
  label: string;
  value: string;
  delta?: number | string | null;
  invert?: boolean;
}) {
  const n = delta == null ? null : Number(delta);
  const up = n != null && n > 0;
  const down = n != null && n < 0;
  const good = invert ? down : up;
  const bad = invert ? up : down;
  return (
    <div className="living-card p-4">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 text-xl font-bold text-[#1f1630]">{value}</p>
      {n != null && Number.isFinite(n) ? (
        <p className={`mt-1 text-xs font-semibold ${good ? "text-emerald-600" : bad ? "text-red-600" : "text-muted"}`}>
          {pct(n)} vs período anterior
        </p>
      ) : null}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <article className="living-card p-4">
      <h3 className="font-semibold text-[#1f1630]">{title}</h3>
      {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
      <div className="mt-2">{children}</div>
    </article>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="living-card p-4">
      <p className="text-xs font-semibold text-muted uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#7828c8]">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

async function exportVisaoExcel(data: VisaoGeralReport) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Flutz";
  const resumo = wb.addWorksheet("Resumo");
  resumo.addRow(["Clínica", data.clinica]);
  resumo.addRow(["Período", `${data.periodoDe} a ${data.periodoAte}`]);
  resumo.addRow(["Gerado em", new Date().toLocaleString("pt-BR")]);
  resumo.addRow([]);
  resumo.addRow(["KPI", "Valor", "Δ % vs anterior"]);
  const rows: [string, string | number, number][] = [
    ["Faturamento", Number(data.kpis.faturamento), Number(data.deltas.faturamento)],
    ["Atendimentos", data.kpis.atendimentos, Number(data.deltas.atendimentos)],
    ["Ticket médio", Number(data.kpis.ticketMedio), Number(data.deltas.ticketMedio)],
    ["Novos tutores", data.kpis.novosTutores, Number(data.deltas.novosTutores)],
    ["Novos pets", data.kpis.novosPets, Number(data.deltas.novosPets)],
    ["Cancelamentos", data.kpis.cancelamentos, Number(data.deltas.cancelamentos)],
    ["Faltas", data.kpis.faltas, Number(data.deltas.faltas)],
    ["Retornos", data.kpis.retornos, Number(data.deltas.retornos)],
    ["Ocupação %", Number(data.kpis.ocupacaoPercentual), 0],
  ];
  rows.forEach((r) => resumo.addRow(r));

  const addSerie = (name: string, serie: { rotulo: string; valor: number | string }[], mapStatus = false) => {
    const ws = wb.addWorksheet(name.slice(0, 31));
    ws.addRow(["Rótulo", "Valor"]);
    serie.forEach((p) => ws.addRow([mapStatus ? statusAgenda(String(p.rotulo)) : p.rotulo, Number(p.valor)]));
  };
  addSerie("Faturamento", data.faturamentoSerie);
  addSerie("Atendimentos", data.atendimentosSerie);
  addSerie("Por status", data.porStatus, true);
  addSerie("Servicos volume", data.servicosVolume);
  addSerie("Servicos receita", data.servicosReceita);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `visao-geral-${data.periodoDe}_${data.periodoAte}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportVisaoPdf(data: VisaoGeralReport, root: HTMLElement | null) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const margin = 40;
  let y = margin;
  doc.setFontSize(16);
  doc.text(data.clinica, margin, y);
  y += 22;
  doc.setFontSize(12);
  doc.text("Relatório — Visão geral da clínica", margin, y);
  y += 18;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Período: ${data.periodoDe} a ${data.periodoAte}`, margin, y);
  y += 14;
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, margin, y);
  y += 24;
  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.text("KPIs", margin, y);
  y += 16;
  doc.setFontSize(10);
  const lines = [
    `Faturamento: ${money(data.kpis.faturamento)} (${pct(data.deltas.faturamento)})`,
    `Atendimentos: ${data.kpis.atendimentos} (${pct(data.deltas.atendimentos)})`,
    `Ticket médio: ${money(data.kpis.ticketMedio)}`,
    `Novos tutores: ${data.kpis.novosTutores} · Novos pets: ${data.kpis.novosPets}`,
    `Cancelamentos: ${data.kpis.cancelamentos} · Retornos: ${data.kpis.retornos}`,
    `Ocupação aproximada: ${data.kpis.ocupacaoPercentual}%`,
  ];
  lines.forEach((line) => {
    doc.text(line, margin, y);
    y += 14;
  });

  // Captura gráficos da tela (canvas do ECharts)
  if (root) {
    const canvases = root.querySelectorAll("canvas");
    for (const canvas of Array.from(canvases).slice(0, 4)) {
      if (y > 700) {
        doc.addPage();
        y = margin;
      }
      try {
        const img = (canvas as HTMLCanvasElement).toDataURL("image/png", 1);
        const w = 515;
        const h = Math.min(180, (canvas.height / canvas.width) * w);
        y += 10;
        doc.addImage(img, "PNG", margin, y, w, h);
        y += h + 16;
      } catch {
        /* ignore */
      }
    }
  }

  doc.save(`visao-geral-${data.periodoDe}_${data.periodoAte}.pdf`);
}
