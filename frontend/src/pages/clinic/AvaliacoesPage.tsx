import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Frown,
  Meh,
  MessageSquare,
  Search,
  Smile,
  Star,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { EmptyState, LoadingState } from "../../components/ui/EmptyState";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { Input, Select } from "../../components/ui/Field";
import { PageHeader } from "../../components/ui/PageHeader";
import { ServiceTypeIcon } from "../../lib/service-icons";
import { api, type Review } from "../../services/api";

const PAGE_SIZE = 5;

type Periodo = "7" | "30" | "90" | "365" | "todos";
type NotaFiltro = "todas" | "positivas" | "neutras" | "negativas" | "5" | "4" | "3" | "2" | "1";

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function notaNum(row: Review): number {
  return Number(row.nota) || 0;
}

function faixa(nota: number): "positiva" | "neutra" | "negativa" {
  if (nota >= 4) return "positiva";
  if (nota >= 3) return "neutra";
  return "negativa";
}

function petSubline(row: Review): string {
  const parts = [
    row.raca,
    row.idadeAnos != null ? `${row.idadeAnos} ano${row.idadeAnos === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" — ") : "—";
}

function inPeriod(data: string | null | undefined, periodo: Periodo): boolean {
  if (periodo === "todos") return true;
  if (!data) return false;
  const when = new Date(data.includes("T") ? data : data.replace(" ", "T"));
  if (Number.isNaN(when.getTime())) return false;
  const days = Number(periodo);
  return Date.now() - when.getTime() <= days * 24 * 60 * 60 * 1000;
}

function monthKey(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function AvaliacoesPage() {
  const lista = useQuery({ queryKey: ["avaliacoes"], queryFn: api.reviews });

  const [q, setQ] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [notaFiltro, setNotaFiltro] = useState<NotaFiltro>("todas");
  const [servico, setServico] = useState("todos");
  const [page, setPage] = useState(1);

  const all = lista.data ?? [];

  const servicos = useMemo(() => {
    const set = new Set<string>();
    for (const row of all) {
      if (row.servico?.trim()) set.add(row.servico.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [all]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all.filter((row) => {
      if (periodo !== "todos" && !inPeriod(row.data, periodo)) return false;

      const n = notaNum(row);
      if (notaFiltro === "positivas" && faixa(n) !== "positiva") return false;
      if (notaFiltro === "neutras" && faixa(n) !== "neutra") return false;
      if (notaFiltro === "negativas" && faixa(n) !== "negativa") return false;
      if (["1", "2", "3", "4", "5"].includes(notaFiltro) && Math.round(n) !== Number(notaFiltro)) return false;

      if (servico !== "todos" && (row.servico ?? "") !== servico) return false;

      if (term) {
        const hay = [row.tutor, row.email, row.pet, row.raca, row.texto, row.servico].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [all, q, periodo, notaFiltro, servico]);

  useEffect(() => {
    setPage(1);
  }, [q, periodo, notaFiltro, servico]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const kpis = useMemo(() => {
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

    const base = filtered.length ? filtered : all;
    const media = base.length ? base.reduce((s, r) => s + notaNum(r), 0) / base.length : 0;
    const pos = base.filter((r) => faixa(notaNum(r)) === "positiva").length;
    const neu = base.filter((r) => faixa(notaNum(r)) === "neutra").length;
    const neg = base.filter((r) => faixa(notaNum(r)) === "negativa").length;
    const pct = (n: number) => (base.length ? Math.round((n / base.length) * 100) : 0);

    const cur = all.filter((r) => monthKey(r.data) === currentKey);
    const prev = all.filter((r) => monthKey(r.data) === prevKey);
    const avg = (rows: Review[]) => (rows.length ? rows.reduce((s, r) => s + notaNum(r), 0) / rows.length : 0);
    const mediaDelta = avg(cur) - avg(prev);
    const countDeltaPct = prev.length ? Math.round(((cur.length - prev.length) / prev.length) * 100) : cur.length ? 100 : 0;

    const share = (rows: Review[], kind: "positiva" | "neutra" | "negativa") => {
      if (!rows.length) return 0;
      return (rows.filter((r) => faixa(notaNum(r)) === kind).length / rows.length) * 100;
    };
    const posDelta = Math.round(share(cur, "positiva") - share(prev, "positiva"));
    const neuDelta = Math.round(share(cur, "neutra") - share(prev, "neutra"));
    const negDelta = Math.round(share(cur, "negativa") - share(prev, "negativa"));

    return {
      media,
      total: base.length,
      posPct: pct(pos),
      neuPct: pct(neu),
      negPct: pct(neg),
      mediaDelta,
      countDeltaPct,
      posDelta,
      neuDelta,
      negDelta,
    };
  }, [filtered, all]);

  if (lista.isLoading) return <LoadingState label="Carregando avaliações…" />;

  return (
    <div>
      <PageHeader
        eyebrow="Clínica"
        title="Avaliações"
        description="Veja o que os tutores estão falando sobre o atendimento da sua clínica. Use as avaliações para entender o que está indo bem e onde podemos melhorar."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          icon={<Star className="size-4" />}
          label="Avaliação média"
          value={kpis.total ? kpis.media.toFixed(1).replace(".", ",") : "—"}
          trend={kpis.mediaDelta}
          trendSuffix=" vs. mês anterior"
          format={(n) => `${n >= 0 ? "+ " : "− "}${Math.abs(n).toFixed(1).replace(".", ",")}`}
        />
        <KpiCard
          icon={<MessageSquare className="size-4" />}
          label="Total de avaliações"
          value={String(kpis.total)}
          trend={kpis.countDeltaPct}
          trendSuffix="% vs. mês anterior"
          format={(n) => `${n >= 0 ? "+ " : "− "}${Math.abs(n)}`}
        />
        <KpiCard
          icon={<Smile className="size-4" />}
          label="Avaliações positivas"
          value={`${kpis.posPct}%`}
          trend={kpis.posDelta}
          trendSuffix="% vs. mês anterior"
          format={(n) => `${n >= 0 ? "+ " : "− "}${Math.abs(n)}`}
        />
        <KpiCard
          icon={<Meh className="size-4" />}
          label="Avaliações neutras"
          value={`${kpis.neuPct}%`}
          trend={kpis.neuDelta}
          trendSuffix="% vs. mês anterior"
          format={(n) => `${n >= 0 ? "+ " : "− "}${Math.abs(n)}`}
          invertGood
        />
        <KpiCard
          icon={<Frown className="size-4" />}
          label="Avaliações negativas"
          value={`${kpis.negPct}%`}
          trend={kpis.negDelta}
          trendSuffix="% vs. mês anterior"
          format={(n) => `${n >= 0 ? "+ " : "− "}${Math.abs(n)}`}
          invertGood
        />
      </div>

      <div className="living-card mt-5 flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input
            className="pl-9"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Buscar por nome do tutor, pet ou comentário..."
          />
        </div>
        <Select value={periodo} onChange={(event) => setPeriodo(event.target.value as Periodo)} className="lg:w-44">
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
          <option value="365">Último ano</option>
          <option value="todos">Todo o período</option>
        </Select>
        <Select value={notaFiltro} onChange={(event) => setNotaFiltro(event.target.value as NotaFiltro)} className="lg:w-40">
          <option value="todas">Todas</option>
          <option value="positivas">Positivas</option>
          <option value="neutras">Neutras</option>
          <option value="negativas">Negativas</option>
          <option value="5">5 estrelas</option>
          <option value="4">4 estrelas</option>
          <option value="3">3 estrelas</option>
          <option value="2">2 estrelas</option>
          <option value="1">1 estrela</option>
        </Select>
        <Select value={servico} onChange={(event) => setServico(event.target.value)} className="lg:w-44">
          <option value="todos">Todos</option>
          {servicos.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <ExportMenu
          filename="avaliacoes"
          title="Avaliações"
          rows={filtered}
          columns={[
            { header: "Data", value: (row) => formatDateTime(row.data) },
            { header: "Tutor", value: (row) => row.tutor },
            { header: "E-mail", value: (row) => row.email },
            { header: "Pet", value: (row) => row.pet },
            { header: "Raça", value: (row) => row.raca },
            { header: "Serviço", value: (row) => row.servico },
            { header: "Nota", value: (row) => row.nota },
            { header: "Comentário", value: (row) => row.texto },
            { header: "Pública", value: (row) => row.visivel },
          ]}
        />
      </div>

      {!all.length ? (
        <div className="mt-5">
          <EmptyState
            title="Ainda não há avaliações"
            description="Quando um tutor avaliar a clínica após um atendimento concluído, o depoimento aparece aqui."
          />
        </div>
      ) : !filtered.length ? (
        <div className="mt-5">
          <EmptyState title="Nenhum resultado" description="Ajuste os filtros ou a busca para ver avaliações." />
        </div>
      ) : (
        <div className="living-card mt-5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] tracking-wide text-muted uppercase dark:border-zinc-800">
                  <th className="px-4 py-3 font-semibold">Data</th>
                  <th className="px-4 py-3 font-semibold">Tutor</th>
                  <th className="px-4 py-3 font-semibold">Pet</th>
                  <th className="px-4 py-3 font-semibold">Serviço</th>
                  <th className="min-w-[18rem] px-4 py-3 font-semibold w-[40%]">Comentário</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.id} className="border-b border-line/70 last:border-0 dark:border-zinc-800">
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDateTime(row.data)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={row.tutor} src={row.tutorFotoUrl} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink dark:text-white">{row.tutor}</p>
                          <p className="truncate text-xs text-muted">{row.email ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={row.pet ?? "Pet"} src={row.petFotoUrl} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink dark:text-white">{row.pet ?? "—"}</p>
                          <p className="truncate text-xs text-muted">{petSubline(row)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="flex size-8 items-center justify-center rounded-xl bg-brand-soft text-brand">
                          <ServiceTypeIcon icone={row.servicoIcone} nome={row.servico} className="size-4" />
                        </span>
                        <span className="font-medium">{row.servico ?? "—"}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 w-[40%] min-w-[18rem]">
                      <p className="text-sm leading-relaxed text-muted italic">“{row.texto}”</p>
                      <div className="mt-1">
                        <Badge tone={row.visivel ? "ok" : "warn"}>{row.visivel ? "Pública" : "Oculta"}</Badge>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 dark:border-zinc-800">
            <p className="text-sm text-muted">
              Mostrando {pageRows.length} de {filtered.length} avaliaç{filtered.length === 1 ? "ão" : "ões"}
            </p>
            <Pagination page={pageSafe} totalPages={totalPages} onChange={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  trend,
  trendSuffix,
  format,
  invertGood = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  trend: number;
  trendSuffix: string;
  format: (n: number) => string;
  invertGood?: boolean;
}) {
  const up = trend > 0;
  const down = trend < 0;
  const good = invertGood ? down : up;
  const bad = invertGood ? up : down;
  return (
    <article className="living-card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-brand">{icon}</span>
      </div>
      <p className="mt-3 text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-ink dark:text-white">{value}</p>
      <p
        className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${
          good ? "text-emerald-600" : bad ? "text-red-600" : "text-muted"
        }`}
      >
        {up ? <TrendingUp className="size-3.5" /> : down ? <TrendingDown className="size-3.5" /> : null}
        {trend === 0 ? "Sem variação vs. mês anterior" : `${format(trend)}${trendSuffix}`}
      </p>
    </article>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 7);
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={page <= 1}
        className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-brand-soft disabled:opacity-40"
        onClick={() => onChange(page - 1)}
        aria-label="Anterior"
      >
        <ChevronLeft className="size-4" />
      </button>
      {pages.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`flex size-8 items-center justify-center rounded-full text-sm font-semibold ${
            n === page ? "bg-brand text-white" : "text-muted hover:bg-brand-soft"
          }`}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        disabled={page >= totalPages}
        className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-brand-soft disabled:opacity-40"
        onClick={() => onChange(page + 1)}
        aria-label="Próxima"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
