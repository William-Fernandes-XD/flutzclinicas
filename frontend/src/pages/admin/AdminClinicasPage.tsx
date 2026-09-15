import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/EmptyState";
import { Surface } from "../../components/ui/Field";
import { PageHeader } from "../../components/ui/PageHeader";
import { HttpError } from "../../lib/http";
import { useAuth } from "../../providers/AuthProvider";
import { useToast } from "../../providers/ToastProvider";
import { api, type AdminClinic } from "../../services/api";

function isAtivo(status?: string | null) {
  return (status ?? "").toLowerCase() === "ativo";
}

export function AdminClinicasPage() {
  const [q, setQ] = useState("");
  const [entering, setEntering] = useState<number | null>(null);
  const navigate = useNavigate();
  const { setClinic } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const lista = useQuery({ queryKey: ["admin", "clinicas", q], queryFn: () => api.adminClinics(q) });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "ativo" | "inativo" }) => api.setClinicStatus(id, status),
    onSuccess: async (_, vars) => {
      toast.push(vars.status === "ativo" ? "Clínica ativada." : "Clínica desativada.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "clinicas"] });
    },
  });

  if (lista.isLoading) return <LoadingState />;
  if (lista.error) {
    return <ErrorState message={lista.error instanceof HttpError ? lista.error.message : "Falha ao listar clínicas"} />;
  }

  const rows = lista.data ?? [];

  function StatusActions({ row }: { row: AdminClinic }) {
    const ativo = isAtivo(row.status);
    return (
      <Button
        type="button"
        variant="secondary"
        busy={statusMut.isPending && statusMut.variables?.id === row.id}
        busyLabel="Atualizando…"
        onClick={() => statusMut.mutate({ id: row.id, status: ativo ? "inativo" : "ativo" })}
      >
        {ativo ? "Desativar" : "Ativar"}
      </Button>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Clientes" title="Clínicas" description="Empresas da plataforma, com plano vigente e volume operacional." />
      <input
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Pesquisar por nome, CNPJ ou slug"
        className="mb-5 w-full max-w-md rounded-2xl border border-line bg-white px-4 py-2.5 dark:border-zinc-700 dark:bg-zinc-900"
      />
      {!rows.length ? (
        <EmptyState title="Nenhuma clínica encontrada" description="Quando uma clínica se cadastrar pela landing, ela aparece aqui." />
      ) : (
        <DataTable
          rows={rows}
          exportTitle="Clínicas"
          exportColumns={[
            { header: "Nome", value: (row) => row.nome },
            { header: "CNPJ", value: (row) => row.cnpj },
            { header: "Cidade", value: (row) => [row.cidade, row.uf].filter(Boolean).join(" / ") },
            { header: "Plano", value: (row) => row.plano },
            { header: "Assinatura", value: (row) => row.statusAssinatura ?? row.status },
            { header: "Status", value: (row) => row.status },
            { header: "Colaboradores", value: (row) => row.colaboradores },
            { header: "Tutores", value: (row) => row.clientes },
            { header: "Pets", value: (row) => row.pets },
          ]}
          columns={[
            { key: "foto", header: "Foto", cell: (row) => <Avatar name={row.nome} src={row.logoUrl} /> },
            {
              key: "nome",
              header: "Clínica",
              cell: (row) => (
                <div>
                  <p className="font-medium">{row.nome}</p>
                  <p className="text-xs text-muted">{[row.cidade, row.uf].filter(Boolean).join(" · ") || "Sem cidade"}</p>
                </div>
              ),
            },
            { key: "plano", header: "Plano", cell: (row) => row.plano ?? "—" },
            {
              key: "status",
              header: "Status",
              cell: (row) => (
                <div className="flex flex-col gap-1">
                  <Badge tone={row.statusAssinatura === "CANCELADA" ? "danger" : "brand"}>
                    {row.statusAssinatura ?? row.status}
                  </Badge>
                  <Badge tone={isAtivo(row.status) ? "ok" : "warn"}>{row.status}</Badge>
                </div>
              ),
            },
            {
              key: "volume",
              header: "Volume",
              cell: (row) => `${row.colaboradores} colab. · ${row.clientes} tutores · ${row.pets} pets`,
            },
            {
              key: "acoes",
              header: "",
              cell: (row) => (
                <div className="flex flex-wrap gap-2">
                  <Button
                    busy={entering === row.id}
                    busyLabel="Entrando…"
                    disabled={entering != null && entering !== row.id}
                    onClick={async () => {
                      if (entering) return;
                      setEntering(row.id);
                      try {
                        await setClinic(row.id);
                        navigate("/app");
                      } finally {
                        setEntering(null);
                      }
                    }}
                  >
                    Entrar
                  </Button>
                  <Button to={`/clinica/${row.slug}`} variant="secondary">
                    Página
                  </Button>
                  <StatusActions row={row} />
                </div>
              ),
            },
          ]}
          mobile={(row) => (
            <Surface>
              <div className="flex items-start gap-3">
                <Avatar name={row.nome} src={row.logoUrl} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold">{row.nome}</h2>
                    <Badge tone={isAtivo(row.status) ? "ok" : "warn"}>{row.status}</Badge>
                  </div>
                  <p className="text-sm text-muted">
                    {row.plano ?? "Sem plano"} · {row.colaboradores} colaboradores
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  busy={entering === row.id}
                  busyLabel="Entrando…"
                  onClick={async () => {
                    setEntering(row.id);
                    try {
                      await setClinic(row.id);
                      navigate("/app");
                    } finally {
                      setEntering(null);
                    }
                  }}
                >
                  Entrar na clínica
                </Button>
                <Button to={`/clinica/${row.slug}`} variant="secondary">
                  Página pública
                </Button>
                <StatusActions row={row} />
              </div>
            </Surface>
          )}
        />
      )}
    </div>
  );
}
