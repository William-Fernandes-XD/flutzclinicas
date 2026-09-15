import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { api } from "../../services/api";
import { HttpError } from "../../lib/http";
import { useToast } from "../../providers/ToastProvider";

export function AdminCatalogosPage() {
  const [nome, setNome] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const toast = useToast();
  const lista = useQuery({
    queryKey: ["admin", "catalogos", "chat-motivos"],
    queryFn: () => api.adminCatalog("chat-motivos"),
  });
  const criar = useMutation({
    mutationFn: () => api.createCatalog("chat-motivos", nome),
    onSuccess: () => {
      setNome("");
      setError("");
      toast.push("Motivo cadastrado.");
      queryClient.invalidateQueries({ queryKey: ["admin", "catalogos", "chat-motivos"] });
    },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Sistema"
        title="Motivos de chat"
        description="Só a plataforma cadastra os motivos, para todas as clínicas usarem a mesma lista."
      />
      <form
        className="mb-6 flex min-w-0 flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          criar.mutate(undefined, {
            onError: (err) => setError(err instanceof HttpError ? err.message : "Não foi possível salvar."),
          });
        }}
      >
        <input
          required
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          placeholder="Novo motivo"
          className="min-w-0 flex-1 rounded-2xl border border-line px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <Button type="submit" busy={criar.isPending} busyLabel="Adicionando…">Adicionar</Button>
      </form>
      {error ? <ErrorState message={error} /> : null}
      {!lista.data?.length ? (
        <EmptyState title="Nenhum motivo" description="Cadastre o primeiro motivo padrão de conversa." />
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <ExportMenu
              filename="motivos-chat"
              title="Motivos de chat"
              columns={[{ header: "Motivo", value: (row) => row.nome }]}
              rows={lista.data}
            />
          </div>
        <ul className="living-card divide-y divide-line dark:divide-zinc-800">
          {lista.data.map((item) => (
            <li key={item.id} className="px-4 py-3">{item.nome}</li>
          ))}
        </ul>
        </div>
      )}
    </div>
  );
}
