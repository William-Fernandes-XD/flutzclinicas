import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bug,
  CheckCircle2,
  CreditCard,
  HelpCircle,
  Lightbulb,
  LifeBuoy,
  MessageSquareHeart,
  Pencil,
  SendHorizontal,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ErrorState, LoadingState } from "../../components/ui/EmptyState";
import { Field, Input, Textarea } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { HttpError } from "../../lib/http";
import { api, type MySupportTicket } from "../../services/api";
import { useToast } from "../../providers/ToastProvider";

const MOTIVOS: {
  id: string;
  label: string;
  hint: string;
  Icon: LucideIcon;
}[] = [
  { id: "sugestao", label: "Sugestão", hint: "Ideia para melhorar o Flutz", Icon: Lightbulb },
  { id: "duvida", label: "Dúvida", hint: "Como usar alguma função", Icon: HelpCircle },
  { id: "problema", label: "Problema técnico", hint: "Algo não está funcionando", Icon: Bug },
  { id: "cobranca", label: "Cobrança", hint: "Mensalidade, fatura ou plano", Icon: CreditCard },
  { id: "elogio", label: "Elogio", hint: "Conte o que está gostando", Icon: MessageSquareHeart },
  { id: "outro", label: "Outro", hint: "Descreva o motivo abaixo", Icon: Sparkles },
];

function when(value: string): string {
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

function statusMeta(status: string): { text: string; tone: "ok" | "info" | "warn" | "neutral" } {
  const value = status.toUpperCase();
  if (value === "RESOLVIDO") return { text: "Resolvido", tone: "ok" };
  if (value === "EM_ANDAMENTO") return { text: "Em andamento", tone: "info" };
  if (value === "ABERTO") return { text: "Aberto", tone: "warn" };
  return { text: status, tone: "neutral" };
}

export function ClinicSupportPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [motivoId, setMotivoId] = useState(MOTIVOS[0].id);
  const [motivoOutro, setMotivoOutro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [error, setError] = useState("");

  const tickets = useQuery({ queryKey: ["clinica", "suporte"], queryFn: api.meusTickets });

  const motivoSelecionado = useMemo(
    () => MOTIVOS.find((item) => item.id === motivoId) ?? MOTIVOS[0],
    [motivoId],
  );

  const enviar = useMutation({
    mutationFn: () => {
      const motivo =
        motivoId === "outro"
          ? motivoOutro.trim()
          : `${motivoSelecionado.label}${motivoOutro.trim() ? ` — ${motivoOutro.trim()}` : ""}`;
      return api.abrirTicket({ motivo, mensagem: mensagem.trim() });
    },
    meta: { skipErrorToast: true },
    onSuccess: async () => {
      setMensagem("");
      setMotivoOutro("");
      setMotivoId(MOTIVOS[0].id);
      setError("");
      toast.push("Solicitação enviada. Em breve retornamos por e-mail.");
      await queryClient.invalidateQueries({ queryKey: ["clinica", "suporte"] });
    },
    onError: (err) => {
      setError(err instanceof HttpError ? err.message : "Não foi possível enviar a solicitação.");
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (motivoId === "outro" && !motivoOutro.trim()) {
      setError("Descreva o motivo da solicitação.");
      return;
    }
    if (!mensagem.trim()) {
      setError("Escreva a mensagem para a administração do Flutz.");
      return;
    }
    enviar.mutate();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Suporte Flutz"
        description="Fale com a administração da plataforma. A resposta chega no e-mail da sua conta."
      />

      <section className="relative overflow-hidden rounded-[1.75rem] border border-brand/15 bg-gradient-to-br from-brand-soft via-white to-violet-50/80 p-6 sm:p-8 dark:from-brand/20 dark:via-zinc-950 dark:to-zinc-900">
        <div className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-brand/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 size-40 rounded-full bg-violet-300/20 blur-3xl dark:bg-violet-500/10" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/30">
              <LifeBuoy className="size-7" />
            </span>
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-brand uppercase">Canal direto</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-ink sm:text-2xl dark:text-white">
                Estamos aqui para ajudar
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
                Sugestões, dúvidas, problemas técnicos ou cobrança — envie com clareza e acompanhe o status das
                solicitações recentes.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="living-card overflow-hidden">
        <div className="border-b border-line px-5 py-4 sm:px-6 dark:border-zinc-800">
          <p className="text-xs font-bold tracking-[0.16em] text-brand uppercase">Enviar nova solicitação</p>
          <p className="mt-1 text-sm text-muted">Escolha um motivo e conte o que precisa.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 p-5 sm:p-6">
          <div>
            <p className="mb-3 text-sm font-semibold text-ink dark:text-white">Motivo</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {MOTIVOS.map(({ id, label, hint, Icon }) => {
                const active = motivoId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMotivoId(id)}
                    className={`group flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                      active
                        ? "border-brand bg-brand-soft/80 ring-2 ring-brand/25 shadow-sm"
                        : "border-line bg-white hover:border-brand/40 hover:bg-brand-soft/40 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                    }`}
                  >
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition ${
                        active ? "bg-brand text-white" : "bg-brand-soft text-brand group-hover:bg-brand group-hover:text-white"
                      }`}
                    >
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink dark:text-white">{label}</span>
                      <span className="mt-0.5 block text-xs text-muted">{hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {motivoId === "outro" || motivoId === "sugestao" ? (
            <Field
              label={motivoId === "outro" ? "Descreva o motivo" : "Título da sugestão (opcional)"}
              hint={motivoId === "outro" ? "Obrigatório quando o motivo é Outro." : undefined}
            >
              <Input
                value={motivoOutro}
                onChange={(event) => setMotivoOutro(event.target.value)}
                maxLength={180}
                placeholder={motivoId === "outro" ? "Ex.: Integração com WhatsApp" : "Ex.: Filtro na agenda por sala"}
                required={motivoId === "outro"}
              />
            </Field>
          ) : null}

          <Field label="Mensagem">
            <Textarea
              value={mensagem}
              onChange={(event) => setMensagem(event.target.value)}
              required
              maxLength={4000}
              rows={6}
              placeholder="Conte o contexto, o que já tentou e o que espera como retorno…"
            />
          </Field>

          {error ? <ErrorState message={error} /> : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">A administração do Flutz responde pelo e-mail da sua conta.</p>
            <Button type="submit" busy={enviar.isPending} busyLabel="Enviando…">
              <SendHorizontal className="size-4" />
              Enviar solicitação
            </Button>
          </div>
        </form>
      </section>

      <section className="living-card overflow-hidden">
        <div className="flex items-end justify-between gap-3 border-b border-line px-5 py-4 sm:px-6 dark:border-zinc-800">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-brand uppercase">Últimas solicitações</p>
            <p className="mt-1 text-sm text-muted">Histórico recente com o suporte Flutz.</p>
          </div>
          {tickets.data?.length ? (
            <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand">
              {tickets.data.length}
            </span>
          ) : null}
        </div>

        <div className="p-5 sm:p-6">
          {tickets.isLoading ? (
            <LoadingState label="Carregando solicitações…" />
          ) : tickets.isError ? (
            <ErrorState
              message={
                tickets.error instanceof HttpError
                  ? tickets.error.message
                  : "Não foi possível carregar as solicitações."
              }
            />
          ) : !(tickets.data ?? []).length ? (
            <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                <CheckCircle2 className="size-7" />
              </span>
              <p className="font-semibold text-ink dark:text-white">Nenhuma solicitação ainda</p>
              <p className="max-w-sm text-sm text-muted">
                Quando você enviar um pedido acima, ele aparece aqui com o status atualizado.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {(tickets.data ?? []).map((item) => (
                <TicketCard key={item.id} item={item} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function TicketCard({ item }: { item: MySupportTicket }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const status = statusMeta(item.status);
  const aberto = item.status.toUpperCase() === "ABERTO";
  const [editing, setEditing] = useState(false);
  const [motivo, setMotivo] = useState(item.motivo);
  const [mensagem, setMensagem] = useState(item.mensagem);
  const [error, setError] = useState("");

  const editar = useMutation({
    mutationFn: () => api.editarTicket(item.id, { motivo: motivo.trim(), mensagem: mensagem.trim() }),
    meta: { skipErrorToast: true },
    onSuccess: async () => {
      toast.push("Solicitação atualizada.");
      setEditing(false);
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["clinica", "suporte"] });
    },
    onError: (err) => {
      setError(err instanceof HttpError ? err.message : "Não foi possível editar.");
    },
  });

  const excluir = useMutation({
    mutationFn: () => api.excluirTicket(item.id),
    meta: { skipErrorToast: true },
    onSuccess: async () => {
      toast.push("Solicitação excluída.");
      await queryClient.invalidateQueries({ queryKey: ["clinica", "suporte"] });
    },
    onError: (err) => {
      toast.push(err instanceof HttpError ? err.message : "Não foi possível excluir.", "danger");
    },
  });

  return (
    <li className="rounded-2xl border border-line bg-gradient-to-br from-white to-zinc-50/80 p-4 transition hover:border-brand/30 dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-ink dark:text-white">{item.motivo}</p>
            <Badge tone={status.tone}>{status.text}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">{when(item.criadoEm)}</p>
        </div>
        <div className="flex items-center gap-2">
          {aberto ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setMotivo(item.motivo);
                  setMensagem(item.mensagem);
                  setError("");
                  setEditing(true);
                }}
              >
                <Pencil className="size-4" />
                Editar
              </Button>
              <Button
                type="button"
                variant="ghost"
                busy={excluir.isPending}
                busyLabel="Excluindo…"
                onClick={() => {
                  if (window.confirm("Excluir esta solicitação aberta?")) excluir.mutate();
                }}
              >
                <Trash2 className="size-4" />
                Excluir
              </Button>
            </>
          ) : null}
          <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">#{item.id}</span>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-muted">{item.mensagem}</p>
      {item.resposta ? (
        <div className="mt-4 rounded-2xl border border-brand/20 bg-brand-soft/60 p-4">
          <p className="text-xs font-bold tracking-wide text-brand uppercase">Resposta do suporte</p>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-ink dark:text-white">{item.resposta}</p>
          {item.respondidoEm ? <p className="mt-2 text-xs text-muted">Respondido em {when(item.respondidoEm)}</p> : null}
        </div>
      ) : null}

      <Modal open={editing} title="Editar solicitação" onClose={() => setEditing(false)}>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!motivo.trim() || !mensagem.trim()) {
              setError("Preencha motivo e mensagem.");
              return;
            }
            editar.mutate();
          }}
        >
          <Field label="Motivo">
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={180} required />
          </Field>
          <Field label="Mensagem">
            <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} maxLength={4000} rows={5} required />
          </Field>
          {error ? <ErrorState message={error} /> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button type="submit" busy={editar.isPending} busyLabel="Salvando…">
              Salvar
            </Button>
          </div>
        </form>
      </Modal>
    </li>
  );
}
