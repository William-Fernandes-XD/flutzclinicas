import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BookingPaymentModal } from "../BookingPaymentModal";
import { statusAgenda, tomStatus, podeCancelarAgendamento } from "../../lib/agenda";
import { http, HttpError } from "../../lib/http";
import { api } from "../../services/api";
import { useToast } from "../../providers/ToastProvider";
import { PetPhoto } from "../clinic/PanelHero";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ErrorState } from "../ui/EmptyState";
import { Field, Input, Select } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { appointmentLabel, type AgendaItemView } from "./AppointmentBlock";

function localValue(date: Date): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${z(date.getMonth() + 1)}-${z(date.getDate())}T${z(date.getHours())}:${z(date.getMinutes())}`;
}

function money(value: number | null | undefined): string {
  if (value == null) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

export function AppointmentDetailModal({
  item,
  clinicMode,
  onClose,
  onSaved,
}: {
  item: AgendaItemView | null;
  clinicMode: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const equipe = useQuery({
    queryKey: ["equipe"],
    queryFn: () => http<{ id: number; nome: string }[]>("/api/equipe"),
    enabled: clinicMode && Boolean(item),
  });
  const acao = useMutation({
    mutationFn: ({ nome, body }: { nome: string; body?: Record<string, unknown> }) =>
      api.agendaAcao(item!.id, nome, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agenda-solicitacoes"] });
      await queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      toast.push("Agendamento atualizado.");
      setError("");
      onSaved?.();
      onClose();
    },
    onError: (err) => {
      setError(err instanceof HttpError ? err.message : "Não foi possível atualizar o horário");
    },
  });
  const concluir = useMutation({
    mutationFn: () => api.agendaConcluir(item!.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agenda-solicitacoes"] });
      await queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      toast.push("Atendimento concluído.");
      setError("");
      onSaved?.();
      onClose();
    },
    onError: (err) => {
      setError(err instanceof HttpError ? err.message : "Não foi possível concluir o atendimento");
    },
  });

  if (!item) return null;

  const inicio = new Date(item.inicio);
  const fimPadrao = item.fim ? new Date(item.fim) : new Date(inicio.getTime() + 30 * 60 * 1000);
  const codigo = (item.statusCodigo ?? "").toUpperCase();
  const podeEditar = clinicMode && ["SOLICITADO", "CONFIRMADO"].includes(codigo);
  const podeCancelar = podeCancelarAgendamento(codigo, item.inicio);
  const podeConcluir = clinicMode && codigo === "CONFIRMADO";
  const podePagar = !clinicMode && codigo === "AGUARDANDO_PAGAMENTO";
  const acaoSalvar = codigo === "CONFIRMADO" ? "reatribuir" : "confirmar";

  return (
    <>
      <Modal
        open={!payOpen}
        wide
        title={`${item.pet} · ${inicio.toLocaleString("pt-BR")}`}
        onClose={() => {
          setError("");
          onClose();
        }}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            {podeCancelar ? (
              <Button
                type="button"
                variant="ghost"
                busy={acao.isPending}
                busyLabel="Cancelando…"
                onClick={() =>
                  acao.mutate({
                    nome: "cancelar",
                    body: { motivo: clinicMode ? "Cancelado pela clínica" : "Cancelado pelo tutor" },
                  })
                }
              >
                Cancelar atendimento
              </Button>
            ) : null}
            {podePagar ? (
              <Button type="button" onClick={() => setPayOpen(true)}>
                Pagar agora
              </Button>
            ) : null}
            {podeConcluir ? (
              <Button type="button" busy={concluir.isPending} busyLabel="Concluindo…" onClick={() => concluir.mutate()}>
                Concluir atendimento
              </Button>
            ) : null}
            {podeEditar && codigo === "SOLICITADO" ? (
              <Button type="submit" form="agenda-detalhe" busy={acao.isPending} busyLabel="Salvando…">
                Confirmar atendimento
              </Button>
            ) : null}
            {podeEditar && codigo === "CONFIRMADO" ? (
              <Button type="submit" form="agenda-detalhe" variant="secondary" busy={acao.isPending} busyLabel="Salvando…">
                Salvar alterações
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="mb-4 flex items-center gap-3">
          <PetPhoto
            especie={item.especie}
            seed={item.petId ?? item.id}
            src={item.fotoUrl}
            className="size-14 rounded-full"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-brand uppercase">{appointmentLabel(item)}</p>
            <p className="font-semibold">{item.pet}</p>
            <p className="text-sm text-muted">
              {item.tutor}
              {item.clinica ? ` · ${item.clinica}` : ""}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone={tomStatus(codigo || item.status)}>{statusAgenda(codigo, item.status)}</Badge>
              {item.valorCobrado != null ? <span className="text-xs font-semibold text-brand">{money(item.valorCobrado)}</span> : null}
            </div>
          </div>
        </div>

        {codigo === "AGUARDANDO_PAGAMENTO" ? (
          <p className="mb-4 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {clinicMode
              ? "Aguardando o tutor concluir o pagamento. Clínica ou tutor podem cancelar neste status a qualquer momento."
              : "Pagamento pendente. Você pode pagar agora ou cancelar o agendamento a qualquer momento enquanto estiver aguardando o pagamento."}
          </p>
        ) : null}
        {codigo === "CONFIRMADO" && !podeCancelar ? (
          <p className="mb-4 rounded-2xl bg-zinc-50 px-3 py-2 text-sm text-muted dark:bg-zinc-800">
            Cancelamento disponível somente com pelo menos 1 dia útil de antecedência.
          </p>
        ) : null}

        {podeEditar ? (
          <form
            id="agenda-detalhe"
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              setError("");
              acao.mutate({
                nome: acaoSalvar,
                body: {
                  colaboradorId: Number(data.get("colaboradorId")),
                  dataHoraFim: new Date(String(data.get("fim"))).toISOString(),
                },
              });
            }}
          >
            <Field label="Profissional que vai atender">
              <Select name="colaboradorId" required defaultValue={item.colaboradorId ?? ""}>
                <option value="">Selecione</option>
                {(equipe.data ?? []).map((pessoa) => (
                  <option key={pessoa.id} value={pessoa.id}>
                    {pessoa.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Término do serviço">
              <Input name="fim" type="datetime-local" required defaultValue={localValue(fimPadrao)} />
            </Field>
            {error ? (
              <div className="sm:col-span-2">
                <ErrorState message={error} />
              </div>
            ) : null}
          </form>
        ) : (
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-muted">Profissional:</span> {item.colaborador ?? "Não definido"}
            </p>
            {error ? <ErrorState message={error} /> : null}
          </div>
        )}
      </Modal>

      {payOpen ? (
        <BookingPaymentModal
          agendamentoId={item.id}
          onPaid={async () => {
            setPayOpen(false);
            await queryClient.invalidateQueries({ queryKey: ["agenda-solicitacoes"] });
            await queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
            toast.push("Pagamento confirmado.");
            onSaved?.();
            onClose();
          }}
          onClose={() => setPayOpen(false)}
        />
      ) : null}
    </>
  );
}
