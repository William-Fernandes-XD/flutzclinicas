import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Calendar,
  CalendarCheck,
  CalendarX,
  Clock,
  Eye,
  MessageSquare,
  ScrollText,
  Search,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "../../components/ui/Avatar";
import { EmptyState, LoadingState } from "../../components/ui/EmptyState";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { Input, Select } from "../../components/ui/Field";
import { PageHeader } from "../../components/ui/PageHeader";
import { api } from "../../services/api";

type Periodo = "7" | "30" | "90" | "365" | "todos";

const TIPO_META: Record<string, { label: string; Icon: LucideIcon }> = {
  AGENDA_SOLICITACAO: { label: "Marcação agenda", Icon: Calendar },
  AGENDA_CONFIRMADA: { label: "Agenda confirmada", Icon: CalendarCheck },
  AGENDA_CANCELADA: { label: "Agenda cancelada", Icon: CalendarX },
  AGENDA_PAGAMENTO: { label: "Pagamento agenda", Icon: Wallet },
  CHAT_MENSAGEM: { label: "Chat", Icon: MessageSquare },
  ATENDIMENTO_D1: { label: "Lembrete D-1", Icon: Bell },
  ATENDIMENTO_H1: { label: "Lembrete H-1", Icon: Clock },
};

function rotuloTipo(tipo: string): string {
  return TIPO_META[tipo]?.label ?? tipo;
}

function TipoIcon({ tipo }: { tipo: string }) {
  const Icon = TIPO_META[tipo]?.Icon ?? Bell;
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
      <Icon className="size-4" />
    </span>
  );
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function inPeriod(quando: string, periodo: Periodo): boolean {
  if (periodo === "todos") return true;
  const when = new Date(quando);
  if (Number.isNaN(when.getTime())) return false;
  return Date.now() - when.getTime() <= Number(periodo) * 24 * 60 * 60 * 1000;
}

function PersonHoverCard({
  nome,
  fotoUrl,
  email,
  cargo,
  detail,
  size = "sm",
}: {
  nome: string;
  fotoUrl?: string | null;
  email?: string | null;
  cargo?: string | null;
  detail?: ReactNode;
  size?: "sm" | "md";
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, placeAbove: true });
  const closeTimer = useRef<number | null>(null);

  function clearClose() {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function show() {
    clearClose();
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cardW = 256;
    const cardH = 180;
    const gap = 10;
    const placeAbove = rect.top >= cardH + gap + 8;
    const rawLeft = rect.left + rect.width / 2 - cardW / 2;
    const left = Math.min(Math.max(8, rawLeft), window.innerWidth - cardW - 8);
    const top = placeAbove ? rect.top - gap : rect.bottom + gap;
    setPos({ top, left, placeAbove });
    setOpen(true);
  }

  function hide() {
    clearClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={`rounded-2xl outline-none transition ${open ? "ring-2 ring-brand/40 ring-offset-2" : "hover:ring-2 hover:ring-brand/40 hover:ring-offset-2"}`}
        aria-label={nome}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        <Avatar name={nome} src={fotoUrl} size={size} />
      </button>
      {open
        ? createPortal(
            <div
              role="tooltip"
              className="fixed z-[100]"
              style={{
                top: pos.placeAbove ? undefined : pos.top,
                bottom: pos.placeAbove ? window.innerHeight - pos.top : undefined,
                left: pos.left,
                width: 256,
              }}
              onMouseEnter={show}
              onMouseLeave={hide}
            >
              <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_18px_50px_-18px_rgba(50,20,80,0.6)] ring-1 ring-brand/10 dark:border-zinc-700 dark:bg-zinc-900">
                <div className="h-10 bg-gradient-to-r from-brand to-brand/70" />
                <div className="relative px-4 pb-4">
                  <div className="-mt-6 mb-3">
                    <span className="inline-flex rounded-2xl bg-white p-0.5 shadow-sm dark:bg-zinc-900">
                      <Avatar name={nome} src={fotoUrl} size="md" />
                    </span>
                  </div>
                  <p className="truncate text-sm font-bold text-ink dark:text-white">{nome}</p>
                  {cargo ? <p className="mt-0.5 truncate text-xs text-muted">{cargo}</p> : null}
                  {email ? <p className="mt-1 truncate text-xs text-brand">{email}</p> : null}
                  {detail ? (
                    <div className="mt-2 border-t border-line pt-2 text-xs text-muted dark:border-zinc-700">{detail}</div>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function ClinicNotificationLogsPage() {
  const logs = useQuery({ queryKey: ["notificacao-logs"], queryFn: api.notificacaoLogs });
  const [q, setQ] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [tipo, setTipo] = useState("todos");
  const [destinatarioId, setDestinatarioId] = useState("todos");
  const [visualizadorId, setVisualizadorId] = useState("todos");

  const all = logs.data ?? [];

  const tipos = useMemo(() => {
    const set = new Set<string>();
    for (const item of all) set.add(item.tipo);
    return [...set].sort((a, b) => rotuloTipo(a).localeCompare(rotuloTipo(b), "pt-BR"));
  }, [all]);

  const destinatarios = useMemo(() => {
    const map = new Map<number, { id: number; nome: string }>();
    for (const item of all) {
      if (item.destinatarioId != null) {
        map.set(item.destinatarioId, { id: item.destinatarioId, nome: item.destinatario });
      }
    }
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [all]);

  const visualizadores = useMemo(() => {
    const map = new Map<number, { id: number; nome: string }>();
    for (const item of all) {
      for (const viz of item.visualizacoes) {
        if (viz.colaboradorId != null && viz.nome) {
          map.set(viz.colaboradorId, { id: viz.colaboradorId, nome: viz.nome });
        }
      }
    }
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [all]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all.filter((item) => {
      if (!inPeriod(item.quando, periodo)) return false;
      if (tipo !== "todos" && item.tipo !== tipo) return false;
      if (destinatarioId !== "todos" && String(item.destinatarioId) !== destinatarioId) return false;
      if (visualizadorId !== "todos") {
        const id = Number(visualizadorId);
        if (!item.visualizacoes.some((v) => v.colaboradorId === id)) return false;
      }
      if (term) {
        const viewers = item.visualizacoes.flatMap((v) => [v.nome, v.email]).join(" ");
        const hay = [
          item.titulo,
          item.corpo,
          item.destinatario,
          item.destinatarioEmail,
          rotuloTipo(item.tipo),
          viewers,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [all, q, periodo, tipo, destinatarioId, visualizadorId]);

  return (
    <div>
      <PageHeader
        eyebrow="Gestão"
        title="Logs de notificações"
        description="Auditoria de avisos enviados à equipe: quem recebeu, o tipo da ação e quem visualizou cada um."
      />

      <div className="living-card flex flex-col gap-3 p-4 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative min-w-0 flex-1 lg:min-w-[16rem]">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input
            className="pl-9"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Buscar por título, conteúdo ou pessoa…"
          />
        </div>
        <Select value={periodo} onChange={(event) => setPeriodo(event.target.value as Periodo)} className="lg:w-44">
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
          <option value="365">Último ano</option>
          <option value="todos">Todo o período</option>
        </Select>
        <Select value={tipo} onChange={(event) => setTipo(event.target.value)} className="lg:w-48">
          <option value="todos">Todos os tipos</option>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {rotuloTipo(t)}
            </option>
          ))}
        </Select>
        <Select value={destinatarioId} onChange={(event) => setDestinatarioId(event.target.value)} className="lg:w-48">
          <option value="todos">Todos os destinatários</option>
          {destinatarios.map((d) => (
            <option key={d.id} value={String(d.id)}>
              {d.nome}
            </option>
          ))}
        </Select>
        <Select value={visualizadorId} onChange={(event) => setVisualizadorId(event.target.value)} className="lg:w-48">
          <option value="todos">Quem visualizou (todos)</option>
          {visualizadores.map((v) => (
            <option key={v.id} value={String(v.id)}>
              {v.nome}
            </option>
          ))}
        </Select>
        <ExportMenu
          filename="logs-notificacoes"
          title="Logs de notificações"
          rows={filtered}
          columns={[
            { header: "Quando", value: (row) => formatDateTime(row.quando) },
            { header: "Tipo", value: (row) => rotuloTipo(row.tipo) },
            { header: "Destinatário", value: (row) => row.destinatario },
            { header: "E-mail destinatário", value: (row) => row.destinatarioEmail },
            { header: "Título", value: (row) => row.titulo },
            { header: "Conteúdo", value: (row) => row.corpo },
            {
              header: "Visualizações",
              value: (row) =>
                row.visualizacoes.length
                  ? row.visualizacoes
                      .map((v) => `${v.nome ?? "—"}${v.quando ? ` (${formatDateTime(v.quando)})` : ""}`)
                      .join("; ")
                  : "Ninguém visualizou",
            },
          ]}
        />
      </div>

      {logs.isLoading ? (
        <div className="mt-5">
          <LoadingState label="Carregando logs…" />
        </div>
      ) : !all.length ? (
        <div className="mt-5">
          <EmptyState
            icon={<ScrollText className="size-6" />}
            title="Sem registros ainda"
            description="Quando houver marcações na agenda ou mensagens notificadas, o histórico aparece aqui."
          />
        </div>
      ) : !filtered.length ? (
        <div className="mt-5">
          <EmptyState title="Nenhum resultado" description="Ajuste os filtros ou a busca para ver os logs." />
        </div>
      ) : (
        <div className="living-card mt-5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] tracking-wide text-muted uppercase dark:border-zinc-800">
                  <th className="px-4 py-3 font-semibold">Quando</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Destinatário</th>
                  <th className="min-w-[16rem] px-4 py-3 font-semibold">Conteúdo</th>
                  <th className="px-4 py-3 font-semibold">Visualizações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b border-line/70 align-middle last:border-0 dark:border-zinc-800">
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDateTime(item.quando)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <TipoIcon tipo={item.tipo} />
                        <span className="font-medium text-ink dark:text-white">{rotuloTipo(item.tipo)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <PersonHoverCard
                        nome={item.destinatario}
                        fotoUrl={item.destinatarioFotoUrl}
                        email={item.destinatarioEmail}
                        cargo={item.destinatarioCargo}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink dark:text-white">{item.titulo}</p>
                      <p className="mt-0.5 text-muted">{item.corpo}</p>
                    </td>
                    <td className="px-4 py-3">
                      {!item.visualizacoes.length ? (
                        <span className="inline-flex items-center gap-1.5 text-muted">
                          <Eye className="size-3.5 opacity-60" />
                          Ninguém visualizou
                        </span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          {item.visualizacoes.map((viz, index) => (
                            <PersonHoverCard
                              key={`${item.id}-${viz.colaboradorId ?? index}`}
                              nome={viz.nome ?? "—"}
                              fotoUrl={viz.fotoUrl}
                              email={viz.email}
                              cargo={viz.cargo}
                              detail={viz.quando ? <>Visualizou em {formatDateTime(viz.quando)}</> : null}
                            />
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line px-4 py-3 text-sm text-muted dark:border-zinc-800">
            Mostrando {filtered.length} de {all.length} registro{all.length === 1 ? "" : "s"}
          </div>
        </div>
      )}
    </div>
  );
}
