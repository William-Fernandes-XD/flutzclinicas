import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, UserRound } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { AgendaKanban } from "../../components/agenda/AgendaKanban";
import { AppointmentBlock, type AgendaItemView } from "../../components/agenda/AppointmentBlock";
import { AppointmentDetailModal } from "../../components/agenda/AppointmentDetailModal";
import { StaffDayBoard } from "../../components/agenda/StaffDayBoard";
import { PetPhoto } from "../../components/clinic/PanelHero";
import { TutorCpfPetPicker } from "../../components/clinic/TutorCpfPetPicker";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/EmptyState";
import { Field, FormSection, Input, Select, Surface, Textarea } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Tabs } from "../../components/ui/Tabs";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { http, HttpError } from "../../lib/http";
import { statusAgenda, tomStatus } from "../../lib/agenda";
import { api, type AgendaSolicitacao } from "../../services/api";
import { useToast } from "../../providers/ToastProvider";

type Item = AgendaItemView & { origem?: string };
type View = "dia" | "semana" | "mes" | "fluxo";
type Staff = { id: number; nome: string; cargo: string | null; fotoUrl?: string | null };

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function localValue(date: Date): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${z(date.getMonth() + 1)}-${z(date.getDate())}T${z(date.getHours())}:${z(date.getMinutes())}`;
}

function ativoAgenda(item: Item): boolean {
  const codigo = (item.statusCodigo ?? "").toUpperCase();
  if (codigo) {
    return ["SOLICITADO", "AGUARDANDO_PAGAMENTO", "CONFIRMADO", "AGUARDANDO_CLIENTE"].includes(codigo);
  }
  const status = item.status.toLowerCase();
  return !status.includes("cancel") && !status.includes("recus") && !status.includes("falt");
}

export function AgendaPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const deepId = searchParams.get("id");
  const [view, setView] = useState<View>("dia");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Item | null>(null);
  const [error, setError] = useState("");
  const agenda = useQuery({ queryKey: ["agendamentos"], queryFn: () => http<Item[]>("/api/agendamentos") });
  const solicitacoes = useQuery({ queryKey: ["agenda-solicitacoes"], queryFn: () => api.agendaSolicitacoes() });
  const equipe = useQuery({ queryKey: ["equipe"], queryFn: () => http<Staff[]>("/api/equipe") });
  const criar = useMutation({
    mutationFn: (body: Record<string, unknown>) => http("/api/agendamentos", { method: "POST", json: body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      queryClient.invalidateQueries({ queryKey: ["agenda-solicitacoes"] });
      setOpen(false);
      toast.push("Horário marcado.");
    },
  });

  const allItems = useMemo(() => {
    const fromAgenda = (agenda.data ?? []).map((item) => ({ ...item, when: new Date(item.inicio) }));
    const seen = new Set(fromAgenda.map((item) => item.id));
    const fromSolic = (solicitacoes.data ?? [])
      .filter((item) => !seen.has(item.id))
      .map((item) => ({
        ...item,
        when: new Date(item.inicio),
        valorCobrado: item.valorCobrado,
        valorServico: item.valorServico,
        codigoCupom: item.codigoCupom,
      }));
    return [...fromAgenda, ...fromSolic];
  }, [agenda.data, solicitacoes.data]);
  const activeItems = useMemo(() => allItems.filter((item) => ativoAgenda(item)), [allItems]);
  const dayItems = useMemo(
    () => activeItems.filter((item) => sameDay(item.when, cursor)),
    [activeItems, cursor],
  );

  useEffect(() => {
    if (!deepId) return;
    const id = Number(deepId);
    if (!Number.isFinite(id)) return;
    const fromAgenda = allItems.find((item) => item.id === id);
    if (fromAgenda) {
      setSelected(fromAgenda);
      setCursor(startOfDay(fromAgenda.when));
      return;
    }
    const fromSolic = (solicitacoes.data ?? []).find((item: AgendaSolicitacao) => item.id === id);
    if (fromSolic) {
      setSelected({
        ...fromSolic,
        when: new Date(fromSolic.inicio),
        status: fromSolic.status,
      } as Item);
      setCursor(startOfDay(new Date(fromSolic.inicio)));
    }
  }, [allItems, deepId, solicitacoes.data]);

  const days = useMemo(() => {
    if (view === "dia" || view === "fluxo") return [cursor];
    if (view === "semana") {
      const weekStart = new Date(cursor);
      weekStart.setDate(cursor.getDate() - cursor.getDay());
      return Array.from({ length: 7 }, (_, index) => {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + index);
        return day;
      });
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [cursor, view]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const petId = Number(data.get("petId"));
    const clienteId = Number(data.get("clienteId"));
    if (!clienteId || !petId) {
      setError("Busque o tutor pelo CPF e escolha um pet.");
      return;
    }
    setError("");
    try {
      await criar.mutateAsync({
        clienteId,
        petId,
        dataHoraInicio: new Date(String(data.get("inicio"))).toISOString(),
        observacoes: String(data.get("observacoes") ?? ""),
      });
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Falha ao agendar");
    }
  }

  if (agenda.isLoading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Agenda"
        description="Visão profissional da clínica: dia por equipe, semana, mês e fluxo Kanban. Clique em um horário para definir o profissional ou cancelar."
        actions={
          <>
            <ExportMenu
              filename="agenda"
              title="Agenda"
              columns={[
                { header: "Início", value: (row) => new Date(row.inicio).toLocaleString("pt-BR") },
                { header: "Pet", value: (row) => row.pet },
                { header: "Tutor", value: (row) => row.tutor },
                { header: "Profissional", value: (row) => row.colaborador ?? "A definir" },
                { header: "Status", value: (row) => row.status },
                { header: "Origem", value: (row) => row.origem },
              ]}
              rows={agenda.data ?? []}
            />
            <Button onClick={() => setOpen(true)}>+ Novo agendamento</Button>
          </>
        }
      />

      <div className="mb-5 flex min-w-0 flex-wrap items-center justify-between gap-3">
        <Tabs
          value={view}
          onChange={setView}
          items={[
            { id: "dia", label: "Dia" },
            { id: "semana", label: "Semana" },
            { id: "mes", label: "Mês" },
            { id: "fluxo", label: "Fluxo" },
          ]}
        />
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              setCursor((current) => {
                const next = new Date(current);
                next.setDate(current.getDate() - (view === "mes" ? 30 : view === "semana" ? 7 : 1));
                return next;
              })
            }
          >
            Anterior
          </Button>
          <Button variant="ghost" onClick={() => setCursor(startOfDay(new Date()))}>
            Hoje
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              setCursor((current) => {
                const next = new Date(current);
                next.setDate(current.getDate() + (view === "mes" ? 30 : view === "semana" ? 7 : 1));
                return next;
              })
            }
          >
            Próximo
          </Button>
        </div>
      </div>

      {view !== "fluxo" ? <CaixaSolicitacoes itens={solicitacoes.data ?? []} /> : null}

      {view === "dia" ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted">
            {cursor.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
          <StaffDayBoard
            staff={(equipe.data ?? []).map((member) => ({
              id: member.id,
              nome: member.nome,
              cargo: member.cargo,
              fotoUrl: member.fotoUrl,
            }))}
            items={dayItems}
            onSelect={(item) => setSelected(item as Item)}
          />
        </div>
      ) : null}

      {view === "fluxo" ? (
        <AgendaKanban items={allItems} onSelect={(item) => setSelected(item as Item)} />
      ) : null}

      {view === "mes" ? (
        <div className="grid grid-cols-7 gap-2">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((label, index) => (
            <p key={`${label}-${index}`} className="text-center text-xs font-semibold text-muted">
              {label}
            </p>
          ))}
          {days.map((day) => {
            const dayList = activeItems.filter((item) => sameDay(item.when, day));
            const outside = day.getMonth() !== cursor.getMonth();
            return (
              <Surface key={day.toISOString()} className={`min-h-24 p-2 ${outside ? "opacity-50" : ""}`}>
                <p className="text-xs font-semibold">{day.getDate()}</p>
                {dayList.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="mt-1 block w-full truncate text-left text-[11px] hover:text-brand"
                    onClick={() => setSelected(item)}
                  >
                    {item.pet}
                    {item.colaborador ? ` · ${item.colaborador}` : ""}
                  </button>
                ))}
              </Surface>
            );
          })}
        </div>
      ) : null}

      {view === "semana" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {days.slice(0, 6).map((day) => {
            const dayList = activeItems
              .filter((item) => sameDay(item.when, day))
              .sort((a, b) => a.when.getTime() - b.when.getTime());
            return (
              <Surface key={day.toISOString()} className="p-3">
                <p className="text-xs font-semibold text-muted">
                  {day.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                </p>
                {!dayList.length ? (
                  <p className="mt-3 text-xs text-muted">Livre</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {dayList.map((item) => (
                      <li key={item.id}>
                        <AppointmentBlock item={item} compact onClick={() => setSelected(item)} />
                      </li>
                    ))}
                  </ul>
                )}
              </Surface>
            );
          })}
          <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2">
            {days[6] ? (
              <Surface className="p-3">
                <p className="text-xs font-semibold text-muted">
                  {days[6].toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                </p>
                {(() => {
                  const dayList = activeItems
                    .filter((item) => sameDay(item.when, days[6]))
                    .sort((a, b) => a.when.getTime() - b.when.getTime());
                  if (!dayList.length) return <p className="mt-3 text-xs text-muted">Livre</p>;
                  return (
                    <ul className="mt-3 space-y-2">
                      {dayList.map((item) => (
                        <li key={item.id}>
                          <AppointmentBlock item={item} compact onClick={() => setSelected(item)} />
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </Surface>
            ) : null}
            <button
              type="button"
              onClick={() =>
                setCursor((current) => {
                  const next = new Date(current);
                  next.setDate(current.getDate() + 7);
                  return next;
                })
              }
              className="flex min-h-[7rem] flex-col items-center justify-center rounded-3xl border border-dashed border-[#d8cce8] bg-[#faf8fc] p-4 text-center transition hover:border-[#7828c8]/50 hover:bg-[#f3eafc]"
            >
              <p className="text-sm font-semibold text-[#7828c8]">Próximo…</p>
              <p className="mt-1 text-xs text-muted">Ver a semana seguinte</p>
            </button>
          </div>
        </div>
      ) : null}

      {view !== "fluxo" && !activeItems.length ? (
        <div className="mt-6">
          <EmptyState
            title="Nenhum horário marcado"
            description="Marque o primeiro compromisso para a equipe enxergar o dia."
            action={<Button onClick={() => setOpen(true)}>Novo agendamento</Button>}
          />
        </div>
      ) : null}

      <Modal
        open={open}
        title="Novo agendamento"
        description="Preencha os dados abaixo para agendar um atendimento."
        icon={<CalendarDays className="size-5" aria-hidden />}
        onClose={() => {
          setOpen(false);
          setError("");
        }}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setError("");
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" form="agenda-form" busy={criar.isPending} busyLabel="Marcando…">
              <CalendarDays className="size-4" />
              Marcar agendamento
            </Button>
          </div>
        }
      >
        <form id="agenda-form" onSubmit={onSubmit} className="grid gap-5">
          <FormSection
            title="Quem"
            description="Informe o CPF do tutor responsável pelos pets."
            icon={<UserRound className="size-4" aria-hidden />}
            columns={1}
          >
            <TutorCpfPetPicker />
          </FormSection>
          <FormSection
            title="Quando"
            description="Selecione a data e o horário do atendimento."
            icon={<CalendarDays className="size-4" aria-hidden />}
            columns={1}
          >
            <Field label="Início *">
              <Input name="inicio" type="datetime-local" required />
            </Field>
            <Field label="Observações (opcional)">
              <Textarea name="observacoes" placeholder="Ex: Anotar sintomas, preferências do tutor, etc." />
            </Field>
          </FormSection>
          {error ? <ErrorState message={error} /> : null}
        </form>
      </Modal>

      <AppointmentDetailModal
        item={selected}
        clinicMode
        onClose={() => setSelected(null)}
        onSaved={() => setSelected(null)}
      />
    </div>
  );
}

function CaixaSolicitacoes({ itens }: { itens: AgendaSolicitacao[] }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [proposta, setProposta] = useState<number | null>(null);
  const [erroLocal, setErroLocal] = useState("");
  const caixa = itens.filter((item) =>
    ["SOLICITADO", "AGUARDANDO_CLIENTE", "AGUARDANDO_PAGAMENTO"].includes(item.statusCodigo),
  );
  const acao = useMutation({
    mutationFn: ({ id, nome, body }: { id: number; nome: string; body?: Record<string, unknown> }) =>
      api.agendaAcao(id, nome, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agenda-solicitacoes"] });
      await queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      setProposta(null);
      setErroLocal("");
      toast.push("Solicitação atualizada.");
    },
    onError: (err) => {
      setErroLocal(err instanceof HttpError ? err.message : "Não foi possível atualizar a solicitação");
    },
  });
  if (!caixa.length) return null;
  return (
    <Surface className="mb-5">
      <h2 className="font-semibold">Solicitações para analisar</h2>
      {erroLocal ? (
        <div className="mt-3">
          <ErrorState message={erroLocal} />
        </div>
      ) : null}
      <ul className="mt-3 space-y-3">
        {caixa.map((item) => (
          <li key={item.id} className="rounded-2xl bg-brand-soft/50 p-3 ring-1 ring-brand/10 dark:bg-zinc-800">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-3">
                <PetPhoto
                  especie={item.especie}
                  seed={item.petId}
                  src={item.fotoUrl}
                  className="size-12 shrink-0 rounded-2xl"
                />
                <div>
                <p className="text-sm font-semibold">
                  {item.pet} · {item.tutor} ·{" "}
                  {item.tipo === "VACINACAO" ? item.vacina ?? "Vacina" : item.servico ?? "Atendimento"}
                </p>
                <p className="text-xs text-muted">{new Date(item.inicio).toLocaleString("pt-BR")}</p>
                <p className="text-xs text-brand">
                  {item.colaborador ? `Profissional: ${item.colaborador}` : "Profissional a definir"}
                </p>
                <Badge tone={tomStatus(item.statusCodigo)}>{statusAgenda(item.statusCodigo, item.status)}</Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {item.statusCodigo === "SOLICITADO" ? (
                  <>
                    <Button
                      variant="secondary"
                      busy={acao.isPending}
                      busyLabel="Recusando…"
                      onClick={() => acao.mutate({ id: item.id, nome: "recusar", body: { motivo: "Horário indisponível" } })}
                    >
                      Recusar
                    </Button>
                    <Button variant="ghost" onClick={() => setProposta(item.id)}>
                      Propor horário
                    </Button>
                  </>
                ) : item.statusCodigo === "AGUARDANDO_PAGAMENTO" ? (
                  <>
                    <p className="text-xs text-amber-800">Aguardando o tutor concluir o pagamento.</p>
                    <Button
                      variant="ghost"
                      busy={acao.isPending}
                      busyLabel="Cancelando…"
                      onClick={() =>
                        acao.mutate({
                          id: item.id,
                          nome: "cancelar",
                          body: { motivo: "Cancelado pela clínica enquanto aguardava pagamento" },
                        })
                      }
                    >
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <p className="text-xs text-muted">Aguardando o tutor responder a proposta.</p>
                )}
              </div>
            </div>
            {item.statusCodigo === "SOLICITADO" ? (
              <ConfirmarForm
                item={item}
                pending={acao.isPending}
                onConfirmar={(body) => acao.mutate({ id: item.id, nome: "confirmar", body })}
              />
            ) : null}
            {proposta === item.id ? (
              <form
                className="mt-3 flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  const inicio = new Date(String(data.get("inicio")));
                  acao.mutate({
                    id: item.id,
                    nome: "propor",
                    body: {
                      dataHoraInicio: inicio.toISOString(),
                      dataHoraFim: new Date(inicio.getTime() + 30 * 60 * 1000).toISOString(),
                      motivo: String(data.get("motivo") ?? ""),
                    },
                  });
                }}
              >
                <Field label="Novo início">
                  <Input name="inicio" type="datetime-local" required />
                </Field>
                <Field label="Motivo">
                  <Input name="motivo" />
                </Field>
                <Button type="submit" busy={acao.isPending} busyLabel="Enviando…">
                  Enviar proposta
                </Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </Surface>
  );
}

function ConfirmarForm({
  item,
  onConfirmar,
  pending,
}: {
  item: AgendaSolicitacao;
  onConfirmar: (body: Record<string, unknown>) => void;
  pending: boolean;
}) {
  const equipe = useQuery({ queryKey: ["equipe"], queryFn: () => http<{ id: number; nome: string }[]>("/api/equipe") });
  const inicio = new Date(item.inicio);
  const padraoFim = new Date(inicio.getTime() + 30 * 60 * 1000);
  return (
    <form
      className="mt-3 grid gap-2 sm:grid-cols-[1fr_12rem_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onConfirmar({
          colaboradorId: Number(data.get("colaboradorId")),
          dataHoraFim: new Date(String(data.get("fim"))).toISOString(),
        });
      }}
    >
      <Field label="Profissional que vai atender">
        <Select name="colaboradorId" required>
          <option value="">Selecione</option>
          {(equipe.data ?? []).map((pessoa) => (
            <option key={pessoa.id} value={pessoa.id}>
              {pessoa.nome}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Término do serviço">
        <Input name="fim" type="datetime-local" required defaultValue={localValue(padraoFim)} />
      </Field>
      <div className="flex items-end">
        <Button type="submit" busy={pending} busyLabel="Confirmando…">
          Confirmar e ocupar horário
        </Button>
      </div>
    </form>
  );
}
