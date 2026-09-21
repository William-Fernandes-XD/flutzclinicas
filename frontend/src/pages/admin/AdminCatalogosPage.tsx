import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { api } from "../../services/api";
import { HttpError } from "../../lib/http";
import { useToast } from "../../providers/ToastProvider";

const ABAS = [
  { id: "vacinas", label: "Vacinas", title: "Vacinas", description: "Catálogo global do Flutz. As clínicas só marcam quais oferecem e definem o preço." },
  { id: "chat-motivos", label: "Motivos de chat", title: "Motivos de chat", description: "Só a plataforma cadastra os motivos, para todas as clínicas usarem a mesma lista." },
] as const;

type Aba = (typeof ABAS)[number]["id"];

export function AdminCatalogosPage() {
  const [aba, setAba] = useState<Aba>("vacinas");
  const [nome, setNome] = useState("");
  const [editando, setEditando] = useState<{ id: number; nome: string } | null>(null);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const toast = useToast();

  const lista = useQuery({
    queryKey: ["admin", "catalogos", aba],
    queryFn: () => api.adminCatalog(aba),
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (editando) {
        return api.updateCatalog(aba, editando.id, nome);
      }
      return api.createCatalog(aba, nome);
    },
    onSuccess: () => {
      setNome("");
      setEditando(null);
      setError("");
      toast.push(editando ? "Item atualizado." : "Item cadastrado.");
      queryClient.invalidateQueries({ queryKey: ["admin", "catalogos", aba] });
    },
  });

  const remover = useMutation({
    mutationFn: (id: number) => api.deleteCatalog(aba, id),
    onSuccess: () => {
      toast.push("Item removido.");
      queryClient.invalidateQueries({ queryKey: ["admin", "catalogos", aba] });
    },
  });

  const meta = ABAS.find((item) => item.id === aba)!;

  return (
    <div>
      <PageHeader eyebrow="Sistema" title={meta.title} description={meta.description} />

      <div className="mb-5 flex flex-wrap gap-2">
        {ABAS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setAba(item.id);
              setNome("");
              setEditando(null);
              setError("");
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              aba === item.id ? "bg-brand text-white" : "bg-white ring-1 ring-line dark:bg-zinc-900"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <form
        className="mb-6 flex min-w-0 flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          salvar.mutate(undefined, {
            onError: (err) => setError(err instanceof HttpError ? err.message : "Não foi possível salvar."),
          });
        }}
      >
        <input
          required
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          placeholder={aba === "vacinas" ? "Nova vacina (ex.: Antirrábica canina)" : "Novo motivo"}
          className="min-w-0 flex-1 rounded-2xl border border-line px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <div className="flex gap-2">
          {editando ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditando(null);
                setNome("");
              }}
            >
              Cancelar
            </Button>
          ) : null}
          <Button type="submit" busy={salvar.isPending} busyLabel="Salvando…">
            {editando ? "Salvar" : "Adicionar"}
          </Button>
        </div>
      </form>
      {error ? <ErrorState message={error} /> : null}
      {!lista.data?.length ? (
        <EmptyState
          title={aba === "vacinas" ? "Nenhuma vacina" : "Nenhum motivo"}
          description={
            aba === "vacinas"
              ? "Cadastre vacinas padrão ou use as já importadas pelo sistema."
              : "Cadastre o primeiro motivo padrão de conversa."
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <ExportMenu
              filename={aba}
              title={meta.title}
              columns={[{ header: "Nome", value: (row) => row.nome }]}
              rows={lista.data}
            />
          </div>
          <ul className="living-card divide-y divide-line dark:divide-zinc-800">
            {lista.data.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">{item.nome}</span>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="inline-flex size-9 items-center justify-center rounded-xl text-muted hover:bg-brand-soft hover:text-brand"
                    aria-label="Editar"
                    onClick={() => {
                      setEditando(item);
                      setNome(item.nome);
                      setError("");
                    }}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex size-9 items-center justify-center rounded-xl text-muted hover:bg-red-50 hover:text-danger"
                    aria-label="Remover"
                    onClick={() => {
                      if (!window.confirm(`Remover “${item.nome}”?`)) return;
                      remover.mutate(item.id, {
                        onError: (err) =>
                          setError(err instanceof HttpError ? err.message : "Não foi possível remover."),
                      });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
