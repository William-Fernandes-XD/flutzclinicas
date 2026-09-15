import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/EmptyState";
import { Surface } from "../../components/ui/Field";
import { PageHeader } from "../../components/ui/PageHeader";
import { HttpError } from "../../lib/http";
import { useToast } from "../../providers/ToastProvider";
import { api, type AdminAvaliacao } from "../../services/api";

function formatDate(value?: string | null): string {
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

export function AdminAvaliacoesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const lista = useQuery({ queryKey: ["admin", "avaliacoes"], queryFn: api.adminAvaliacoes });

  const visivel = useMutation({
    mutationFn: ({ id, next }: { id: number; next: boolean }) => api.setAdminAvaliacaoVisivel(id, next),
    onSuccess: async (_, vars) => {
      toast.push(vars.next ? "Avaliação publicada." : "Avaliação ocultada.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "avaliacoes"] });
    },
  });

  const excluir = useMutation({
    mutationFn: (id: number) => api.deleteAdminAvaliacao(id),
    onSuccess: async () => {
      toast.push("Avaliação desativada.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "avaliacoes"] });
    },
  });

  if (lista.isLoading) return <LoadingState label="Carregando avaliações…" />;
  if (lista.isError) {
    return (
      <ErrorState message={lista.error instanceof HttpError ? lista.error.message : "Falha ao listar avaliações"} />
    );
  }

  const rows = (lista.data ?? []).filter((row) => (row.status ?? "").toLowerCase() !== "inativo");

  function Actions({ row }: { row: AdminAvaliacao }) {
    return (
      <div className="flex flex-wrap gap-2">
        {row.autorizado ? (
          <Button
            type="button"
            variant="secondary"
            busy={visivel.isPending && visivel.variables?.id === row.id}
            busyLabel="Atualizando…"
            onClick={() => visivel.mutate({ id: row.id, next: !row.visivel })}
          >
            {row.visivel ? "Ocultar" : "Publicar"}
          </Button>
        ) : (
          <span className="text-xs text-muted">Sem autorização</span>
        )}
        <Button
          type="button"
          variant="ghost"
          busy={excluir.isPending && excluir.variables === row.id}
          busyLabel="Excluindo…"
          onClick={() => {
            if (window.confirm("Desativar esta avaliação?")) excluir.mutate(row.id);
          }}
        >
          Excluir
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Moderação"
        title="Avaliações"
        description="Liste, publique, oculte ou desative depoimentos recentes das clínicas."
      />
      {!rows.length ? (
        <EmptyState title="Nenhuma avaliação" description="Quando tutores avaliarem clínicas, os depoimentos aparecem aqui." />
      ) : (
        <DataTable
          rows={rows}
          exportTitle="Avaliações"
          exportColumns={[
            { header: "Data", value: (row) => formatDate(row.data) },
            { header: "Clínica", value: (row) => row.clinica },
            { header: "Tutor", value: (row) => row.tutor },
            { header: "Pet", value: (row) => row.pet },
            { header: "Nota", value: (row) => row.nota },
            { header: "Texto", value: (row) => row.texto },
            { header: "Visível", value: (row) => row.visivel },
            { header: "Status", value: (row) => row.status },
          ]}
          columns={[
            { key: "data", header: "Data", cell: (row) => formatDate(row.data) },
            { key: "clinica", header: "Clínica", cell: (row) => row.clinica },
            {
              key: "tutor",
              header: "Tutor / Pet",
              cell: (row) => (
                <div>
                  <p className="font-medium">{row.tutor}</p>
                  <p className="text-xs text-muted">{row.pet ?? "—"}</p>
                </div>
              ),
            },
            { key: "nota", header: "Nota", cell: (row) => String(row.nota) },
            {
              key: "texto",
              header: "Comentário",
              cell: (row) => (
                <div>
                  <p className="max-w-md text-sm text-muted italic">“{row.texto}”</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge tone={row.visivel ? "ok" : "warn"}>{row.visivel ? "Pública" : "Oculta"}</Badge>
                    <Badge tone="neutral">{row.status}</Badge>
                  </div>
                </div>
              ),
            },
            { key: "acoes", header: "", cell: (row) => <Actions row={row} /> },
          ]}
          mobile={(row) => (
            <Surface>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{row.clinica}</p>
                  <p className="text-sm text-muted">
                    {row.tutor}
                    {row.pet ? ` · ${row.pet}` : ""} · nota {row.nota}
                  </p>
                </div>
                <Badge tone={row.visivel ? "ok" : "warn"}>{row.visivel ? "Pública" : "Oculta"}</Badge>
              </div>
              <p className="mt-3 text-sm text-muted italic">“{row.texto}”</p>
              <div className="mt-3">
                <Actions row={row} />
              </div>
            </Surface>
          )}
        />
      )}
    </div>
  );
}
