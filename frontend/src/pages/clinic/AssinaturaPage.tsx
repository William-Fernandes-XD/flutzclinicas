import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  CreditCard,
  HelpCircle,
  QrCode,
  Tag,
} from "lucide-react";
import { PaymentModal } from "../../components/PaymentModal";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ErrorState, LoadingState } from "../../components/ui/EmptyState";
import { Field, Input } from "../../components/ui/Field";
import { PageHeader } from "../../components/ui/PageHeader";
import { HttpError } from "../../lib/http";
import { api, type PagamentoHistorico } from "../../services/api";
import { useToast } from "../../providers/ToastProvider";

function money(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—";
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value.includes("T") ? value : `${value}T00:00:00`}`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}

function diaVencimento(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return String(date.getDate()).padStart(2, "0");
}

function labelStatus(status?: string | null) {
  const value = (status ?? "").toUpperCase();
  if (value === "ATIVA") return { text: "ATIVO", tone: "ok" as const };
  if (value === "TRIAL") return { text: "TRIAL", tone: "info" as const };
  if (value === "INADIMPLENTE") return { text: "INADIMPLENTE", tone: "danger" as const };
  if (value === "PENDENTE") return { text: "PENDENTE", tone: "warn" as const };
  return { text: status ?? "—", tone: "neutral" as const };
}

function emDia(statusAssinatura?: string | null, statusFatura?: string | null) {
  const assinatura = (statusAssinatura ?? "").toUpperCase();
  const fatura = (statusFatura ?? "").toUpperCase();
  if (assinatura === "INADIMPLENTE" || fatura === "ATRASADA") return false;
  return assinatura === "ATIVA" || assinatura === "TRIAL";
}

export function AssinaturaPage() {
  const [payOpen, setPayOpen] = useState(false);
  const [openToken, setOpenToken] = useState(false);
  const [tokenPanel, setTokenPanel] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const mensalidade = useQuery({ queryKey: ["clinica", "mensalidade"], queryFn: api.mensalidade });

  const aplicar = useMutation({
    mutationFn: () => api.aplicarTokenAssinatura(codigo),
    meta: { skipErrorToast: true },
    onSuccess: () => {
      setCodigo("");
      setError("");
      toast.push("Token aplicado na mensalidade.");
      queryClient.invalidateQueries({ queryKey: ["clinica", "mensalidade"] });
      setPayOpen(true);
      setOpenToken(true);
    },
  });

  useEffect(() => {
    if (searchParams.get("pagar") === "1") {
      setPayOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  function onSubmitToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    aplicar.mutate(undefined, {
      onError: (err) => setError(err instanceof HttpError ? err.message : "Não foi possível aplicar o token."),
    });
  }

  if (mensalidade.isLoading) return <LoadingState label="Carregando a mensalidade…" />;
  if (mensalidade.isError) {
    return (
      <ErrorState
        message={mensalidade.error instanceof HttpError ? mensalidade.error.message : "Não foi possível carregar a mensalidade."}
      />
    );
  }

  const data = mensalidade.data!;
  const aberta = data.statusFatura === "PENDENTE" || data.statusFatura === "ATRASADA";
  const aPagar = data.valorAPagar ?? data.valor ?? data.valorMensal;
  const vencimento = data.vencimentoFatura ?? data.proximoVencimento;
  const status = labelStatus(data.statusAssinatura);
  const ok = emDia(data.statusAssinatura, data.statusFatura);
  const historico = data.historico ?? [];
  const ultimo = data.ultimoPagamento ?? historico[0] ?? null;
  const dia = diaVencimento(vencimento ?? data.proximoVencimento);
  const resumoLinhas = [
    { label: "Plano", value: data.plano },
    { label: "Valor mensal", value: money(data.valorMensal) },
    { label: "Vencimento", value: `Dia ${dia}` },
    { label: "Status", value: ok ? "Em dia" : status.text },
  ];

  return (
    <div>
      {payOpen ? (
        <PaymentModal
          openToken={openToken}
          onPaid={() => {
            setPayOpen(false);
            setOpenToken(false);
            toast.push("Pagamento confirmado. Assinatura em dia.");
            queryClient.invalidateQueries({ queryKey: ["clinica", "mensalidade"] });
          }}
          onClose={() => {
            setPayOpen(false);
            setOpenToken(false);
          }}
        />
      ) : null}

      <PageHeader
        eyebrow="Clínica"
        title="Mensalidade da clínica"
        description="Gerencie a assinatura da sua clínica. Aqui você pode visualizar, editar e pagar sua mensalidade."
        actions={
          <div className="living-card flex min-w-[14rem] flex-col gap-3 p-4 sm:min-w-[16rem]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted">Plano {data.plano}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge tone={status.tone}>{status.text}</Badge>
                </div>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-muted">
              Plano único da plataforma Flutz, com todos os recursos inclusos para a sua clínica.
            </p>
            <Button variant="secondary" className="w-full" to="/app/suporte">
              Falar com o suporte
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          label="Plano atual"
          value={
            <span className="flex flex-wrap items-center gap-2">
              {data.plano}
              <Badge tone="brand">{status.text}</Badge>
            </span>
          }
          hint="Todos os recursos inclusos."
        />
        <InfoCard
          label="Valor da mensalidade"
          value={money(data.valorMensal)}
          hint={`Vencimento todo dia ${dia} do mês.`}
        />
        <InfoCard
          label="Próximo vencimento"
          value={
            <span className="flex flex-wrap items-center gap-2">
              {formatDate(vencimento)}
              <Badge tone={ok ? "ok" : "danger"}>{ok ? "Em dia" : "Atenção"}</Badge>
            </span>
          }
          hint={aberta ? `A pagar: ${money(aPagar)}` : "Sem fatura atrasada."}
        />
        <InfoCard
          label="Último pagamento"
          value={ultimo ? formatDate(ultimo.data) : "—"}
          hint={
            ultimo
              ? `${money(ultimo.valor)} · ${ultimo.metodo}`
              : "Nenhum pagamento registrado ainda."
          }
          footer={
            ultimo?.providerPagamentoId ? (
              <button
                type="button"
                className="mt-2 text-xs font-medium text-brand hover:underline"
                onClick={() => toast.push(`Referência: ${ultimo.providerPagamentoId}`)}
              >
                Ver comprovante
              </button>
            ) : null
          }
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <section className="living-card p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-3">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                    <QrCode className="size-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-ink dark:text-white">Forma de pagamento</h2>
                    <p className="mt-1 text-sm text-muted">Pagamento rápido e seguro via Pix ou cartão.</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    disabled={!aberta && !data.faturaId}
                    onClick={() => {
                      setOpenToken(false);
                      setPayOpen(true);
                    }}
                  >
                    Pagar mensalidade
                  </Button>
                  <button
                    type="button"
                    className="text-sm font-medium text-brand hover:underline"
                    onClick={() => toast.push("Pix: QR Code instantâneo. Cartão: até 12x no Mercado Pago da plataforma.")}
                  >
                    Ver como funciona
                  </button>
                </div>
                {!aberta ? (
                  <p className="mt-3 text-xs text-muted">
                    Quando houver fatura em aberto, o botão gera o pagamento com as chaves do `.env`.
                  </p>
                ) : null}
              </div>
              <div className="rounded-2xl border border-line bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Métodos aceitos</p>
                <ul className="mt-3 space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <QrCode className="size-4 text-brand" />
                    Pix
                  </li>
                  <li className="flex items-center gap-2">
                    <CreditCard className="size-4 text-brand" />
                    Cartão de crédito
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section className="living-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                  <Tag className="size-4" />
                </span>
                <div>
                  <h2 className="font-semibold text-ink dark:text-white">Token de desconto</h2>
                  <p className="mt-1 text-sm text-muted">
                    Aplique um código promocional na fatura em aberto antes de pagar.
                  </p>
                </div>
              </div>
              <Button type="button" variant="secondary" onClick={() => setTokenPanel((v) => !v)}>
                {tokenPanel ? "Fechar" : "Aplicar token"}
              </Button>
            </div>
            {tokenPanel ? (
              <form onSubmit={onSubmitToken} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field label="Código">
                  <Input
                    required
                    value={codigo}
                    onChange={(event) => setCodigo(event.target.value)}
                    placeholder="Código do token"
                    autoComplete="off"
                  />
                </Field>
                <Button type="submit" busy={aplicar.isPending} busyLabel="Aplicando…">
                  Aplicar
                </Button>
                {error ? (
                  <div className="sm:col-span-2">
                    <ErrorState message={error} />
                  </div>
                ) : null}
              </form>
            ) : null}
          </section>

          <div
            className={`flex items-start gap-3 rounded-2xl px-4 py-3.5 text-sm ${
              ok
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
            }`}
          >
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
            <p>
              {ok
                ? "Sua mensalidade está em dia! Nenhuma ação é necessária no momento."
                : `Há pendências na assinatura. Pague até ${formatDate(data.dataLimiteAcesso)} para evitar a desativação da conta.`}
            </p>
          </div>
        </div>

        <aside className="space-y-4">
          <section className="living-card p-5">
            <h2 className="font-semibold text-ink dark:text-white">Resumo da mensalidade</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {resumoLinhas.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0 dark:border-zinc-800">
                  <dt className="text-muted">{row.label}</dt>
                  <dd className="font-medium text-ink dark:text-white">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="living-card p-5">
            <div className="flex items-start gap-3">
              <HelpCircle className="mt-0.5 size-5 text-brand" />
              <div>
                <h2 className="font-semibold text-ink dark:text-white">Precisa de ajuda?</h2>
                <p className="mt-1 text-sm text-muted">Dúvidas sobre cobrança, plano ou tokens.</p>
                <Link to="/app/suporte" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
                  Falar com o suporte
                </Link>
              </div>
            </div>
          </section>

          <HistoricoCard items={historico} />
        </aside>
      </div>

      <p className="mt-6 text-sm text-muted">
        <Link to="/app/pagina" className="font-medium text-brand hover:underline">
          Voltar à operação da clínica
        </Link>
      </p>
    </div>
  );
}

function InfoCard({
  label,
  value,
  hint,
  footer,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  footer?: ReactNode;
}) {
  return (
    <article className="living-card p-5">
      <p className="text-sm text-muted">{label}</p>
      <div className="mt-2 text-2xl font-bold tracking-tight text-ink dark:text-white">{value}</div>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      {footer}
    </article>
  );
}

function HistoricoCard({ items }: { items: PagamentoHistorico[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, 4);

  return (
    <section className="living-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-ink dark:text-white">Histórico de pagamentos</h2>
        {items.length > 4 ? (
          <button type="button" className="text-xs font-medium text-brand hover:underline" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Ver menos" : "Ver todos"}
          </button>
        ) : null}
      </div>
      {visible.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nenhum pagamento concluído ainda.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((item) => (
            <li key={item.faturaId} className="flex items-center gap-3 text-sm">
              <span className="flex size-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
                <CheckCircle2 className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink dark:text-white">{formatDate(item.data)}</p>
                <p className="text-xs text-muted">{item.metodo}</p>
              </div>
              <p className="font-semibold text-ink dark:text-white">{money(item.valor)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
