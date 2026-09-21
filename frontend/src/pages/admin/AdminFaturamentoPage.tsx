import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CategoryBars } from "../../components/charts/AppCharts";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { HttpError } from "../../lib/http";
import { useAuth } from "../../providers/AuthProvider";
import { useToast } from "../../providers/ToastProvider";
import {
  api,
  type FaturamentoEmpresaCard,
  type FaturamentoEmpresaLinha,
} from "../../services/api";

function money(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

type ModalStatus = "PAGA" | "PENDENTE" | "ATRASADA";

const modalTitles: Record<ModalStatus, string> = {
  PAGA: "Empresas com pagamento neste mês",
  PENDENTE: "Empresas com pagamento a vencer em até 5 dias",
  ATRASADA: "Empresas com pagamento atrasado",
};

export function AdminFaturamentoPage() {
  const navigate = useNavigate();
  const { setClinic } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [modalStatus, setModalStatus] = useState<ModalStatus | null>(null);
  const [modalFiltro, setModalFiltro] = useState("");
  const [entering, setEntering] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [page, setPage] = useState(0);
  const [detalhesEmpresa, setDetalhesEmpresa] = useState<FaturamentoEmpresaLinha | null>(null);

  const resumo = useQuery({ queryKey: ["admin", "faturamento", "resumo"], queryFn: api.faturamentoResumo });
  const topVinculo = useQuery({
    queryKey: ["admin", "faturamento", "top-vinculo"],
    queryFn: api.faturamentoTopVinculo,
  });
  const topRendimento = useQuery({
    queryKey: ["admin", "faturamento", "top-rendimento"],
    queryFn: api.faturamentoTopRendimento,
  });
  const empresasPage = useQuery({
    queryKey: ["admin", "faturamento", "empresas-page", busca, page],
    queryFn: () => api.faturamentoEmpresasPage(busca, page, 15),
  });
  const modalEmpresas = useQuery({
    queryKey: ["admin", "faturamento", "empresas", modalStatus],
    queryFn: () => api.faturamentoEmpresas(modalStatus!),
    enabled: modalStatus != null,
  });
  const movimentos = useQuery({
    queryKey: ["admin", "faturamento", "detalhes", detalhesEmpresa?.empresaId],
    queryFn: () => api.faturamentoEmpresaDetalhes(detalhesEmpresa!.empresaId),
    enabled: detalhesEmpresa != null,
  });

  const marcarPago = useMutation({
    mutationFn: (empresaId: number) => api.faturamentoPagamentoManual(empresaId),
    onSuccess: async () => {
      toast.push("Status de pagamento atualizado.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "faturamento"] });
    },
    onError: (err) => {
      toast.push(err instanceof HttpError ? err.message : "Não foi possível atualizar o status.");
    },
  });

  const empresasFiltradas = useMemo(() => {
    const rows = modalEmpresas.data ?? [];
    if (!modalFiltro) return rows;
    const id = Number(modalFiltro);
    return rows.filter((row) => row.empresaId === id);
  }, [modalEmpresas.data, modalFiltro]);

  async function abrirPainel(empresaId: number) {
    setEntering(empresaId);
    try {
      await setClinic(empresaId);
      navigate("/app");
    } catch (err) {
      toast.push(err instanceof HttpError ? err.message : "Não foi possível abrir o painel.");
    } finally {
      setEntering(null);
    }
  }

  if (resumo.isLoading) return <LoadingState />;
  if (resumo.error) {
    return (
      <ErrorState
        message={resumo.error instanceof HttpError ? resumo.error.message : "Falha ao carregar faturamento"}
      />
    );
  }

  const data = resumo.data!;
  const totalPages = Math.max(1, Math.ceil((empresasPage.data?.total ?? 0) / 15));

  return (
    <div>
      <PageHeader
        eyebrow="Negócio"
        title="Faturamento"
        description="Acompanhe assinaturas da plataforma, ranking das clínicas e o rendimento gerado no sistema."
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">
          1. Informações do faturamento do Flutz
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FaturamentoCard
            label="Faturamento desse mês"
            value={money(data.pagoMes)}
            hint={`${data.empresasPagoMes} empresa(s)`}
            actionLabel="Ver empresas"
            onAction={() => {
              setModalFiltro("");
              setModalStatus("PAGA");
            }}
          />
          <FaturamentoCard
            label="A vencer em até 5 dias"
            value={money(data.pendente)}
            hint={`${data.empresasPendente} empresa(s)`}
            actionLabel="Ver empresas"
            onAction={() => {
              setModalFiltro("");
              setModalStatus("PENDENTE");
            }}
          />
          <FaturamentoCard
            label="Pagamento atrasado"
            value={money(data.atrasado)}
            hint={`${data.empresasAtrasado} empresa(s)`}
            actionLabel="Ver empresas"
            onAction={() => {
              setModalFiltro("");
              setModalStatus("ATRASADA");
            }}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">2. Rankings</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <article className="living-card p-5">
            <h3 className="font-semibold">TOP 10 — maior tempo de vínculo</h3>
            <p className="mt-1 text-xs text-muted">Assinaturas ativas, em dias desde o início.</p>
            <CategoryBars data={topVinculo.data ?? []} />
          </article>
          <article className="living-card p-5">
            <h3 className="font-semibold">TOP 10 — maior rendimento</h3>
            <p className="mt-1 text-xs text-muted">Receita paga de atendimentos e vacinações no sistema.</p>
            <CategoryBars data={topRendimento.data ?? []} currency />
          </article>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">3. Todas as empresas</h2>
            <p className="mt-1 text-xs text-muted">Até 15 empresas por página.</p>
          </div>
          <label className="block text-sm">
            <span className="sr-only">Filtrar por nome</span>
            <input
              value={busca}
              onChange={(event) => {
                setBusca(event.target.value);
                setPage(0);
              }}
              placeholder="Filtrar por nome da empresa"
              className="h-10 w-64 max-w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-brand/40"
            />
          </label>
        </div>

        {empresasPage.isLoading ? (
          <LoadingState />
        ) : !empresasPage.data?.items.length ? (
          <EmptyState title="Nenhuma empresa encontrada" description="Ajuste o filtro de nome e tente novamente." />
        ) : (
          <div className="overflow-x-auto rounded-3xl bg-white ring-1 ring-brand/10">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Perfil</th>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">E-mail</th>
                  <th className="px-4 py-3 font-medium">Telefone</th>
                  <th className="px-4 py-3 font-medium">Assinatura</th>
                  <th className="px-4 py-3 font-medium">Lucro mês</th>
                  <th className="px-4 py-3 font-medium">Lucro ano</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {empresasPage.data.items.map((row) => (
                  <tr key={row.empresaId} className="border-b border-line/70 last:border-0">
                    <td className="px-4 py-3">
                      <Avatar name={row.nome} src={row.logoUrl} size="sm" />
                    </td>
                    <td className="px-4 py-3 font-medium">{row.nome}</td>
                    <td className="px-4 py-3 text-muted">{row.email ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{row.telefone ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          row.statusAssinatura === "ATIVA" || row.statusAssinatura === "TRIAL"
                            ? "ok"
                            : row.statusAssinatura === "INADIMPLENTE"
                              ? "danger"
                              : "warn"
                        }
                      >
                        {row.statusAssinatura ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{money(row.lucroMes)}</td>
                    <td className="px-4 py-3">{money(row.lucroAno)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button type="button" variant="secondary" size="md" onClick={() => setDetalhesEmpresa(row)}>
                        Abrir detalhes
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Página {page + 1} de {totalPages} · {empresasPage.data?.total ?? 0} empresa(s)
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      </section>

      <Modal
        open={modalStatus != null}
        title={modalStatus ? modalTitles[modalStatus] : ""}
        onClose={() => setModalStatus(null)}
        wide
      >
        {modalEmpresas.isLoading ? (
          <LoadingState />
        ) : (
          <div className="space-y-4">
            <label className="block text-sm font-medium">
              Empresa
              <select
                value={modalFiltro}
                onChange={(event) => setModalFiltro(event.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-brand/40"
              >
                <option value="">Todas</option>
                {(modalEmpresas.data ?? []).map((row) => (
                  <option key={row.empresaId} value={row.empresaId}>
                    {row.nome}
                  </option>
                ))}
              </select>
            </label>

            {!empresasFiltradas.length ? (
              <EmptyState title="Nenhuma empresa nesta condição" description="Não há registros para o filtro atual." />
            ) : (
              <div className="overflow-x-auto rounded-2xl ring-1 ring-line">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-line bg-[#faf7fd] text-xs text-muted uppercase">
                    <tr>
                      <th className="px-3 py-2 font-medium">Foto</th>
                      <th className="px-3 py-2 font-medium">Empresa</th>
                      <th className="px-3 py-2 font-medium">Telefone</th>
                      <th className="px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {empresasFiltradas.map((row) => (
                      <EmpresaModalRow
                        key={row.empresaId}
                        row={row}
                        entering={entering === row.empresaId}
                        marking={marcarPago.isPending}
                        showMarkPaid={modalStatus === "PENDENTE" || modalStatus === "ATRASADA"}
                        onOpen={() => void abrirPainel(row.empresaId)}
                        onMarkPaid={() => marcarPago.mutate(row.empresaId)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={detalhesEmpresa != null}
        title={detalhesEmpresa ? `Detalhes — ${detalhesEmpresa.nome}` : "Detalhes"}
        onClose={() => setDetalhesEmpresa(null)}
        wide
      >
        {movimentos.isLoading ? (
          <LoadingState />
        ) : !movimentos.data?.length ? (
          <EmptyState
            title="Sem movimentações pagas"
            description="Ainda não há atendimentos ou vacinações com pagamento confirmado para esta empresa."
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl ring-1 ring-line">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line bg-[#faf7fd] text-xs text-muted uppercase">
                <tr>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Descrição</th>
                  <th className="px-3 py-2 font-medium">Pet</th>
                  <th className="px-3 py-2 font-medium">Tutor</th>
                  <th className="px-3 py-2 font-medium">Valor</th>
                  <th className="px-3 py-2 font-medium">Pago em</th>
                </tr>
              </thead>
              <tbody>
                {movimentos.data.map((row) => (
                  <tr key={row.id} className="border-b border-line/70 last:border-0">
                    <td className="px-3 py-2">
                      <Badge tone={row.categoria === "VACINACAO" ? "ok" : "warn"}>{row.categoria}</Badge>
                    </td>
                    <td className="px-3 py-2">{row.descricao}</td>
                    <td className="px-3 py-2 text-muted">{row.pet ?? "—"}</td>
                    <td className="px-3 py-2 text-muted">{row.tutor ?? "—"}</td>
                    <td className="px-3 py-2 font-medium">{money(row.valor)}</td>
                    <td className="px-3 py-2 text-muted">
                      {row.pagoEm ? new Date(row.pagoEm).toLocaleString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}

function FaturamentoCard({
  label,
  value,
  hint,
  actionLabel,
  onAction,
}: {
  label: string;
  value: string;
  hint: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <article className="min-w-0 rounded-3xl bg-white/90 p-5 shadow-[0_16px_40px_-24px_rgba(120,40,200,0.35)] ring-1 ring-brand/10">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
      <Button type="button" variant="secondary" className="mt-4" onClick={onAction}>
        {actionLabel}
      </Button>
    </article>
  );
}

function EmpresaModalRow({
  row,
  entering,
  marking,
  showMarkPaid,
  onOpen,
  onMarkPaid,
}: {
  row: FaturamentoEmpresaCard;
  entering: boolean;
  marking: boolean;
  showMarkPaid: boolean;
  onOpen: () => void;
  onMarkPaid: () => void;
}) {
  return (
    <tr className="border-b border-line/70 last:border-0">
      <td className="px-3 py-2">
        <Avatar name={row.nome} src={row.logoUrl} size="sm" />
      </td>
      <td className="px-3 py-2 font-medium">{row.nome}</td>
      <td className="px-3 py-2 text-muted">{row.telefone ?? "—"}</td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" busy={entering} onClick={onOpen}>
            Abrir painel
          </Button>
          {showMarkPaid ? (
            <Button type="button" busy={marking} onClick={onMarkPaid}>
              Marcar como pago
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
