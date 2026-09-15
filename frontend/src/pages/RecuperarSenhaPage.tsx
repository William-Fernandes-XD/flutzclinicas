import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageContainer } from "../components/layout/PageContainer";
import { Button } from "../components/ui/Button";
import { http, HttpError } from "../lib/http";

type Step = "pedir" | "codigo";

export function RecuperarSenhaPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("pedir");
  const [identificador, setIdentificador] = useState("");
  const [codigo, setCodigo] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((atual) => Math.max(0, atual - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  async function pedirCodigo(event?: FormEvent) {
    event?.preventDefault();
    if (loading || cooldown > 0) return;
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await http<{ message: string }>("/api/auth/recuperar", {
        method: "POST",
        json: { identificador },
      });
      setInfo(
        res.message ||
          "Se houver uma conta com esses dados, enviamos um código de 6 dígitos para o e-mail cadastrado.",
      );
      setStep("codigo");
      setCooldown(60);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Não foi possível enviar o código.");
    } finally {
      setLoading(false);
    }
  }

  async function redefinir(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError("");
    if (novaSenha !== confirmacao) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      await http("/api/auth/redefinir", {
        method: "POST",
        json: { identificador, codigo, novaSenha },
      });
      navigate("/login", {
        replace: true,
        state: { notice: "Senha atualizada. Entre com os novos dados." },
      });
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Não foi possível redefinir a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer className="max-w-lg py-12 sm:py-16">
      <p className="text-sm font-semibold tracking-wide text-brand uppercase">Recuperação de acesso</p>
      <h1 className="mt-2 text-3xl font-bold text-ink dark:text-white">Esqueci minha senha</h1>
      <ol className="mt-4 flex gap-2 text-xs font-semibold">
        <li className={`rounded-full px-3 py-1 ${step === "pedir" ? "bg-brand text-white" : "bg-brand-soft text-brand"}`}>
          1. Identificar
        </li>
        <li className={`rounded-full px-3 py-1 ${step === "codigo" ? "bg-brand text-white" : "bg-brand-soft text-brand"}`}>
          2. Código e nova senha
        </li>
      </ol>
      <p className="mt-4 text-sm text-muted">
        Informe o e-mail de acesso ou o CPF do tutor. Por segurança, a resposta é a mesma se a conta existir ou não.
        Confira a caixa de entrada e o spam.
      </p>

      {step === "pedir" ? (
        <form onSubmit={(event) => void pedirCodigo(event)} className="mt-8 space-y-4 rounded-2xl border border-line bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <label className="block text-sm font-medium">
            E-mail ou CPF
            <input
              required
              value={identificador}
              onChange={(event) => setIdentificador(event.target.value)}
              className="mt-1 w-full rounded-xl border border-line px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              autoComplete="username"
            />
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" className="w-full" busy={loading} busyLabel="Enviando…">
            Enviar código
          </Button>
        </form>
      ) : (
        <form onSubmit={redefinir} className="mt-8 space-y-4 rounded-2xl border border-line bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          {info ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100">
              {info}
            </p>
          ) : null}
          <label className="block text-sm font-medium">
            Código recebido por e-mail
            <input
              required
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={codigo}
              onChange={(event) => setCodigo(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-1 w-full rounded-xl border border-line px-3 py-2 tracking-[0.4em] dark:border-zinc-700 dark:bg-zinc-950"
              autoComplete="one-time-code"
            />
          </label>
          <label className="block text-sm font-medium">
            Nova senha
            <input
              required
              type="password"
              minLength={8}
              value={novaSenha}
              onChange={(event) => setNovaSenha(event.target.value)}
              className="mt-1 w-full rounded-xl border border-line px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              autoComplete="new-password"
            />
          </label>
          <label className="block text-sm font-medium">
            Confirmar nova senha
            <input
              required
              type="password"
              minLength={8}
              value={confirmacao}
              onChange={(event) => setConfirmacao(event.target.value)}
              className="mt-1 w-full rounded-xl border border-line px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              autoComplete="new-password"
            />
          </label>
          <p className="text-xs text-muted">A senha precisa ter pelo menos 8 caracteres.</p>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" className="w-full" busy={loading} busyLabel="Salvando…">
            Redefinir senha
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm font-medium text-brand hover:underline disabled:opacity-50"
            disabled={loading || cooldown > 0}
            onClick={() => void pedirCodigo()}
          >
            {cooldown > 0 ? `Reenviar código em ${cooldown}s` : "Reenviar código"}
          </button>
          <button
            type="button"
            className="w-full text-center text-sm text-muted hover:underline"
            onClick={() => {
              setError("");
              setStep("pedir");
            }}
          >
            Usar outro e-mail ou CPF
          </button>
        </form>
      )}

      <p className="mt-6 text-sm text-muted">
        Lembrou a senha?{" "}
        <Link to="/login" className="font-medium text-brand hover:underline">
          Entrar
        </Link>
      </p>
    </PageContainer>
  );
}
