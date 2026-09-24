import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CreditCard, Lock, QrCode, Tag, Zap } from "lucide-react";
import { Button } from "./ui/Button";
import { ErrorState } from "./ui/EmptyState";
import { Field, Input } from "./ui/Field";
import { HttpError } from "../lib/http";
import { api, type Mensalidade, type PaymentResult } from "../services/api";
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

function formatPercent(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—";
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)}%`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
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

/** Device ID do security.js — melhora aprovação e atende critério de qualidade do MP. */
function loadMercadoPagoDeviceId(): Promise<string | null> {
  const existingId = window.MP_DEVICE_SESSION_ID;
  if (existingId && String(existingId).trim()) {
    return Promise.resolve(String(existingId).trim());
  }
  const existing = document.querySelector('script[data-mp-security="v2"]');
  const waitForId = (timeoutMs = 2500): Promise<string | null> =>
    new Promise((resolve) => {
      const started = Date.now();
      const tick = () => {
        const id = window.MP_DEVICE_SESSION_ID;
        if (id && String(id).trim()) {
          resolve(String(id).trim());
          return;
        }
        if (Date.now() - started >= timeoutMs) {
          resolve(null);
          return;
        }
        window.setTimeout(tick, 80);
      };
      tick();
    });
  if (existing) {
    return waitForId();
  }
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://www.mercadopago.com/v2/security.js";
    script.async = true;
    script.dataset.mpSecurity = "v2";
    script.setAttribute("view", "checkout");
    script.onload = () => {
      void waitForId().then(resolve);
    };
    script.onerror = () => resolve(null);
    document.body.appendChild(script);
  });
}

export function PaymentModal({
  onPaid,
  onClose,
  initialCpf = "",
  openToken = false,
}: {
  onPaid: () => void;
  onClose: () => void;
  initialCpf?: string;
  openToken?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} aria-label="Fechar" />
      <div className="relative flex max-h-[94vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-zinc-900 sm:rounded-3xl">
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <CreditCard className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-ink dark:text-white">Pagar mensalidade</h2>
              <p className="text-xs text-muted">Escolha a forma de pagamento e conclua com segurança</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-zinc-100 hover:text-ink dark:hover:bg-zinc-800"
            aria-label="Fechar modal"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5 pt-2">
          <PaymentCheckout onPaid={onPaid} onClose={onClose} initialCpf={initialCpf} openToken={openToken} />
        </div>
      </div>
    </div>
  );
}

export function PaymentCheckout({
  onPaid,
  onClose,
  initialCpf = "",
  embedded = false,
  openToken = false,
}: {
  onPaid: () => void;
  onClose?: () => void;
  initialCpf?: string;
  embedded?: boolean;
  openToken?: boolean;
}) {
  const reactId = useId().replace(/:/g, "");
  const brickContainerId = `cardPaymentBrick-${reactId}`;
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [step, setStep] = useState<"setup" | "pay">("setup");
  const [pixData, setPixData] = useState<PaymentResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [cpf, setCpf] = useState(formatCpf(initialCpf));
  const [tokenOpen, setTokenOpen] = useState(openToken);
  const [tokenCode, setTokenCode] = useState("");
  const [tokenMsg, setTokenMsg] = useState("");
  const brickControllerRef = useRef<{ unmount?: () => Promise<void> } | null>(null);
  const submittingRef = useRef(false);
  const cpfRef = useRef(cpf);
  const payWithCardTokenRef = useRef<(formData: MercadoPagoCardForm) => Promise<void>>(async () => undefined);

  useEffect(() => {
    cpfRef.current = cpf;
  }, [cpf]);

  const mensalidade = useQuery({ queryKey: ["clinica", "mensalidade"], queryFn: api.mensalidade });
  const mpConfig = useQuery({
    queryKey: ["mp-config"],
    queryFn: api.pagamentoConfig,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const handlePaid = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["clinica", "mensalidade"] });
    onPaid();
  }, [queryClient, onPaid]);

  useEffect(() => {
    if (!mensalidade.data?.faturaId) return;
    api.statusPagamento()
      .then((res) => {
        if (res.paid) handlePaid();
        else if (res.pixQrCode) {
          setPixData(res);
          setMethod("pix");
          setStep("pay");
        }
      })
      .catch(() => undefined);
  }, [mensalidade.data?.faturaId, handlePaid]);

  async function aplicarToken(event: FormEvent) {
    event.preventDefault();
    setTokenMsg("");
    setError("");
    try {
      await api.aplicarTokenAssinatura(tokenCode);
      setTokenCode("");
      setTokenMsg("Token aplicado. O valor já considera o desconto.");
      setPixData(null);
      setStep("setup");
      await queryClient.invalidateQueries({ queryKey: ["clinica", "mensalidade"] });
    } catch (err) {
      setTokenMsg(err instanceof HttpError ? err.message : "Não foi possível aplicar o token.");
    }
  }

  useEffect(() => {
    void loadMercadoPagoDeviceId();
  }, []);

  const payWithCardToken = useCallback(async (formData: MercadoPagoCardForm) => {
    setError("");
    setLoading(true);
    try {
      const token = formData?.token;
      const paymentMethodId = formData?.payment_method_id || formData?.paymentMethodId;
      const installments = Number(formData?.installments || 1);
      const issuerId = formData?.issuer_id != null
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
      const deviceId = await loadMercadoPagoDeviceId();
      const res = await api.pagarCartao({
        token,
        paymentMethodId,
        installments,
        issuerId,
        payerEmail: formData?.payer?.email || session?.identificador,
        payerName: session?.nome || formData?.payer?.email || "Clínica",
        payerCpf: formatCpf(payerCpf),
        deviceId,
      });
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
  }, [handlePaid, session]);

  useEffect(() => {
    payWithCardTokenRef.current = payWithCardToken;
  }, [payWithCardToken]);

  useEffect(() => {
    if (!mpConfig.data?.publicKey || method !== "card" || step !== "pay" || !mensalidade.data) {
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
        const publicKey = mpConfig.data.publicKey;
        if (!publicKey) return;
        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        const amount = Number(mensalidade.data.valorAPagar ?? mensalidade.data.valor ?? mensalidade.data.valorMensal ?? 0);
        const controller = await mp.bricks().create("cardPayment", brickContainerId, {
          initialization: {
            amount: Math.max(amount, 0.01),
            payer: { email: session?.identificador || undefined },
          },
          customization: {
            visual: {
              style: { theme: "default" },
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
  }, [mpConfig.data?.publicKey, method, step, mensalidade.data?.faturaId, mensalidade.data?.valor, mensalidade.data?.valorAPagar, brickContainerId, session?.identificador]);

  useEffect(() => {
    if (!pixData || pixData.paid) return undefined;
    const interval = window.setInterval(async () => {
      try {
        const res = await api.statusPagamento();
        if (res.paid) handlePaid();
      } catch {
        /* ignore */
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [pixData, handlePaid]);

  async function handleGeneratePayment() {
    if (loading) return;
    setError("");
    if (onlyDigits(cpf).length !== 11) {
      setError("Informe um CPF válido com 11 dígitos para gerar o pagamento.");
      return;
    }
    if (method === "card") {
      if (!mpConfig.data?.publicKey) {
        setError("Configure MERCADOPAGO_PUBLIC_KEY e MERCADOPAGO_ACCESS_TOKEN no .env.");
        return;
      }
      setStep("pay");
      return;
    }
    setLoading(true);
    try {
      const deviceId = await loadMercadoPagoDeviceId();
      const res = await api.pagarPix({ deviceId });
      setPixData(res);
      setStep("pay");
      if (res.paid) handlePaid();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Erro ao gerar PIX.");
    } finally {
      setLoading(false);
    }
  }

  const data: Mensalidade | undefined = mensalidade.data;
  const amount = data?.valorAPagar ?? data?.valor ?? data?.valorMensal;
  const vencimento = data?.vencimentoFatura ?? data?.proximoVencimento;

  if (mensalidade.isLoading) {
    return <p className="py-8 text-center text-sm text-muted">Carregando a mensalidade…</p>;
  }
  if (!data?.faturaId) {
    return <p className="py-8 text-center text-sm text-muted">Não há fatura em aberto para pagar.</p>;
  }

  return (
    <div className={embedded ? "mx-auto max-w-md" : undefined}>
      <div className="grid grid-cols-2 gap-3 rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-950/60">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Valor da mensalidade</p>
          <p className="mt-1 text-base font-bold text-ink dark:text-white">{money(amount)}</p>
          {data.codigoTokenAplicado ? (
            <p className="mt-0.5 text-[11px] text-brand">
              Token {data.codigoTokenAplicado} (−{formatPercent(data.percentualDescontoAplicado)})
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Vencimento</p>
          <p className="mt-1 text-base font-bold text-ink dark:text-white">{formatDate(vencimento)}</p>
        </div>
      </div>

      {error ? <div className="mt-4"><ErrorState message={error} /></div> : null}

      {step === "setup" ? (
        <>
          <p className="mt-5 text-sm font-semibold text-ink dark:text-white">Forma de pagamento</p>
          <div className="mt-3 grid gap-3">
            <button
              type="button"
              onClick={() => setMethod("pix")}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                method === "pix"
                  ? "border-brand bg-brand-soft/40 ring-1 ring-brand/30"
                  : "border-line bg-white hover:border-brand/40 dark:border-zinc-700 dark:bg-zinc-900"
              }`}
            >
              <span className={`flex size-10 items-center justify-center rounded-xl ${method === "pix" ? "bg-brand text-white" : "bg-zinc-100 text-brand dark:bg-zinc-800"}`}>
                <QrCode className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink dark:text-white">Pix</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Mais rápido</span>
                </span>
                <span className="mt-0.5 block text-xs text-muted">Pagamento instantâneo</span>
              </span>
              <span className={`flex size-5 items-center justify-center rounded-full border-2 ${method === "pix" ? "border-brand bg-brand text-white" : "border-zinc-300"}`}>
                {method === "pix" ? <Check className="size-3" strokeWidth={3} /> : null}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMethod("card")}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                method === "card"
                  ? "border-brand bg-brand-soft/40 ring-1 ring-brand/30"
                  : "border-line bg-white hover:border-brand/40 dark:border-zinc-700 dark:bg-zinc-900"
              }`}
            >
              <span className={`flex size-10 items-center justify-center rounded-xl ${method === "card" ? "bg-brand text-white" : "bg-zinc-100 text-brand dark:bg-zinc-800"}`}>
                <CreditCard className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-ink dark:text-white">Cartão de crédito</span>
                <span className="mt-0.5 block text-xs text-muted">Parcele em até 12x</span>
              </span>
              <span className={`flex size-5 items-center justify-center rounded-full border-2 ${method === "card" ? "border-brand bg-brand text-white" : "border-zinc-300"}`}>
                {method === "card" ? <Check className="size-3" strokeWidth={3} /> : null}
              </span>
            </button>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setTokenOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-2xl border border-dashed border-line px-4 py-3 text-left dark:border-zinc-700"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-ink dark:text-white">
                <Tag className="size-4 text-brand" />
                Aplicar token de desconto
              </span>
              <span className="text-xs text-muted">{tokenOpen ? "Ocultar" : "Abrir"}</span>
            </button>
            {tokenOpen ? (
              <form onSubmit={aplicarToken} className="mt-3 grid gap-3 rounded-2xl border border-line bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field label="Código do token">
                  <Input
                    value={tokenCode}
                    onChange={(event) => setTokenCode(event.target.value)}
                    placeholder="Ex.: BEMVINDO10"
                    autoComplete="off"
                  />
                </Field>
                <Button type="submit" variant="secondary" disabled={!tokenCode.trim()}>
                  Aplicar
                </Button>
                {tokenMsg ? <p className="sm:col-span-2 text-sm text-brand">{tokenMsg}</p> : null}
              </form>
            ) : null}
          </div>

          <div className="mt-4">
            <Field label="CPF do responsável" hint="Necessário para Pix e cartão.">
              <Input
                inputMode="numeric"
                autoComplete="off"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(event) => setCpf(formatCpf(event.target.value))}
              />
            </Field>
          </div>

          <Button
            type="button"
            className="mt-5 w-full"
            busy={loading}
            busyLabel="Gerando…"
            onClick={handleGeneratePayment}
          >
            <span className="inline-flex items-center gap-2">
              <Zap className="size-4" />
              Gerar pagamento
            </span>
          </Button>
        </>
      ) : (
        <div className="mt-5 space-y-4">
          <button
            type="button"
            className="text-sm font-medium text-brand hover:underline"
            onClick={() => {
              setStep("setup");
              setPixData(null);
              setError("");
            }}
          >
            ← Voltar e alterar forma de pagamento
          </button>

          {method === "pix" ? (
            <div className="space-y-4 rounded-2xl border border-line bg-brand-soft/30 p-4 dark:border-zinc-800">
              {pixData?.pixQrCodeBase64 ? (
                <div className="mx-auto w-fit rounded-xl bg-white p-3">
                  <img src={`data:image/png;base64,${pixData.pixQrCodeBase64}`} alt="QR Code PIX" className="size-48" />
                </div>
              ) : null}
              {pixData?.pixQrCode ? (
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
              ) : (
                <p className="text-center text-sm text-muted">Gerando QR Code…</p>
              )}
              <p className="text-center text-sm text-muted">Aguardando confirmação do pagamento…</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-brand-soft/30 p-4 dark:border-zinc-800">
              <p className="mb-3 text-sm text-muted">Digite os dados do cartão no formulário abaixo.</p>
              {!mpConfig.data?.publicKey ? (
                <p className="text-sm text-danger">
                  Pagamento com cartão indisponível. Configure as chaves do Mercado Pago no `.env`.
                </p>
              ) : (
                <>
                  {!cardReady && !error ? <p className="mb-3 text-center text-xs text-muted">Carregando formulário seguro…</p> : null}
                  {loading ? <p className="mb-3 text-center text-xs text-brand">Processando pagamento…</p> : null}
                  <div id={brickContainerId} className="min-h-[320px] overflow-hidden rounded-xl bg-white dark:bg-zinc-950" />
                </>
              )}
            </div>
          )}
        </div>
      )}

      <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted">
        <Lock className="size-3.5" />
        Pagamento seguro e criptografado
      </p>

      {onClose && embedded ? (
        <button type="button" onClick={onClose} className="mt-3 w-full text-center text-sm text-muted hover:text-brand">
          Fechar e pagar depois
        </button>
      ) : null}
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
