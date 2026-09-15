import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
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

export function FinanceiroPage() {
  const [tab, setTab] = useState<TabId>("conta");

  return (
    <div>
      <PageHeader
        eyebrow="Gestão"
        title="Financeiro da clínica"
        description="Configure o Mercado Pago para receber pagamentos de agendamento, acompanhe o extrato e gerencie cupons da clínica."
      />
      <div className="mb-6">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: "conta", label: "Conta de recebimento" },
            { id: "recebimentos", label: "Recebimentos" },
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
  const [publicKey, setPublicKey] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [nomeExibicao, setNomeExibicao] = useState("");
  const [error, setError] = useState("");

  const conta = useQuery({ queryKey: ["clinica", "recebimento"], queryFn: api.clinicaRecebimento });

  const salvar = useMutation({
    mutationFn: () =>
      api.salvarClinicaRecebimento({
        publicKey: publicKey.trim(),
        accessToken: accessToken.trim(),
        nomeExibicao: nomeExibicao.trim() || undefined,
      }),
    meta: { skipErrorToast: true },
    onSuccess: () => {
      setPublicKey("");
      setAccessToken("");
      setError("");
      toast.push("Conta de recebimento salva.");
      queryClient.invalidateQueries({ queryKey: ["clinica", "recebimento"] });
    },
  });

  const desconectar = useMutation({
    mutationFn: api.desconectarClinicaRecebimento,
    onSuccess: () => {
      toast.push("Conta desconectada.");
      queryClient.invalidateQueries({ queryKey: ["clinica", "recebimento"] });
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!publicKey.trim() || !accessToken.trim()) {
      setError("Informe a Public Key e o Access Token do Mercado Pago.");
      return;
    }
    salvar.mutate(undefined, {
      onError: (err) => setError(err instanceof HttpError ? err.message : "Não foi possível salvar a conta."),
    });
  }

  if (conta.isLoading) return <LoadingState label="Carregando conta…" />;
  if (conta.isError) {
    return <ErrorState message={conta.error instanceof HttpError ? conta.error.message : "Falha ao carregar a conta."} />;
  }

  const data = conta.data;

  return (
    <div className="space-y-6">
      <div className="living-card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-sm font-semibold">Status da conta</p>
          <p className="text-xs text-muted">
            {data?.conectada
              ? `Conectada${data.nomeExibicao ? ` · ${data.nomeExibicao}` : ""}${data.conectadaEm ? ` em ${formatDate(data.conectadaEm)}` : ""}`
              : "Nenhuma conta Mercado Pago conectada"}
          </p>
          {data?.publicKeyMascarada ? <p className="mt-1 text-xs text-muted">Public Key: {data.publicKeyMascarada}</p> : null}
        </div>
        <Badge tone={data?.conectada ? "ok" : "warn"}>{data?.conectada ? "Conectada" : "Pendente"}</Badge>
      </div>

      <form onSubmit={onSubmit} className="living-card grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Public Key" hint="Começa com TEST- (teste) ou APP_USR- (produção). Use o mesmo ambiente no Access Token.">
          <Input
            required
            value={publicKey}
            onChange={(event) => setPublicKey(event.target.value)}
            placeholder="APP_USR-…"
            autoComplete="off"
          />
        </Field>
        <Field label="Access Token" hint="Cole o token completo. Ao salvar, validamos no Mercado Pago.">
          <Input
            required
            type="password"
            value={accessToken}
            onChange={(event) => setAccessToken(event.target.value)}
            placeholder="APP_USR-…"
            autoComplete="off"
          />
        </Field>
        <Field label="Nome de exibição" hint="Opcional — como a conta aparece no painel.">
          <Input value={nomeExibicao} onChange={(event) => setNomeExibicao(event.target.value)} placeholder="Conta principal" />
        </Field>
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
          <Button type="submit" busy={salvar.isPending} busyLabel="Salvando…">
            Salvar conta
          </Button>
          {data?.conectada ? (
            <Button
              type="button"
              variant="secondary"
              busy={desconectar.isPending}
              busyLabel="Desconectando…"
              onClick={() => desconectar.mutate()}
            >
              Desconectar
            </Button>
          ) : null}
        </div>
        {error ? (
          <div className="sm:col-span-2">
            <ErrorState message={error} />
          </div>
        ) : null}
      </form>
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
