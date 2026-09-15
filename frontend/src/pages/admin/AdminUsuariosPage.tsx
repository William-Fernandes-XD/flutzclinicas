import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { EmptyState, LoadingState } from "../../components/ui/EmptyState";
import { Surface } from "../../components/ui/Field";
import { PageHeader } from "../../components/ui/PageHeader";
import { useToast } from "../../providers/ToastProvider";
import { api, type AdminPerson } from "../../services/api";

function isAtivo(status?: string | null) {
  return (status ?? "").toLowerCase() === "ativo";
}

export function AdminUsuariosPage() {
  const users = useQuery({ queryKey: ["admin", "usuarios"], queryFn: api.users });
  if (users.isLoading) return <LoadingState />;
  const data = users.data;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Clientes"
        title="Pessoas da plataforma"
        description="Os logins ficam separados: administradores da plataforma, colaboradores das clínicas e tutores."
      />
      <Group title="Administradores do Flutz" rows={data?.administradores ?? []} />
      <Group title="Colaboradores das clínicas" rows={data?.colaboradores ?? []} tipo="colaborador" />
      <Group title="Tutores" rows={data?.clientes ?? []} tipo="cliente" />
    </div>
  );
}

function Group({
  title,
  rows,
  tipo,
}: {
  title: string;
  rows: AdminPerson[];
  tipo?: "colaborador" | "cliente";
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "ativo" | "inativo" }) => {
      if (!tipo) throw new Error("Sem tipo");
      return api.setUserStatus(tipo, id, status);
    },
    onSuccess: async (_, vars) => {
      toast.push(vars.status === "ativo" ? "Usuário ativado." : "Usuário desativado.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "usuarios"] });
    },
  });

  if (!rows.length) {
    return (
      <section>
        <h2 className="mb-1 font-semibold">{title}</h2>
        <EmptyState
          title="Nenhum resultado encontrado"
          description="Não encontramos registros neste grupo. Quando houver cadastros, eles aparecem aqui."
        />
      </section>
    );
  }
  return (
    <section>
      <h2 className="mb-3 font-semibold">{title}</h2>
      <DataTable
        rows={rows}
        exportTitle={title}
        exportColumns={[
          { header: "Nome", value: (row) => row.nome },
          { header: "Identificador", value: (row) => row.identificador },
          { header: "Status", value: (row) => row.status },
          { header: "Clínica", value: (row) => row.clinica },
        ]}
        columns={[
          { key: "foto", header: "Foto", cell: (row) => <Avatar name={row.nome} src={row.fotoUrl} /> },
          { key: "nome", header: "Nome", cell: (row) => <span className="font-medium">{row.nome}</span> },
          { key: "id", header: "Acesso", cell: (row) => row.identificador },
          {
            key: "status",
            header: "Status",
            cell: (row) => <Badge tone={isAtivo(row.status) ? "ok" : "warn"}>{row.status}</Badge>,
          },
          { key: "clinica", header: "Clínica", cell: (row) => row.clinica ?? "—" },
          {
            key: "acoes",
            header: "",
            cell: (row) =>
              tipo ? (
                <Button
                  type="button"
                  variant="secondary"
                  busy={statusMut.isPending && statusMut.variables?.id === row.id}
                  busyLabel="Atualizando…"
                  onClick={() =>
                    statusMut.mutate({ id: row.id, status: isAtivo(row.status) ? "inativo" : "ativo" })
                  }
                >
                  {isAtivo(row.status) ? "Desativar" : "Ativar"}
                </Button>
              ) : null,
          },
        ]}
        mobile={(row) => (
          <Surface>
            <div className="flex items-center gap-3">
              <Avatar name={row.nome} src={row.fotoUrl} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{row.nome}</p>
                <p className="text-sm text-muted">
                  {row.identificador} · {row.status}
                  {row.clinica ? ` · ${row.clinica}` : ""}
                </p>
              </div>
            </div>
            {tipo ? (
              <div className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  busy={statusMut.isPending && statusMut.variables?.id === row.id}
                  busyLabel="Atualizando…"
                  onClick={() =>
                    statusMut.mutate({ id: row.id, status: isAtivo(row.status) ? "inativo" : "ativo" })
                  }
                >
                  {isAtivo(row.status) ? "Desativar" : "Ativar"}
                </Button>
              </div>
            ) : null}
          </Surface>
        )}
      />
    </section>
  );
}
