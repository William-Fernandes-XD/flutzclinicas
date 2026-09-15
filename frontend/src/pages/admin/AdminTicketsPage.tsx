import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { EmptyState, LoadingState } from "../../components/ui/EmptyState";
import { Surface, Textarea } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { api, type SupportTicket } from "../../services/api";
import { useToast } from "../../providers/ToastProvider";

function when(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(status: string): string {
  if (status === "ABERTO") return "Aberto";
  if (status === "EM_ANDAMENTO") return "Em andamento";
  if (status === "RESOLVIDO") return "Resolvido";
  return status;
}

export function AdminTicketsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const tickets = useQuery({ queryKey: ["admin", "tickets"], queryFn: api.supportTickets });

  const status = useMutation({
    mutationFn: ({ id, next }: { id: number; next: string }) => api.atualizarStatusTicket(id, next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tickets"] });
      toast.push("Status do ticket atualizado.");
    },
  });

  if (tickets.isLoading) return <LoadingState label="Carregando pedidos de suporte…" />;
  const rows = tickets.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suporte"
        description="Pedidos enviados por tutores e clínicas. Ao avançar o status, a clínica deixa de poder editar o ticket."
      />
      {rows.length === 0 ? (
        <EmptyState title="Nenhum ticket ainda" description="Quando alguém pedir ajuda pelo suporte, o pedido aparece aqui." />
      ) : (
        <DataTable
          rows={rows}
          exportTitle="Suporte Flutz"
          exportColumns={[
            { header: "Quando", value: (row) => when(row.criadoEm) },
            { header: "Origem", value: (row) => row.origem },
            { header: "Nome", value: (row) => row.nome },
            { header: "E-mail", value: (row) => row.email },
            { header: "Clínica", value: (row) => row.clinica },
            { header: "Motivo", value: (row) => row.motivo },
            { header: "Mensagem", value: (row) => row.mensagem },
            { header: "Status", value: (row) => statusLabel(row.status) },
          ]}
          columns={[
            { key: "quando", header: "Quando", cell: (row) => when(row.criadoEm) },
            { key: "origem", header: "Origem", cell: (row) => row.origem },
            { key: "nome", header: "Nome", cell: (row) => <span className="font-medium">{row.nome}</span> },
            { key: "email", header: "E-mail", cell: (row) => row.email },
            { key: "clinica", header: "Clínica", cell: (row) => row.clinica ?? "—" },
            { key: "motivo", header: "Motivo", cell: (row) => row.motivo },
            { key: "resposta", header: "Resposta", cell: (row) => row.resposta ?? "—" },
            { key: "status", header: "Status", cell: (row) => statusLabel(row.status) },
            {
              key: "acoes",
              header: "Ações",
              cell: (row) => (
                <div className="flex flex-wrap gap-1">
                  <TicketResponseButton ticket={row} />
                  {row.status !== "EM_ANDAMENTO" ? (
                    <Button
                      variant="secondary"
                      className="!min-h-8 !px-2 !text-xs"
                      busy={status.isPending}
                      onClick={() => status.mutate({ id: row.id, next: "EM_ANDAMENTO" })}
                    >
                      Em andamento
                    </Button>
                  ) : null}
                  {row.status !== "RESOLVIDO" ? (
                    <Button
                      variant="secondary"
                      className="!min-h-8 !px-2 !text-xs"
                      busy={status.isPending}
                      onClick={() => status.mutate({ id: row.id, next: "RESOLVIDO" })}
                    >
                      Resolver
                    </Button>
                  ) : null}
                  {row.status !== "ABERTO" ? (
                    <Button
                      variant="ghost"
                      className="!min-h-8 !px-2 !text-xs"
                      busy={status.isPending}
                      onClick={() => status.mutate({ id: row.id, next: "ABERTO" })}
                    >
                      Reabrir
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ]}
          mobile={(row: SupportTicket) => (
            <Surface>
              <p className="text-xs text-muted">
                {when(row.criadoEm)} · {row.origem} · {statusLabel(row.status)}
              </p>
              <p className="mt-1 font-semibold">{row.motivo}</p>
              <p className="mt-1 text-sm">
                {row.nome} · {row.email}
              </p>
              {row.clinica ? <p className="text-sm text-muted">{row.clinica}</p> : null}
              <p className="mt-3 text-sm leading-relaxed text-muted">{row.mensagem}</p>
              {row.resposta ? (
                <div className="mt-3 rounded-xl bg-brand-soft p-3 text-sm">
                  <p className="font-semibold">Resposta enviada</p>
                  <p className="mt-1 whitespace-pre-wrap">{row.resposta}</p>
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <TicketResponseButton ticket={row} />
                {row.status !== "EM_ANDAMENTO" ? (
                  <Button
                    variant="secondary"
                    className="!min-h-8 !px-2 !text-xs"
                    onClick={() => status.mutate({ id: row.id, next: "EM_ANDAMENTO" })}
                  >
                    Em andamento
                  </Button>
                ) : null}
                {row.status !== "RESOLVIDO" ? (
                  <Button
                    variant="secondary"
                    className="!min-h-8 !px-2 !text-xs"
                    onClick={() => status.mutate({ id: row.id, next: "RESOLVIDO" })}
                  >
                    Resolver
                  </Button>
                ) : null}
              </div>
            </Surface>
          )}
        />
      )}
    </div>
  );
}

function TicketResponseButton({ ticket }: { ticket: SupportTicket }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [resposta, setResposta] = useState(ticket.resposta ?? "");
  const responder = useMutation({
    mutationFn: () => api.responderTicket(ticket.id, resposta.trim(), "RESOLVIDO"),
    onSuccess: async () => {
      setOpen(false);
      toast.push("Resposta enviada à clínica.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "tickets"] });
    },
  });

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className="!min-h-8 !px-2 !text-xs"
        onClick={() => {
          setResposta(ticket.resposta ?? "");
          setOpen(true);
        }}
      >
        Responder
      </Button>
      <Modal open={open} title={`Responder ticket #${ticket.id}`} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <Textarea
            value={resposta}
            onChange={(event) => setResposta(event.target.value)}
            rows={7}
            maxLength={8000}
            placeholder="Escreva a resposta para a clínica…"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              busy={responder.isPending}
              busyLabel="Enviando…"
              disabled={!resposta.trim()}
              onClick={() => responder.mutate()}
            >
              Responder e resolver
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
