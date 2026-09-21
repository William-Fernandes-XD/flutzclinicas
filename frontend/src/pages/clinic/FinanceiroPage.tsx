import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Link2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { MercadoPagoLogo } from "../../components/icons/MercadoPagoLogo";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/EmptyState";
import { Field, Input } from "../../components/ui/Field";
import { PageHeader } from "../../components/ui/PageHeader";
import { Tabs } from "../../components/ui/Tabs";
import { HttpError } from "../../lib/http";
import { api, type CupomClinica, type RecebimentoClinica } from "../../services/api";
import { useToast } from "../../providers/ToastProvider";

type TabId = "conta" | "recebimentos" | "cupons";

function money(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—";
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}

function formatPercent(value: number | string): string {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)}%`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function mascararIdConta(value: string | null | undefined): string {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 4) return `**** ${digits.slice(-4)}`;
  if (value.length >= 4) return `**** ${value.slice(-4)}`;
  return value;
}

export function FinanceiroPage() {
  const [tab, setTab] = useState<TabId>("conta");

  return (
    <div>
      {tab === "conta" ? (
        <header className="mb-6 sm:mb-8">
          <p className="text-xs text-muted">
            Configurações <span className="mx-1 text-line dark:text-zinc-600">&gt;</span> Recebimentos
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl dark:text-white">Recebimentos</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Configure como sua clínica irá receber os pagamentos dos seus clientes.
          </p>
        </header>
      ) : (
        <PageHeader
          eyebrow="Gestão"
          title={tab === "recebimentos" ? "Extrato" : "Cupons"}
          description={
            tab === "recebimentos"
              ? "Acompanhe os pagamentos recebidos via Mercado Pago."
              : "Crie e gerencie cupons de desconto da clínica."
          }
        />
      )}
      <div className="mb-6">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: "conta", label: "Recebimentos" },
            { id: "recebimentos", label: "Extrato" },
            { id: "cupons", label: "Cupons" },
          ]}
        />
      </div>
      {tab === "conta" ? <ContaRecebimentoSection /> : null}
      {tab === "recebimentos" ? <RecebimentosSection /> : null}
      {tab === "cupons" ? <CuponsSection /> : null}
    </div>
  );
}

function ContaRecebimentoSection() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [connectError, setConnectError] = useState("");

  const conta = useQuery({ queryKey: ["clinica", "recebimento"], queryFn: api.clinicaRecebimento });

  useEffect(() => {
    const mp = searchParams.get("mp");
    if (!mp) return;
    const motivo = searchParams.get("motivo");
    if (mp === "conectado") {
      toast.push("Pronto! Mercado Pago conectado.");
      void queryClient.invalidateQueries({ queryKey: ["clinica", "recebimento"] });
    } else if (mp === "erro") {
      setConnectError(motivo || "Não deu para conectar agora. Tente de novo em instantes.");
    }
    const next = new URLSearchParams(searchParams);
    next.delete("mp");
    next.delete("motivo");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, toast, queryClient]);

  const conectar = useMutation({
    mutationFn: api.conectarMercadoPago,
    meta: { skipErrorToast: true },
    onSuccess: (data) => {
      window.location.assign(data.authorizationUrl);
    },
    onError: (err) => {
      setConnectError(err instanceof HttpError ? err.message : "Não deu para conectar agora. Tente de novo.");
    },
  });

  const desconectar = useMutation({
    mutationFn: api.desconectarClinicaRecebimento,
    onSuccess: () => {
      setConfirmDisconnect(false);
      toast.push("Mercado Pago desconectado.");
      queryClient.invalidateQueries({ queryKey: ["clinica", "recebimento"] });
    },
  });

  if (conta.isLoading) return <LoadingState label="Carregando…" />;
  if (conta.isError) {
    return <ErrorState message={conta.error instanceof HttpError ? conta.error.message : "Falha ao carregar."} />;
  }

  const data = conta.data;
  const conectada = Boolean(data?.conectada);
  const podeConectar = data?.oauthDisponivel !== false;
  const nomeConta = data?.nomeExibicao || "Mercado Pago";
  const idConta = mascararIdConta(data?.providerUserId || data?.accountId);

  return (
    <div className="space-y-4">
      {connectError ? <ErrorState message={connectError} /> : null}

      {conectada ? (
        <article className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-700/80 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center gap-3">
            <MercadoPagoLogo />
          </div>
          <p className="mt-3 text-sm text-muted">
            Receba os pagamentos dos seus clientes com segurança através do Mercado Pago.
          </p>

          <div className="mt-5 flex flex-col gap-4 rounded-xl bg-[#f4f5f7] px-4 py-4 sm:flex-row sm:items-center sm:justify-between dark:bg-zinc-950/70">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                <Check className="size-4" strokeWidth={3} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Conta conectada</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted sm:text-sm">
                  Sua clínica está conectada ao Mercado Pago e já pode receber os pagamentos dos seus clientes.
                </p>
                <div className="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-xs text-muted sm:text-sm">
                  <p>
                    Conta: <span className="font-medium text-ink dark:text-zinc-100">{nomeConta}</span>
                  </p>
                  <p>
                    ID da conta: <span className="font-medium text-ink dark:text-zinc-100">{idConta}</span>
                  </p>
                </div>
              </div>
            </div>

            {!confirmDisconnect ? (
              <button
                type="button"
                onClick={() => setConfirmDisconnect(true)}
                className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border-2 border-brand bg-transparent px-4 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand-soft dark:border-brand dark:text-purple-300 dark:hover:bg-brand/15 sm:self-center"
              >
                <Link2 className="size-4" aria-hidden="true" />
                Desconectar
              </button>
            ) : (
              <div className="flex w-full flex-col gap-2 sm:max-w-xs">
                <p className="text-xs text-muted">Desconectar? Novos pagamentos ficam pausados. O histórico permanece.</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => setConfirmDisconnect(false)} disabled={desconectar.isPending}>
                    Cancelar
                  </Button>
                  <Button type="button" busy={desconectar.isPending} busyLabel="Desconectando…" onClick={() => desconectar.mutate()}>
                    Confirmar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </article>
      ) : (
        <article className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-700/80 dark:bg-zinc-900">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <MercadoPagoLogo iconOnly className="mt-0.5 [&_img]:h-10 [&_img]:sm:h-11" />
              <div className="min-w-0 pt-0.5">
                <h2 className="text-base font-semibold text-ink dark:text-white">Ainda não conectado</h2>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
                  Conecte sua conta Mercado Pago para começar a receber os pagamentos dos seus clientes.
                </p>
                {!podeConectar ? (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                    Conexão temporariamente indisponível. Fale com o suporte do Flutz.
                  </p>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              disabled={!podeConectar || conectar.isPending}
              onClick={() => {
                setConnectError("");
                conectar.mutate();
              }}
              className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(120,40,200,0.9)] transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              <Link2 className="size-4" aria-hidden="true" />
              <span>{conectar.isPending ? "Abrindo…" : "Conectar Mercado Pago"}</span>
              <ChevronRight className="size-4 opacity-90" aria-hidden="true" />
            </button>
          </div>
        </article>
      )}
    </div>
  );
}


function RecebimentosSection() {
  const lista = useQuery({ queryKey: ["clinica", "recebimentos"], queryFn: api.clinicaRecebimentos });

  if (lista.isLoading) return <LoadingState label="Carregando recebimentos…" />;
  if (lista.isError) {
    return (
      <ErrorState message={lista.error instanceof HttpError ? lista.error.message : "Não foi possível carregar o extrato."} />
    );
  }

  const items = lista.data ?? [];
  if (!items.length) {
    return (
      <EmptyState
        title="Nenhum recebimento registrado"
        description="Quando tutores pagarem agendamentos via Mercado Pago, o extrato aparece aqui."
      />
    );
  }

  return (
    <div className="living-card overflow-x-auto">
      <table className="min-w-[720px] w-full text-left text-sm">
        <thead className="text-xs tracking-wide text-muted uppercase">
          <tr>
            <th className="px-4 py-3">Descrição</th>
            <th className="px-4 py-3">Valor</th>
            <th className="px-4 py-3">Método</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Pago em</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: RecebimentoClinica) => (
            <tr key={item.id} className="border-t border-line dark:border-zinc-800">
              <td className="px-4 py-3 font-medium">{item.descricao ?? `Pagamento #${item.id}`}</td>
              <td className="px-4 py-3">{money(item.valor)}</td>
              <td className="px-4 py-3">{item.metodo ?? "—"}</td>
              <td className="px-4 py-3">
                <Badge tone={item.status.toLowerCase().includes("aprov") || item.status === "APPROVED" ? "ok" : "neutral"}>
                  {item.status}
                </Badge>
              </td>
              <td className="px-4 py-3">{formatDate(item.pagoEm)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CuponsSection() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [codigo, setCodigo] = useState("");
  const [percentualDesconto, setPercentualDesconto] = useState("");
  const [dataExpiracao, setDataExpiracao] = useState("");
  const [usosMaximos, setUsosMaximos] = useState("");
  const [error, setError] = useState("");

  const lista = useQuery({ queryKey: ["clinica", "cupons"], queryFn: api.clinicaCupons });

  const criar = useMutation({
    mutationFn: () =>
      api.criarClinicaCupom({
        codigo,
        percentualDesconto: Number(percentualDesconto.replace(",", ".")),
        dataExpiracao,
        usosMaximos: usosMaximos.trim() ? Number(usosMaximos) : null,
      }),
    meta: { skipErrorToast: true },
    onSuccess: () => {
      setCodigo("");
      setPercentualDesconto("");
      setDataExpiracao("");
      setUsosMaximos("");
      setError("");
      toast.push("Cupom cadastrado.");
      queryClient.invalidateQueries({ queryKey: ["clinica", "cupons"] });
    },
  });

  const desativar = useMutation({
    mutationFn: (id: number) => api.desativarClinicaCupom(id),
    onSuccess: () => {
      toast.push("Cupom desativado.");
      queryClient.invalidateQueries({ queryKey: ["clinica", "cupons"] });
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    criar.mutate(undefined, {
      onError: (err) => setError(err instanceof HttpError ? err.message : "Não foi possível cadastrar o cupom."),
    });
  }

  const items = lista.data ?? [];

  return (
    <div>
      <form onSubmit={onSubmit} className="living-card mb-6 grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Código" hint="Sem espaços. Será salvo em maiúsculas.">
          <Input required value={codigo} onChange={(event) => setCodigo(event.target.value)} placeholder="CLINICA10" autoComplete="off" />
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
          <Input required type="date" value={dataExpiracao} onChange={(event) => setDataExpiracao(event.target.value)} />
        </Field>
        <Field label="Usos máximos" hint="Vazio = ilimitado.">
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
            Cadastrar cupom
          </Button>
        </div>
      </form>

      {error ? (
        <div className="mb-4">
          <ErrorState message={error} />
        </div>
      ) : null}
      {lista.isLoading ? <LoadingState label="Carregando cupons…" /> : null}
      {lista.isError ? (
        <ErrorState message={lista.error instanceof HttpError ? lista.error.message : "Não foi possível carregar os cupons."} />
      ) : null}

      {!lista.isLoading && !items.length ? (
        <EmptyState title="Nenhum cupom" description="Cadastre cupons para tutores usarem no pagamento do agendamento." />
      ) : null}

      {items.length ? (
        <div className="living-card overflow-x-auto">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead className="text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Desconto</th>
                <th className="px-4 py-3">Expiração</th>
                <th className="px-4 py-3">Usos</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((item: CupomClinica) => (
                <tr key={item.id} className="border-t border-line dark:border-zinc-800">
                  <td className="px-4 py-3 font-medium">{item.codigo}</td>
                  <td className="px-4 py-3">{formatPercent(item.percentualDesconto)}</td>
                  <td className="px-4 py-3">{formatDate(item.dataExpiracao)}</td>
                  <td className="px-4 py-3">
                    {item.usosRealizados}
                    {item.usosMaximos != null ? ` / ${item.usosMaximos}` : " · ilimitado"}
                  </td>
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
                        onClick={() => desativar.mutate(item.id)}
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
      ) : null}
    </div>
  );
}
