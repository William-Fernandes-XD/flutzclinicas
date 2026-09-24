import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  FileSpreadsheet,
  FileText,
  MapPin,
  MoreVertical,
  PawPrint,
  Search,
  ShieldCheck,
  Syringe,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppointmentDetailModal } from "../../components/agenda/AppointmentDetailModal";
import { BookingPaymentModal } from "../../components/BookingPaymentModal";
import { AvaliarClinicaModal } from "../../components/clinic/AvaliarClinicaModal";
import { PetPhoto } from "../../components/clinic/PanelHero";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState, LoadingState } from "../../components/ui/EmptyState";
import { Surface } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { corStatusAgenda, statusAgenda, tomStatus, podeCancelarAgendamento } from "../../lib/agenda";
import { exportTable } from "../../lib/export";
import { api, type AgendaSolicitacao, type AvaliacaoPendente, type VaccinationRow } from "../../services/api";
import { useToast } from "../../providers/ToastProvider";

type TutorView = "semana" | "mes";
type AgendaRow = AgendaSolicitacao & { when: Date };

const WEEK_LABELS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const MONTH_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const VISIBLE_DAY = 2;
const WEEK_CAROUSEL_SIZE = 4;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function mondayOf(date: Date): Date {
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  const monday = startOfDay(date);
  monday.setDate(monday.getDate() + offset);
  return monday;
}

function ativoTutor(item: AgendaSolicitacao): boolean {
  return ["SOLICITADO", "AGUARDANDO_PAGAMENTO", "CONFIRMADO", "AGUARDANDO_CLIENTE"].includes(item.statusCodigo);
}

function formatRangeLabel(days: Date[], view: TutorView, cursor: Date): string {
  if (view === "mes") {
    return cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }
  const first = days[0];
  const last = days[days.length - 1];
  const sameMonth = first.getMonth() === last.getMonth();
  if (sameMonth) {
    return `${String(first.getDate()).padStart(2, "0")} - ${String(last.getDate()).padStart(2, "0")} de ${first.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`;
  }
  return `${first.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} - ${last.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;
}

function horaRange(item: AgendaSolicitacao): string {
  const inicio = new Date(item.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (!item.fim) return inicio;
  const fim = new Date(item.fim).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${inicio} - ${fim}`;
}

export function ClientAgendaPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const deepId = searchParams.get("id");
  const [view, setView] = useState<TutorView>("semana");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState<AgendaSolicitacao | null>(null);
  const [payId, setPayId] = useState<number | null>(null);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [weekSlide, setWeekSlide] = useState(0);
  const lista = useQuery({ queryKey: ["agenda-solicitacoes"], queryFn: () => api.agendaSolicitacoes() });
  const acao = useMutation({
    mutationFn: ({ id, nome }: { id: number; nome: string }) => api.agendaAcao(id, nome),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agenda-solicitacoes"] });
      toast.push("Agenda atualizada.");
    },
  });

  const items = useMemo(
    () =>
      (lista.data ?? []).map((item) => ({
        ...item,
        when: new Date(item.inicio),
      })),
    [lista.data],
  );
  const active = useMemo(() => items.filter((item) => ativoTutor(item)), [items]);
  const pendingProposals = useMemo(
    () => items.filter((item) => item.statusCodigo === "AGUARDANDO_CLIENTE"),
    [items],
  );
  const pendingPayments = useMemo(
    () => items.filter((item) => item.statusCodigo === "AGUARDANDO_PAGAMENTO"),
    [items],
  );

  const deepPagar = searchParams.get("pagar") === "1";

  useEffect(() => {
    if (!deepId || !lista.data?.length) return;
    const id = Number(deepId);
    if (!Number.isFinite(id)) return;
    const encontrada = lista.data.find((item) => item.id === id);
    if (!encontrada) return;
    setCursor(startOfDay(new Date(encontrada.inicio)));
    if (deepPagar && encontrada.statusCodigo === "AGUARDANDO_PAGAMENTO") {
      setSelected(null);
      setPayId(encontrada.id);
    } else {
      setPayId(null);
      setSelected(encontrada);
    }
  }, [deepId, deepPagar, lista.data]);

  const days = useMemo(() => {
    if (view === "semana") {
      const weekStart = mondayOf(cursor);
      return Array.from({ length: 7 }, (_, index) => {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + index);
        return day;
      });
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = mondayOf(first);
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [cursor, view]);

  useEffect(() => {
    setWeekSlide(0);
  }, [cursor, view]);

  const weekMaxSlide = Math.max(0, days.length - WEEK_CAROUSEL_SIZE);
  const weekVisible = view === "semana" ? days.slice(weekSlide, weekSlide + WEEK_CAROUSEL_SIZE) : [];

  const exportCols = [
    { header: "Pet", value: (row: AgendaSolicitacao) => row.pet },
    { header: "Clínica", value: (row: AgendaSolicitacao) => row.clinica },
    { header: "Profissional", value: (row: AgendaSolicitacao) => row.colaborador ?? "A definir" },
    { header: "Início", value: (row: AgendaSolicitacao) => new Date(row.inicio).toLocaleString("pt-BR") },
    { header: "Status", value: (row: AgendaSolicitacao) => row.status },
  ];

  function shift(delta: number) {
    setCursor((current) => {
      const next = new Date(current);
      if (view === "mes") next.setMonth(current.getMonth() + delta);
      else next.setDate(current.getDate() + delta * 7);
      return startOfDay(next);
    });
  }

  function toggleDay(key: string) {
    setExpandedDays((atual) => ({ ...atual, [key]: !atual[key] }));
  }

  if (lista.isLoading) return <LoadingState />;

  return (
    <div className="pb-8">
      <section className="mb-6 overflow-hidden rounded-3xl border border-[#ebe4f4] bg-[#f3eafc]">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#7828c8] text-white shadow-md shadow-[#7828c8]/30 sm:size-14">
              <CalendarDays className="size-6 sm:size-7" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#7828c8] uppercase">Minha agenda</p>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-[#1f1630] sm:text-2xl">
                Seus horários e compromissos
              </h1>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[#6e6680]">
                Acompanhe atendimentos e vacinações dos seus pets, aceite propostas da clínica e cancele quando precisar.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="!rounded-full bg-white"
              onClick={() =>
                exportTable("excel", {
                  filename: "minha-agenda",
                  title: "Minha agenda",
                  columns: exportCols,
                  rows: lista.data ?? [],
                })
              }
            >
              <Download className="size-4" />
              Exportar
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="!rounded-full bg-white"
              onClick={() =>
                exportTable("excel", {
                  filename: "minha-agenda",
                  title: "Minha agenda",
                  columns: exportCols,
                  rows: lista.data ?? [],
                })
              }
            >
              <FileSpreadsheet className="size-4" />
              Excel
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="!rounded-full bg-white"
              onClick={() =>
                exportTable("pdf", {
                  filename: "minha-agenda",
                  title: "Minha agenda",
                  columns: exportCols,
                  rows: lista.data ?? [],
                })
              }
            >
              <FileText className="size-4" />
              PDF
            </Button>
          </div>
        </div>
      </section>

      {pendingPayments.length ? (
        <Surface className="mb-5 space-y-3">
          <h2 className="font-semibold text-brand">Pagamentos pendentes</h2>
          {pendingPayments.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-900"
            >
              <div>
                <p className="text-sm font-semibold">
                  {item.pet} · {item.clinica}
                </p>
                <p className="text-xs text-muted">{new Date(item.inicio).toLocaleString("pt-BR")}</p>
                {item.valorCobrado != null ? (
                  <p className="text-sm font-semibold text-brand">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(item.valorCobrado))}
                  </p>
                ) : null}
                <Badge tone={tomStatus(item.statusCodigo)}>{statusAgenda(item.statusCodigo, item.status)}</Badge>
              </div>
              <Button
                onClick={() => {
                  setSelected(null);
                  setPayId(item.id);
                }}
              >
                Pagar agora
              </Button>
            </div>
          ))}
        </Surface>
      ) : null}

      {pendingProposals.length ? (
        <Surface className="mb-5 space-y-3">
          <h2 className="font-semibold text-brand">Propostas da clínica</h2>
          {pendingProposals.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-soft/50 p-3 ring-1 ring-brand/10"
            >
              <div>
                <p className="text-sm font-semibold">
                  {item.pet} · {item.clinica}
                </p>
                <p className="text-xs text-muted">Original: {new Date(item.inicio).toLocaleString("pt-BR")}</p>
                {item.propostaInicio ? (
                  <p className="text-sm text-brand">Nova proposta: {new Date(item.propostaInicio).toLocaleString("pt-BR")}</p>
                ) : null}
                <Badge tone={tomStatus(item.statusCodigo)}>{statusAgenda(item.statusCodigo, item.status)}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button busy={acao.isPending} busyLabel="Aceitando…" onClick={() => acao.mutate({ id: item.id, nome: "aceitar" })}>
                  Aceitar
                </Button>
                <Button
                  variant="secondary"
                  busy={acao.isPending}
                  busyLabel="Recusando…"
                  onClick={() => acao.mutate({ id: item.id, nome: "recusar-proposta" })}
                >
                  Recusar
                </Button>
              </div>
            </div>
          ))}
        </Surface>
      ) : null}

      <div className="mb-5 flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex rounded-full bg-[#f3eafc] p-1">
          {(["semana", "mes"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                view === item ? "bg-[#7828c8] text-white shadow-sm" : "text-[#5c4d78] hover:bg-white/70"
              }`}
            >
              {item === "semana" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[#1f1630]">
          <button type="button" aria-label="Anterior" onClick={() => shift(-1)} className="rounded-full p-1.5 text-[#7828c8] hover:bg-[#f3eafc]">
            <ChevronLeft className="size-5" />
          </button>
          <span className="inline-flex items-center gap-2 capitalize">
            <CalendarDays className="size-4 text-[#7828c8]" />
            {formatRangeLabel(days, view, cursor)}
          </span>
          <button type="button" aria-label="Próximo" onClick={() => shift(1)} className="rounded-full p-1.5 text-[#7828c8] hover:bg-[#f3eafc]">
            <ChevronRight className="size-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" className="!rounded-full" onClick={() => shift(-1)}>
            Anterior
          </Button>
          <Button type="button" variant="ghost" className="!rounded-full" onClick={() => setCursor(startOfDay(new Date()))}>
            Hoje
          </Button>
          <Button type="button" className="!rounded-full" onClick={() => shift(1)}>
            Próximo
          </Button>
        </div>
      </div>

      {!active.length ? (
        <EmptyState
          title="Nenhum compromisso"
          description="Solicite um horário na página pública da clínica para ver seus agendamentos aqui."
        />
      ) : view === "mes" ? (
        <div className="overflow-x-auto rounded-3xl border border-[#ebe4f4] bg-white p-3 shadow-sm sm:p-4">
          <div className="grid min-w-[42rem] grid-cols-7 gap-2">
            {MONTH_LABELS.map((label) => (
              <p key={label} className="pb-1 text-center text-xs font-semibold text-[#8b7fa3]">
                {label}
              </p>
            ))}
            {days.map((day) => {
              const dayList = active.filter((item) => sameDay(item.when, day));
              const outside = day.getMonth() !== cursor.getMonth();
              const isToday = sameDay(day, new Date());
              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-24 rounded-2xl border p-2 ${
                    outside ? "border-transparent bg-[#faf8fc] opacity-55" : "border-[#ebe4f4] bg-white"
                  } ${isToday ? "ring-2 ring-[#7828c8]/30" : ""}`}
                >
                  <p className={`text-xs font-semibold ${isToday ? "text-[#7828c8]" : "text-[#1f1630]"}`}>{day.getDate()}</p>
                  {dayList.slice(0, 3).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="mt-1 block w-full truncate rounded-lg bg-[#f3eafc] px-1.5 py-0.5 text-left text-[10px] font-medium text-[#5c4d78] hover:bg-[#ebe0fa]"
                      onClick={() => setSelected(item)}
                    >
                      {item.pet}
                    </button>
                  ))}
                  {dayList.length > 3 ? (
                    <p className="mt-1 text-[10px] font-semibold text-[#7828c8]">+{dayList.length - 3}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="relative flex items-stretch gap-2 sm:gap-3">
          <button
            type="button"
            aria-label="Dias anteriores"
            disabled={weekSlide <= 0}
            onClick={() => setWeekSlide((atual) => Math.max(0, atual - 1))}
            className="z-10 inline-flex w-10 shrink-0 items-center justify-center self-center rounded-2xl border border-[#ebe4f4] bg-white text-[#7828c8] shadow-sm transition hover:bg-[#f3eafc] disabled:cursor-not-allowed disabled:opacity-35 sm:w-12 sm:rounded-3xl"
          >
            <ChevronLeft className="size-6" />
          </button>

          <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 xl:grid-cols-4">
            {weekVisible.map((day) => {
              const key = day.toISOString();
              const weekdayIndex = (day.getDay() + 6) % 7;
              const dayList = active
                .filter((item) => sameDay(item.when, day))
                .sort((a, b) => a.when.getTime() - b.when.getTime());
              const expanded = Boolean(expandedDays[key]);
              const visible = expanded ? dayList : dayList.slice(0, VISIBLE_DAY);
              const hidden = Math.max(0, dayList.length - VISIBLE_DAY);
              const isToday = sameDay(day, new Date());

              return (
                <div
                  key={key}
                  className={`flex min-h-[20rem] min-w-0 flex-col rounded-3xl border bg-white p-4 shadow-sm ${
                    isToday ? "border-[#7828c8]/40 ring-2 ring-[#7828c8]/15" : "border-[#ebe4f4]"
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-2 border-b border-[#f3eef8] pb-3">
                    <div>
                      <p className="text-sm font-semibold text-[#1f1630]">{WEEK_LABELS[weekdayIndex]}</p>
                      <p className="text-xs text-[#8b7fa3]">
                        {day.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </p>
                    </div>
                    <span className="inline-flex size-6 items-center justify-center rounded-full bg-[#f3eafc] text-[11px] font-bold text-[#7828c8]">
                      {dayList.length}
                    </span>
                  </div>

                  {!dayList.length ? (
                    <div className="flex flex-1 flex-col items-center justify-center px-2 text-center">
                      <CalendarDays className="size-8 text-[#d4c4ef]" />
                      <p className="mt-2 text-xs leading-relaxed text-[#9a90b0]">Nenhum agendamento neste dia</p>
                    </div>
                  ) : (
                    <ul className="flex-1 space-y-2">
                      {visible.map((item) => (
                        <li key={item.id}>
                          <TutorAgendaCard
                            item={item}
                            onOpen={() => {
                              setPayId(null);
                              setSelected(item);
                            }}
                            onPay={
                              item.statusCodigo === "AGUARDANDO_PAGAMENTO"
                                ? () => {
                                    setSelected(null);
                                    setPayId(item.id);
                                  }
                                : undefined
                            }
                            onCancel={
                              podeCancelarAgendamento(item.statusCodigo, item.inicio)
                                ? () => acao.mutate({ id: item.id, nome: "cancelar" })
                                : undefined
                            }
                            cancelBusy={acao.isPending}
                          />
                        </li>
                      ))}
                    </ul>
                  )}

                  {hidden > 0 ? (
                    <button
                      type="button"
                      onClick={() => toggleDay(key)}
                      className="mt-3 w-full rounded-xl bg-[#f3eafc] px-2 py-2 text-xs font-semibold text-[#7828c8] hover:bg-[#ebe0fa]"
                    >
                      {expanded ? "Ver menos" : `+ Ver mais (${hidden})`}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            aria-label="Próximos dias"
            disabled={weekSlide >= weekMaxSlide}
            onClick={() => setWeekSlide((atual) => Math.min(weekMaxSlide, atual + 1))}
            className="z-10 inline-flex w-10 shrink-0 items-center justify-center self-center rounded-2xl border border-[#ebe4f4] bg-white text-[#7828c8] shadow-sm transition hover:bg-[#f3eafc] disabled:cursor-not-allowed disabled:opacity-35 sm:w-12 sm:rounded-3xl"
          >
            <ChevronRight className="size-6" />
          </button>
        </div>
      )}

      <AppointmentDetailModal
        item={
          selected && payId == null
            ? {
                id: selected.id,
                inicio: selected.inicio,
                fim: selected.fim,
                status: selected.status,
                statusCodigo: selected.statusCodigo,
                petId: selected.petId,
                pet: selected.pet,
                especie: selected.especie,
                tutor: selected.tutor,
                clinica: selected.clinica,
                fotoUrl: selected.fotoUrl,
                colaboradorId: selected.colaboradorId,
                colaborador: selected.colaborador,
                tipo: selected.tipo,
                servico: selected.servico,
                vacina: selected.vacina,
                valorCobrado: selected.valorCobrado,
                valorServico: selected.valorServico,
                codigoCupom: selected.codigoCupom,
              }
            : null
        }
        clinicMode={false}
        onClose={() => setSelected(null)}
      />
      {payId != null ? (
        <BookingPaymentModal
          agendamentoId={payId}
          onPaid={async () => {
            setPayId(null);
            setSelected(null);
            await queryClient.invalidateQueries({ queryKey: ["agenda-solicitacoes"] });
            toast.push("Pagamento confirmado.");
          }}
          onClose={() => setPayId(null)}
        />
      ) : null}
    </div>
  );
}

function TutorAgendaCard({
  item,
  onOpen,
  onPay,
  onCancel,
  cancelBusy,
}: {
  item: AgendaRow;
  onOpen: () => void;
  onPay?: () => void;
  onCancel?: () => void;
  cancelBusy?: boolean;
}) {
  const vacina = item.tipo === "VACINACAO";
  const cores = corStatusAgenda(item.statusCodigo);
  const statusTexto = statusAgenda(item.statusCodigo, item.status);

  return (
    <div className={`flex flex-col items-center gap-2 rounded-2xl border border-[#ebe4f4] border-l-4 ${cores.border} bg-white p-2.5 text-center shadow-sm`}>
      <div className="flex w-full flex-col items-center gap-1.5">
        <div className="flex w-full flex-wrap items-center justify-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${cores.soft}`}>
            {statusTexto}
          </span>
          <span className="rounded-full bg-[#f1f0f4] px-2 py-0.5 text-[10px] font-semibold text-[#6e6680]">
            {vacina ? "Vacinação" : "Atendimento"}
          </span>
          <button type="button" aria-label="Detalhes" onClick={onOpen} className="text-[#9a90b0] hover:text-[#7828c8]">
            <MoreVertical className="size-4" />
          </button>
        </div>
      </div>
      <button type="button" onClick={onOpen} className="flex w-full flex-col items-center gap-1.5 text-center">
        <PetPhoto especie={item.especie} seed={item.petId} src={item.fotoUrl} className="size-10 rounded-full" />
        <p className="text-xs font-bold text-[#1f1630]">{horaRange(item)}</p>
        <p className="w-full break-words text-sm font-semibold text-[#1f1630]">{item.pet}</p>
        <p className="w-full break-words text-[11px] text-[#8b7fa3]">{item.tutor}</p>
        <p className="flex w-full items-center justify-center gap-1 break-words text-[11px] text-[#6e6680]">
          <MapPin className="size-3 shrink-0 text-[#7828c8]" />
          <span>{item.clinica}</span>
        </p>
      </button>
      {onPay ? (
        <Button type="button" className="w-full !h-8 text-xs" onClick={onPay}>
          Pagar agora
        </Button>
      ) : null}
      {onCancel ? (
        <Button type="button" variant="ghost" className="w-full !h-8 text-xs" busy={cancelBusy} busyLabel="…" onClick={onCancel}>
          Cancelar
        </Button>
      ) : null}
    </div>
  );
}

export function ClientVacinacaoPage() {
  const lista = useQuery({ queryKey: ["tutor-vacinas"], queryFn: api.tutorVaccinations });
  const pendentes = useQuery({ queryKey: ["avaliacoes-pendentes"], queryFn: api.avaliacoesPendentes });
  const [avaliar, setAvaliar] = useState<AvaliacaoPendente | null>(null);
  const [filtro, setFiltro] = useState<"todas" | "em_dia" | "pendentes" | "vencidas">("todas");
  const [buscaPet, setBuscaPet] = useState("");
  const [periodo, setPeriodo] = useState<"todos" | "30" | "90" | "365">("todos");
  const [detalhePetId, setDetalhePetId] = useState<number | null>(null);

  const vacinasPendentes = useMemo(
    () => (pendentes.data ?? []).filter((item) => item.origem === "VACINACAO"),
    [pendentes.data],
  );

  const pets = useMemo(() => agruparVacinasPorPet(lista.data ?? [], vacinasPendentes), [lista.data, vacinasPendentes]);

  const filtrados = useMemo(() => {
    const q = buscaPet.trim().toLowerCase();
    const agora = Date.now();
    return pets.filter((pet) => {
      if (q && !pet.nome.toLowerCase().includes(q)) return false;
      if (filtro === "em_dia" && pet.status !== "em_dia") return false;
      if (filtro === "pendentes" && pet.status !== "proxima") return false;
      if (filtro === "vencidas" && pet.status !== "vencida") return false;
      if (periodo !== "todos") {
        const dias = Number(periodo);
        const limite = agora - dias * 24 * 60 * 60 * 1000;
        const temNoPeriodo = pet.doses.some((dose) => new Date(`${dose.aplicacao}T12:00:00`).getTime() >= limite);
        if (!temNoPeriodo) return false;
      }
      return true;
    });
  }, [buscaPet, filtro, periodo, pets]);

  const detalhe = filtrados.find((pet) => pet.petId === detalhePetId) ?? pets.find((pet) => pet.petId === detalhePetId) ?? null;

  if (lista.isLoading) return <LoadingState />;

  return (
    <div className="pb-8">
      <section className="mb-6 overflow-hidden rounded-3xl border border-[#ebe4f4] bg-[#f3eafc]">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#7828c8] text-white shadow-md shadow-[#7828c8]/30 sm:size-14">
              <Syringe className="size-6 sm:size-7" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#7828c8] uppercase">Saúde do seu pet</p>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-[#1f1630] sm:text-2xl">Vacinação</h1>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[#6e6680]">
                Linha do tempo das doses dos seus pets. Após a aplicação, você pode avaliar a clínica.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="!rounded-full bg-white"
              onClick={() =>
                exportTable("excel", {
                  filename: "minha-vacinacao",
                  title: "Vacinação",
                  columns: [
                    { header: "Pet", value: (row) => row.pet },
                    { header: "Vacina", value: (row) => row.vacina },
                    { header: "Aplicação", value: (row) => row.aplicacao },
                    { header: "Próxima", value: (row) => row.proxima ?? "" },
                  ],
                  rows: lista.data ?? [],
                })
              }
            >
              <FileSpreadsheet className="size-4" />
              Excel
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="!rounded-full bg-white"
              onClick={() =>
                exportTable("pdf", {
                  filename: "minha-vacinacao",
                  title: "Vacinação",
                  columns: [
                    { header: "Pet", value: (row) => row.pet },
                    { header: "Vacina", value: (row) => row.vacina },
                    { header: "Aplicação", value: (row) => row.aplicacao },
                    { header: "Próxima", value: (row) => row.proxima ?? "" },
                  ],
                  rows: lista.data ?? [],
                })
              }
            >
              <FileText className="size-4" />
              PDF
            </Button>
          </div>
        </div>
      </section>

      {vacinasPendentes.length ? (
        <Surface className="mb-5 space-y-3">
          <h2 className="font-semibold text-brand">Avaliar clínica</h2>
          <p className="text-sm text-muted">Há {vacinasPendentes.length} vacinação(ões) aguardando sua avaliação.</p>
          {vacinasPendentes.map((item) => (
            <div key={`${item.origem}-${item.origemId}`} className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">
                {item.pet} · {item.clinica}
                {item.quando ? ` · ${item.quando}` : ""}
              </p>
              <Button type="button" onClick={() => setAvaliar(item)}>
                Avaliar
              </Button>
            </div>
          ))}
        </Surface>
      ) : null}

      <div className="mb-5 flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "todas", label: "Todas" },
              { id: "em_dia", label: "Em dia" },
              { id: "pendentes", label: "Pendentes" },
              { id: "vencidas", label: "Vencidas" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFiltro(item.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                filtro === item.id ? "bg-[#7828c8] text-white" : "border border-[#e4dcf0] bg-white text-[#5c4d78]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-full border border-[#ebe4f4] bg-white px-3 py-2 text-sm text-[#5c4d78]">
            <CalendarDays className="size-4 text-[#7828c8]" />
            <select
              value={periodo}
              onChange={(event) => setPeriodo(event.target.value as typeof periodo)}
              className="bg-transparent text-sm font-medium outline-none"
            >
              <option value="todos">Filtrar por período</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="365">Último ano</option>
            </select>
          </label>
          <label className="relative min-w-[12rem] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#9a90b0]" />
            <input
              value={buscaPet}
              onChange={(event) => setBuscaPet(event.target.value)}
              placeholder="Buscar pet..."
              className="h-10 w-full rounded-full border border-[#ebe4f4] bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-[#7828c8]/40"
            />
          </label>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0">
          <h2 className="mb-4 text-base font-semibold text-[#1f1630]">Meus pets ({filtrados.length})</h2>
          {!lista.data?.length ? (
            <EmptyState
              title="Sem histórico de vacinação"
              description="As aplicações feitas na clínica aparecem automaticamente."
            />
          ) : !filtrados.length ? (
            <EmptyState
              title="Nenhum resultado encontrado"
              description="Não encontramos pets com esses filtros. Tente ajustar ou limpar a pesquisa."
              onClear={() => {
                setFiltro("todas");
                setBuscaPet("");
                setPeriodo("todos");
              }}
            />
          ) : (
            <ul className="space-y-3">
              {filtrados.map((pet) => (
                <VacinaPetCard
                  key={pet.petId}
                  pet={pet}
                  onDetalhes={() => setDetalhePetId(pet.petId)}
                  onAvaliar={(item) => setAvaliar(item)}
                />
              ))}
            </ul>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl bg-[#7828c8] p-5 text-white shadow-md shadow-[#7828c8]/25">
            <ShieldCheck className="size-8" />
            <h3 className="mt-3 text-base font-semibold">Mantenha a saúde do seu pet em dia!</h3>
            <ul className="mt-3 space-y-2 text-sm text-white/90">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> Acompanhe doses aplicadas
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> Veja o que está vencido
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> Avalie a clínica após a aplicação
              </li>
            </ul>
          </div>
          <div className="rounded-3xl border border-[#ebe4f4] bg-white p-4 text-sm text-[#6e6680]">
            <PawPrint className="size-5 text-[#7828c8]" />
            <p className="mt-2">Dúvidas sobre as vacinas? Fale com a clínica pelo chat ou agenda um horário.</p>
          </div>
        </aside>
      </div>

      <Modal
        open={detalhe != null}
        title={detalhe ? `Vacinações · ${detalhe.nome}` : "Vacinações"}
        onClose={() => setDetalhePetId(null)}
        wide
      >
        {detalhe ? (
          <div className="space-y-3">
            {detalhe.doses.map((dose) => {
              const pendente = vacinasPendentes.find((p) => Number(p.origemId) === Number(dose.id));
              const atrasada = dose.proxima ? new Date(`${dose.proxima}T12:00:00`) < new Date() : false;
              return (
                <div key={dose.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ebe4f4] p-4">
                  <div>
                    <p className="font-semibold text-[#1f1630]">{dose.vacina}</p>
                    <p className="text-sm text-muted">Aplicada em {dose.aplicacao}</p>
                    {dose.proxima ? (
                      <p className={`text-sm ${atrasada ? "text-danger" : "text-brand"}`}>
                        {atrasada ? "Dose atrasada" : "Próxima dose"}: {dose.proxima}
                      </p>
                    ) : null}
                  </div>
                  {pendente ? (
                    <Button type="button" onClick={() => setAvaliar(pendente)}>
                      Avaliar clínica
                    </Button>
                  ) : (
                    <span className="text-xs font-medium text-[#8b7fa3]">Já avaliada ou indisponível</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </Modal>

      <AvaliarClinicaModal item={avaliar} onClose={() => setAvaliar(null)} />
    </div>
  );
}

type PetVacinaGrupo = {
  petId: number;
  nome: string;
  fotoUrl?: string | null;
  sexo?: string | null;
  especie?: string | null;
  raca?: string | null;
  status: "em_dia" | "proxima" | "vencida";
  proximaDose: string | null;
  aplicadas: number;
  total: number;
  chips: { nome: string; estado: "ok" | "pendente" | "vencida" }[];
  doses: VaccinationRow[];
  pendentes: AvaliacaoPendente[];
};

function agruparVacinasPorPet(rows: VaccinationRow[], pendentes: AvaliacaoPendente[]): PetVacinaGrupo[] {
  const map = new Map<number, VaccinationRow[]>();
  for (const row of rows) {
    const list = map.get(row.petId) ?? [];
    list.push(row);
    map.set(row.petId, list);
  }
  const hoje = startOfDay(new Date());
  return [...map.entries()].map(([petId, doses]) => {
    const first = doses[0];
    const byVacina = new Map<string, VaccinationRow>();
    for (const dose of doses) {
      const atual = byVacina.get(dose.vacina);
      if (!atual || new Date(dose.aplicacao) > new Date(atual.aplicacao)) byVacina.set(dose.vacina, dose);
    }
    const chips = [...byVacina.values()].map((dose) => {
      if (dose.proxima && new Date(`${dose.proxima}T12:00:00`) < hoje) {
        return { nome: dose.vacina, estado: "vencida" as const };
      }
      if (dose.proxima) return { nome: dose.vacina, estado: "pendente" as const };
      return { nome: dose.vacina, estado: "ok" as const };
    });
    const temVencida = chips.some((chip) => chip.estado === "vencida");
    const temPendente = chips.some((chip) => chip.estado === "pendente");
    const status = temVencida ? "vencida" : temPendente ? "proxima" : "em_dia";
    const proximas = doses
      .map((dose) => dose.proxima)
      .filter((value): value is string => Boolean(value))
      .sort();
    const petPendentes = pendentes.filter((p) => doses.some((dose) => Number(dose.id) === Number(p.origemId)));
    return {
      petId,
      nome: first.pet,
      fotoUrl: first.fotoUrl,
      sexo: first.sexo,
      especie: first.especie,
      raca: first.raca,
      status,
      proximaDose: proximas[0] ?? null,
      aplicadas: chips.filter((chip) => chip.estado === "ok").length,
      total: Math.max(chips.length, 1),
      chips,
      doses,
      pendentes: petPendentes,
    };
  });
}

function VacinaPetCard({
  pet,
  onDetalhes,
  onAvaliar,
}: {
  pet: PetVacinaGrupo;
  onDetalhes: () => void;
  onAvaliar: (item: AvaliacaoPendente) => void;
}) {
  const simbolo = pet.sexo === "M" ? "♂" : pet.sexo === "F" ? "♀" : "";
  const statusTone =
    pet.status === "vencida"
      ? "bg-red-50 text-red-700"
      : pet.status === "em_dia"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-[#f3eafc] text-[#7828c8]";
  const statusLabel = pet.status === "vencida" ? "Vencida" : pet.status === "em_dia" ? "Em dia" : "Próxima dose";

  return (
    <li className="rounded-3xl border border-[#ebe4f4] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center">
          <PetPhoto especie={pet.especie} seed={pet.petId} src={pet.fotoUrl} className="size-16 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-[#1f1630]">
                {pet.nome}
                {simbolo ? <span className="ml-1 text-[#7828c8]">{simbolo}</span> : null}
              </h3>
              <span className="text-sm text-[#7a738c]">{pet.raca || pet.especie || "Pet"}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone}`}>
                {statusLabel}
              </span>
              {pet.proximaDose ? (
                <span className="inline-flex items-center gap-1 text-xs text-[#6e6680]">
                  <CalendarDays className="size-3.5 text-[#7828c8]" />
                  {pet.proximaDose}
                </span>
              ) : null}
              <span className="text-xs text-[#8b7fa3]">
                Doses aplicadas: {pet.aplicadas}/{pet.total}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {pet.chips.map((chip) => (
                <span
                  key={chip.nome}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    chip.estado === "ok"
                      ? "bg-emerald-50 text-emerald-700"
                      : chip.estado === "vencida"
                        ? "bg-red-50 text-red-700"
                        : "bg-[#f3eafc] text-[#5c4d78]"
                  }`}
                >
                  {chip.estado === "ok" ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />}
                  {chip.nome}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pet.pendentes.map((item) => (
            <Button key={`${item.origem}-${item.origemId}`} type="button" className="!rounded-full" onClick={() => onAvaliar(item)}>
              Avaliar clínica
            </Button>
          ))}
          {pet.status === "vencida" ? (
            <Button type="button" className="!rounded-full" onClick={onDetalhes}>
              Reagendar
            </Button>
          ) : (
            <Button type="button" variant="secondary" className="!rounded-full" onClick={onDetalhes}>
              <CalendarDays className="size-4" />
              Ver detalhes
            </Button>
          )}
          <button type="button" aria-label="Mais opções" className="inline-flex size-9 items-center justify-center rounded-full text-[#9a90b0] hover:bg-[#f3eafc]">
            <MoreVertical className="size-4" />
          </button>
        </div>
      </div>
    </li>
  );
}


