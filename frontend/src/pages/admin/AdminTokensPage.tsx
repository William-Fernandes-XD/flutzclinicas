import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/EmptyState";
import { Field, Input } from "../../components/ui/Field";
import { PageHeader } from "../../components/ui/PageHeader";
import { HttpError } from "../../lib/http";
import { api, type AdminToken } from "../../services/api";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { useToast } from "../../providers/ToastProvider";

function formatPercent(value: number | string): string {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)}%`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function AdminTokensPage() {
  const [page, setPage] = useState(0);
  const [codigoToken, setCodigoToken] = useState("");
  const [percentualDesconto, setPercentualDesconto] = useState("");
  const [dataExpiracao, setDataExpiracao] = useState("");
  const [usosMaximos, setUsosMaximos] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const toast = useToast();

  const lista = useQuery({
    queryKey: ["admin", "tokens", page],
    queryFn: () => api.adminTokens(page),
  });

  const criar = useMutation({
    mutationFn: () =>
      api.createToken({
        codigoToken,
        percentualDesconto: Number(percentualDesconto.replace(",", ".")),
        dataExpiracao,
        usosMaximosPorEmpresa: usosMaximos.trim() ? Number(usosMaximos) : null,
      }),
    meta: { skipErrorToast: true },
    onSuccess: () => {
      setCodigoToken("");
      setPercentualDesconto("");
      setDataExpiracao("");
      setUsosMaximos("");
      setError("");
      toast.push("Token cadastrado.");
      queryClient.invalidateQueries({ queryKey: ["admin", "tokens"] });
    },
  });

  const desativar = useMutation({
    mutationFn: (id: number) => api.deactivateToken(id),
    onSuccess: () => {
      toast.push("Token desativado.");
      queryClient.invalidateQueries({ queryKey: ["admin", "tokens"] });
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    criar.mutate(undefined, {
      onError: (err) => setError(err instanceof HttpError ? err.message : "Não foi possível cadastrar o token."),
    });
  }

  const data = lista.data;
  const items = data?.items ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Negócio"
        title="Tokens"
        description="Cadastre cupons de desconto da plataforma. A clínica informa o código no cadastro ou na mensalidade em aberto."
      />

      <form onSubmit={onSubmit} className="living-card mb-6 grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Código" hint="Sem espaços. Será salvo em maiúsculas.">
          <Input
            required
            value={codigoToken}
            onChange={(event) => setCodigoToken(event.target.value)}
            placeholder="BEMVINDA10"
            autoComplete="off"
          />
        </Field>
        <Field label="Desconto (%)">
          <Input
            required
            inputMode="decimal"
            value={percentualDesconto}
            onChange={(event) => setPercentualDesconto(event.target.value)}
            placeholder="10"
          />
        </Field>
        <Field label="Data de expiração">
          <Input
            required
            type="date"
            value={dataExpiracao}
            onChange={(event) => setDataExpiracao(event.target.value)}
          />
        </Field>
        <Field label="Usos por clínica" hint="Vazio = ilimitado. 1 = só uma fatura.">
          <Input
            inputMode="numeric"
            min={1}
            value={usosMaximos}
            onChange={(event) => setUsosMaximos(event.target.value)}
            placeholder="Ilimitado"
          />
        </Field>
        <div className="sm:col-span-2 lg:col-span-4">
          <Button type="submit" busy={criar.isPending} busyLabel="Cadastrando…">
            Cadastrar token
          </Button>
        </div>
      </form>

      {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}
      {lista.isLoading ? <LoadingState label="Carregando tokens…" /> : null}
      {lista.isError ? (
        <ErrorState message={lista.error instanceof HttpError ? lista.error.message : "Não foi possível carregar os tokens."} />
      ) : null}

      {!lista.isLoading && !items.length ? (
        <EmptyState title="Nenhum token" description="Cadastre o primeiro cupom para as clínicas usarem na mensalidade." />
      ) : null}

      {items.length ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <ExportMenu
              filename="tokens"
              title="Tokens"
              columns={[
                { header: "Código", value: (row) => row.codigoToken },
                { header: "Desconto", value: (row) => formatPercent(row.percentualDesconto) },
                { header: "Expiração", value: (row) => formatDate(row.dataExpiracao) },
                { header: "Usos por clínica", value: (row) => row.usosMaximosPorEmpresa },
                { header: "Status", value: (row) => row.status },
              ]}
              rows={items}
            />
          </div>
          <div className="living-card overflow-x-auto">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead className="text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Desconto</th>
                <th className="px-4 py-3">Expiração</th>
                <th className="px-4 py-3">Usos por clínica</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((item: AdminToken) => (
                <tr key={item.id} className="border-t border-line dark:border-zinc-800">
                  <td className="px-4 py-3 font-medium">{item.codigoToken}</td>
                  <td className="px-4 py-3">{formatPercent(item.percentualDesconto)}</td>
                  <td className="px-4 py-3">{formatDate(item.dataExpiracao)}</td>
                  <td className="px-4 py-3">{item.usosMaximosPorEmpresa ?? "Ilimitado"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={item.status.toLowerCase() === "ativo" ? "ok" : "neutral"}>{item.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {item.status.toLowerCase() === "ativo" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        busy={desativar.isPending}
                        busyLabel="Desativando…"
                        onClick={() =>
                          desativar.mutate(item.id)
                        }
                      >
                        Desativar
                      </Button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ) : null}

      {data && data.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <p className="text-muted">
            Página {data.page + 1} de {data.totalPages} · {data.total} tokens
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={page <= 0} onClick={() => setPage((atual) => atual - 1)}>
              Anterior
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={page + 1 >= data.totalPages}
              onClick={() => setPage((atual) => atual + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
