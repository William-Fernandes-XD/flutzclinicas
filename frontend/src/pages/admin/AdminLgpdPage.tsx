import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState, LoadingState } from "../../components/ui/EmptyState";
import { Surface, Textarea } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { useToast } from "../../providers/ToastProvider";
import { api, type SolicitacaoLgpd, type StatusLgpd } from "../../services/api";

export function AdminLgpdPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [negando, setNegando] = useState<SolicitacaoLgpd | null>(null);
  const [motivo, setMotivo] = useState("");
  const solicitacoes = useQuery({ queryKey: ["admin", "lgpd"], queryFn: api.adminLgpdSolicitacoes });

  const status = useMutation({
    mutationFn: ({ id, proximo, motivoNegativa }: { id: number; proximo: StatusLgpd; motivoNegativa?: string }) =>
      api.atualizarStatusLgpd(id, proximo, motivoNegativa),
    onSuccess: async () => {
      setNegando(null);
      setMotivo("");
      toast.push("Solicitação LGPD atualizada.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "lgpd"] });
    },
  });

  const anonimizar = useMutation({
    mutationFn: (id: number) => api.anonimizarLgpd(id),
    onSuccess: async () => {
      toast.push("Titular anonimizado e solicitação concluída.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "lgpd"] });
    },
  });

  if (solicitacoes.isLoading) return <LoadingState label="Carregando solicitações LGPD…" />;
  const rows = solicitacoes.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Centro de Privacidade LGPD"
        description="Analise os pedidos dos titulares, acompanhe o prazo de 15 dias e registre a conclusão."
      />
      {rows.length === 0 ? (
        <EmptyState title="Fila vazia" description="Nenhuma solicitação LGPD foi registrada." />
      ) : (
        <div className="grid gap-4">
          {rows.map((item) => (
            <Surface key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldCheck className="size-5 text-brand" />
                    <h2 className="font-semibold">{tipoLabel(item.tipoSolicitacao)} #{item.id}</h2>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    {item.titularTipo} #{item.titularId}
                    {item.empresaId ? ` · Clínica #${item.empresaId}` : " · Plataforma"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Solicitada em {data(item.dataSolicitacao)} · Prazo limite {data(item.prazoLimite)}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {item.status === "ABERTA" ? (
                    <Button variant="secondary" onClick={() => status.mutate({ id: item.id, proximo: "EM_ANDAMENTO" })}>
                      Iniciar análise
                    </Button>
                  ) : null}
                  {!["CONCLUIDA", "NEGADA"].includes(item.status) ? (
                    <>
                      {["EXCLUSAO", "ANONIMIZACAO"].includes(item.tipoSolicitacao) ? (
                        <Button
                          busy={anonimizar.isPending}
                          busyLabel="Anonimizando…"
                          onClick={() => {
                            if (window.confirm("Anonimizar este titular? A conta será desativada e a ação não pode ser desfeita.")) {
                              anonimizar.mutate(item.id);
                            }
                          }}
                        >
                          Anonimizar
                        </Button>
                      ) : (
                        <Button onClick={() => status.mutate({ id: item.id, proximo: "CONCLUIDA" })}>
                          Concluir
                        </Button>
                      )}
                      <Button variant="ghost" onClick={() => setNegando(item)}>Negar</Button>
                    </>
                  ) : null}
                </div>
              </div>
              {item.detalhamento ? (
                <p className="mt-4 rounded-xl bg-zinc-50 p-3 text-sm whitespace-pre-wrap text-muted dark:bg-zinc-900">
                  {item.detalhamento}
                </p>
              ) : null}
              {item.motivoNegativa ? <p className="mt-3 text-sm text-red-700">Motivo da negativa: {item.motivoNegativa}</p> : null}
            </Surface>
          ))}
        </div>
      )}

      <Modal open={negando != null} title={`Negar solicitação #${negando?.id ?? ""}`} onClose={() => setNegando(null)}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (negando && motivo.trim()) {
              status.mutate({ id: negando.id, proximo: "NEGADA", motivoNegativa: motivo.trim() });
            }
          }}
        >
          <label className="grid gap-1.5 text-sm font-medium">
            Motivo da negativa
            <Textarea value={motivo} onChange={(event) => setMotivo(event.target.value)} required maxLength={4000} rows={5} />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setNegando(null)}>Cancelar</Button>
            <Button type="submit" busy={status.isPending} disabled={!motivo.trim()}>Registrar negativa</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function StatusBadge({ status }: { status: StatusLgpd }) {
  const meta = {
    ABERTA: ["Aberta", "warn"],
    EM_ANDAMENTO: ["Em andamento", "info"],
    CONCLUIDA: ["Concluída", "ok"],
    NEGADA: ["Negada", "danger"],
  }[status] as [string, "warn" | "info" | "ok" | "danger"];
  return <Badge tone={meta[1]}>{meta[0]}</Badge>;
}

function tipoLabel(tipo: string) {
  return tipo.replaceAll("_", " ").toLocaleLowerCase("pt-BR").replace(/^\p{L}/u, (letra) => letra.toUpperCase());
}

function data(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}
