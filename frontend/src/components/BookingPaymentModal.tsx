import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/Button";
import { ErrorState } from "./ui/EmptyState";
import { Field, Input } from "./ui/Field";
import { HttpError } from "../lib/http";
import { api, type AgendaCheckout, type BookingPaymentResult, type CardPaymentBody } from "../services/api";
import { useAuth } from "../providers/AuthProvider";

function money(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—";
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}

function onlyDigits(value = ""): string {
  return String(value).replace(/\D/g, "");
}

function formatCpf(value = ""): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function normalizePayment(res: BookingPaymentResult): BookingPaymentResult {
  return {
    agendamentoId: res.agendamentoId,
    amount: Number(res.amount ?? res.valor ?? 0),
    status: res.status,
    paid: Boolean(res.paid ?? res.pago),
    mercadopagoPaymentId: res.mercadopagoPaymentId,
    method: res.method ?? res.metodo ?? null,
    pixQrCode: res.pixQrCode ?? res.pixCopiaECola ?? null,
    pixQrCodeBase64: res.pixQrCodeBase64,
    pixExpiration: res.pixExpiration ?? null,
    valor: res.valor,
    pago: res.pago,
    metodo: res.metodo,
    pixCopiaECola: res.pixCopiaECola,
    detalhe: res.detalhe,
  };
}

function loadMercadoPagoSdk(): Promise<void> {
  if (window.MercadoPago) return Promise.resolve();
  const existing = document.querySelector('script[data-mp-sdk="v2"]');
  if (existing) {
    return new Promise((resolve, reject) => {
      if (window.MercadoPago) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar Mercado Pago")), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.dataset.mpSdk = "v2";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar Mercado Pago"));
    document.body.appendChild(script);
  });
}

export function BookingPaymentModal({
  agendamentoId,
  onPaid,
  onClose,
  initialCpf = "",
}: {
  agendamentoId: number;
  onPaid: () => void;
  onClose: () => void;
  initialCpf?: string;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Fechar" />
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-brand/20 dark:bg-zinc-900 sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-xl font-bold text-ink dark:text-white">Pagamento do agendamento</h2>
            <p className="text-xs text-muted">PIX ou cartão de crédito</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-muted hover:text-ink"
            aria-label="Fechar modal"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <BookingCheckout agendamentoId={agendamentoId} onPaid={onPaid} onClose={onClose} initialCpf={initialCpf} />
        </div>
      </div>
    </div>
  );
}

function BookingCheckout({
  agendamentoId,
  onPaid,
  onClose,
  initialCpf = "",
}: {
  agendamentoId: number;
  onPaid: () => void;
  onClose: () => void;
  initialCpf?: string;
}) {
  const reactId = useId().replace(/:/g, "");
  const brickContainerId = `bookingCardBrick-${reactId}`;
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [pixData, setPixData] = useState<BookingPaymentResult | null>(null);
  const [checkout, setCheckout] = useState<AgendaCheckout | null>(null);
  const [cupomCodigo, setCupomCodigo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cupomBusy, setCupomBusy] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [cpf, setCpf] = useState(formatCpf(initialCpf));
  const brickControllerRef = useRef<{ unmount?: () => Promise<void> } | null>(null);
  const submittingRef = useRef(false);
  const cpfRef = useRef(cpf);
  const payWithCardTokenRef = useRef<(formData: MercadoPagoCardForm) => Promise<void>>(async () => undefined);

  useEffect(() => {
    cpfRef.current = cpf;
  }, [cpf]);

  const mpConfig = useQuery({
    queryKey: ["agenda", "pagamento-config", agendamentoId],
    queryFn: () => api.agendaPagamentoConfig(agendamentoId),
  });

  const handlePaid = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["agenda-solicitacoes"] });
    queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
    onPaid();
  }, [queryClient, onPaid]);

  const refreshCheckout = useCallback(async () => {
    const data = await api.agendaCheckout(agendamentoId);
    setCheckout(data);
    if (data.codigoCupom) setCupomCodigo(data.codigoCupom);
    return data;
  }, [agendamentoId]);

  useEffect(() => {
    let cancelled = false;
    refreshCheckout()
      .then((data) => {
        if (cancelled) return;
        if (!data.podePagar && data.statusCodigo === "CONFIRMADO") handlePaid();
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof HttpError ? err.message : "Não foi possível carregar o checkout.");
        }
      });
    api
      .agendaStatusPagamento(agendamentoId)
      .then((res) => {
        if (cancelled) return;
        const normalized = normalizePayment(res);
        if (normalized.paid) handlePaid();
        else if (normalized.pixQrCode || normalized.pixQrCodeBase64) {
          setPixData(normalized);
          setMethod("pix");
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [agendamentoId, refreshCheckout, handlePaid]);

  const payWithCardToken = useCallback(
    async (formData: MercadoPagoCardForm) => {
      setError("");
      setLoading(true);
      try {
        const token = formData?.token;
        const paymentMethodId = formData?.payment_method_id || formData?.paymentMethodId;
        const installments = Number(formData?.installments || 1);
        const issuerId =
          formData?.issuer_id != null
            ? String(formData.issuer_id)
            : formData?.issuerId != null
              ? String(formData.issuerId)
              : null;
        if (!token || !paymentMethodId) {
          throw new Error("Não foi possível tokenizar o cartão. Verifique os dados e tente novamente.");
        }
        let payerCpf = formData?.payer?.identification?.number || formData?.identificationNumber || "";
        if (onlyDigits(cpfRef.current).length === 11) {
          payerCpf = formatCpf(cpfRef.current);
        }
        if (onlyDigits(payerCpf).length !== 11) {
          throw new Error("Informe um CPF válido com 11 dígitos.");
        }
        const body: CardPaymentBody = {
          token,
          paymentMethodId,
          installments,
          issuerId,
          payerEmail: formData?.payer?.email || session?.identificador,
          payerName: session?.nome || formData?.payer?.email || "Tutor",
          payerCpf: formatCpf(payerCpf),
        };
        const res = normalizePayment(await api.agendaPagarCartao(agendamentoId, body));
        if (res.paid) {
          handlePaid();
          return;
        }
        throw new Error("Pagamento não aprovado. Tente outro cartão ou PIX.");
      } catch (err) {
        setError(err instanceof HttpError ? err.message : err instanceof Error ? err.message : "Erro ao processar cartão.");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [agendamentoId, handlePaid, session],
  );

  useEffect(() => {
    payWithCardTokenRef.current = payWithCardToken;
  }, [payWithCardToken]);

  const publicKey = checkout?.publicKey || mpConfig.data?.publicKey || null;
  const amount = checkout?.valorCobrado ?? 0;

  useEffect(() => {
    if (!publicKey || method !== "card" || !checkout?.podePagar) {
      setCardReady(false);
      return undefined;
    }
    let cancelled = false;
    const destroyBrick = async () => {
      try {
        await brickControllerRef.current?.unmount?.();
      } catch {
        /* ignore */
      }
      brickControllerRef.current = null;
    };
    const mountBrick = async () => {
      setCardReady(false);
      await destroyBrick();
      if (cancelled) return;
      const container = document.getElementById(brickContainerId);
      if (!container) {
        window.setTimeout(() => {
          if (!cancelled) mountBrick();
        }, 50);
        return;
      }
      container.innerHTML = "";
      try {
        await loadMercadoPagoSdk();
        if (cancelled || !window.MercadoPago) return;
        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        const controller = await mp.bricks().create("cardPayment", brickContainerId, {
          initialization: {
            amount: Number(amount),
            payer: { email: session?.identificador || undefined },
          },
          customization: {
            visual: {
              style: { theme: document.documentElement.classList.contains("dark") ? "dark" : "default" },
            },
            paymentMethods: { maxInstallments: 12 },
          },
          callbacks: {
            onReady: () => {
              if (!cancelled) {
                setCardReady(true);
                setError("");
              }
            },
            onError: () => {
              if (!cancelled) {
                setCardReady(false);
                setError("Não foi possível carregar o formulário de cartão. Recarregue e tente novamente.");
              }
            },
            onSubmit: (formData: MercadoPagoCardForm) => {
              if (submittingRef.current) {
                return Promise.reject(new Error("Pagamento já em andamento."));
              }
              submittingRef.current = true;
              return payWithCardTokenRef.current(formData).finally(() => {
                submittingRef.current = false;
              });
            },
          },
        });
        if (cancelled) {
          try {
            await controller?.unmount?.();
          } catch {
            /* ignore */
          }
          return;
        }
        brickControllerRef.current = controller;
      } catch (err) {
        if (!cancelled) {
          setCardReady(false);
          setError(err instanceof Error ? err.message : "Falha ao carregar o formulário de cartão.");
        }
      }
    };
    mountBrick();
    return () => {
      cancelled = true;
      destroyBrick();
      setCardReady(false);
    };
  }, [publicKey, method, amount, checkout?.podePagar, brickContainerId, session?.identificador]);

  useEffect(() => {
    if (!pixData || pixData.paid) return undefined;
    const interval = window.setInterval(async () => {
      try {
        const res = normalizePayment(await api.agendaStatusPagamento(agendamentoId));
        if (res.paid) handlePaid();
      } catch {
        /* ignore */
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [pixData, agendamentoId, handlePaid]);

  async function handleGeneratePix() {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const res = normalizePayment(await api.agendaPagarPix(agendamentoId));
      setPixData(res);
      if (res.paid) handlePaid();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Erro ao gerar PIX.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAplicarCupom() {
    if (!cupomCodigo.trim() || cupomBusy) return;
    setCupomBusy(true);
    setError("");
    try {
      const data = await api.agendaAplicarCupom(agendamentoId, cupomCodigo.trim());
      setCheckout(data);
      setPixData(null);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Cupom inválido.");
    } finally {
      setCupomBusy(false);
    }
  }

  async function handleRemoverCupom() {
    if (cupomBusy) return;
    setCupomBusy(true);
    setError("");
    try {
      const data = await api.agendaRemoverCupom(agendamentoId);
      setCheckout(data);
      setCupomCodigo("");
      setPixData(null);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Não foi possível remover o cupom.");
    } finally {
      setCupomBusy(false);
    }
  }

  if (!checkout) {
    return <p className="py-8 text-center text-sm text-muted">Carregando checkout…</p>;
  }

  if (!checkout.podePagar) {
    return (
      <div className="space-y-3 py-4 text-center">
        <p className="text-sm text-muted">
          {checkout.contaRecebimentoOk
            ? "Este agendamento não está aguardando pagamento."
            : "A clínica ainda não configurou a conta de recebimento."}
        </p>
        <button type="button" onClick={onClose} className="text-sm text-brand hover:underline">
          Fechar
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-2xl border border-line bg-brand-soft/30 p-4 dark:border-zinc-800">
        <p className="text-sm font-semibold">
          {checkout.pet} · {checkout.item || checkout.tipo}
        </p>
        <p className="text-xs text-muted">{checkout.clinica}</p>
        <p className="mt-2 text-sm text-muted">
          Total: <span className="font-semibold text-brand">{money(checkout.valorCobrado)}</span>
          {checkout.valorDesconto > 0 ? (
            <span className="ml-2 text-xs">
              (de {money(checkout.valorServico)}, desconto {money(checkout.valorDesconto)})
            </span>
          ) : null}
        </p>
      </div>

      {error ? (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <Field label="Cupom de desconto">
          <Input
            value={cupomCodigo}
            onChange={(event) => setCupomCodigo(event.target.value.toUpperCase())}
            placeholder="CODIGO10"
            disabled={Boolean(checkout.codigoCupom)}
            autoComplete="off"
          />
        </Field>
        {checkout.codigoCupom ? (
          <Button type="button" variant="secondary" className="self-end" busy={cupomBusy} busyLabel="Removendo…" onClick={handleRemoverCupom}>
            Remover
          </Button>
        ) : (
          <Button type="button" variant="secondary" className="self-end" busy={cupomBusy} busyLabel="Aplicando…" onClick={handleAplicarCupom}>
            Aplicar
          </Button>
        )}
      </div>

      <div className="mt-4">
        <Field label="CPF do responsável" hint="Necessário para PIX e cartão.">
          <Input
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(event) => setCpf(formatCpf(event.target.value))}
          />
        </Field>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMethod("pix")}
          className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold ${
            method === "pix" ? "border-brand bg-brand text-white" : "border-line bg-white dark:border-zinc-700 dark:bg-zinc-900"
          }`}
        >
          PIX
        </button>
        <button
          type="button"
          onClick={() => setMethod("card")}
          className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold ${
            method === "card" ? "border-brand bg-brand text-white" : "border-line bg-white dark:border-zinc-700 dark:bg-zinc-900"
          }`}
        >
          Cartão de crédito
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-brand-soft/40 p-4 dark:border-zinc-800">
        {method === "pix" ? (
          <div className="space-y-4">
            {!pixData ? (
              <>
                <p className="text-sm text-muted">Gere o QR Code PIX e pague pelo app do banco. A confirmação é automática.</p>
                <Button type="button" className="w-full" busy={loading} busyLabel="Gerando PIX…" onClick={handleGeneratePix}>
                  Gerar QR Code PIX
                </Button>
              </>
            ) : (
              <>
                {pixData.pixQrCodeBase64 ? (
                  <div className="mx-auto w-fit rounded-xl bg-white p-3">
                    <img src={`data:image/png;base64,${pixData.pixQrCodeBase64}`} alt="QR Code PIX" className="size-48" />
                  </div>
                ) : null}
                {pixData.pixQrCode ? (
                  <div>
                    <p className="mb-2 text-sm font-medium">Pix Copia e Cola</p>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={pixData.pixQrCode}
                        className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                      />
                      <Button type="button" variant="secondary" onClick={() => navigator.clipboard.writeText(pixData.pixQrCode ?? "")}>
                        Copiar
                      </Button>
                    </div>
                  </div>
                ) : null}
                <p className="text-center text-sm text-muted">Aguardando confirmação do pagamento…</p>
              </>
            )}
          </div>
        ) : (
          <div>
            <p className="mb-3 text-sm text-muted">Digite os dados do cartão no formulário abaixo.</p>
            {!publicKey ? (
              <p className="text-sm text-danger">Pagamento com cartão indisponível no momento.</p>
            ) : (
              <>
                {!cardReady && !error ? <p className="mb-3 text-center text-xs text-muted">Carregando formulário seguro do Mercado Pago…</p> : null}
                {loading ? <p className="mb-3 text-center text-xs text-brand">Processando pagamento…</p> : null}
                <div id={brickContainerId} className="min-h-[320px] overflow-hidden rounded-xl bg-white dark:bg-zinc-950" />
              </>
            )}
          </div>
        )}
      </div>

      <button type="button" onClick={onClose} className="mt-4 w-full text-center text-sm text-muted hover:text-brand">
        Fechar e pagar depois
      </button>
    </div>
  );
}

type MercadoPagoCardForm = {
  token?: string;
  payment_method_id?: string;
  paymentMethodId?: string;
  installments?: number;
  issuer_id?: string | number;
  issuerId?: string | number;
  identificationNumber?: string;
  payer?: { email?: string; identification?: { number?: string } };
};
