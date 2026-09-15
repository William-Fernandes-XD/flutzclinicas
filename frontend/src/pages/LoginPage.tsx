import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { BrandLogo } from "../components/BrandLogo";
import { PageContainer } from "../components/layout/PageContainer";
import { Button } from "../components/ui/Button";
import { http, HttpError, waitMessage } from "../lib/http";
import { safeNextPath } from "../lib/return-path";
import { homeFor, type Session } from "../lib/session";
import { useAuth } from "../providers/AuthProvider";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const { refresh, session, loading: sessionLoading } = useAuth();
  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    typeof location.state === "object" && location.state && "notice" in location.state
      ? String((location.state as { notice?: string }).notice ?? "")
      : "",
  );
  const [loading, setLoading] = useState(false);
  const [waitUntil, setWaitUntil] = useState<number | null>(null);
  const [waitLeft, setWaitLeft] = useState(0);

  useEffect(() => {
    if (!waitUntil) {
      setWaitLeft(0);
      return;
    }
    const until = waitUntil;
    function tick() {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setWaitLeft(left);
      if (left <= 0) {
        setWaitUntil(null);
      }
    }
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [waitUntil]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading || waitLeft > 0) {
      return;
    }
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const next = await http<Session>("/api/auth/login", {
        method: "POST",
        json: { identificador, senha },
      });
      await refresh();
      navigate(nextPath ?? homeFor(next), { replace: true });
    } catch (err) {
      const httpErr = err instanceof HttpError ? err : null;
      if (httpErr?.retryAfterSeconds) {
        setWaitUntil(Date.now() + httpErr.retryAfterSeconds * 1000);
        setWaitLeft(httpErr.retryAfterSeconds);
      }
      if (httpErr?.status === 429) {
        setError("");
      } else {
        setError(httpErr?.message ?? "Não foi possível entrar.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (!sessionLoading && session) {
    return <Navigate to={nextPath ?? homeFor(session)} replace />;
  }

  const waiting = waitLeft > 0;

  return (
    <PageContainer className="max-w-5xl py-10 sm:py-16">
      <div className="grid overflow-hidden rounded-3xl border border-line bg-white shadow-[0_24px_60px_-32px_rgba(120,40,200,0.45)] lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)] dark:border-zinc-800 dark:bg-zinc-900">
        <aside className="relative hidden min-h-[28rem] bg-[#2a1020] p-8 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(232,121,249,0.35),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(251,191,36,0.22),transparent_40%)]" />
          <div className="relative">
            <BrandLogo className="brightness-0 invert" />
            <p className="mt-8 text-sm font-semibold tracking-[0.18em] text-amber-200 uppercase">Acesso</p>
            <h1 className="mt-3 max-w-sm text-3xl font-bold tracking-tight">A clínica inteira em um só lugar.</h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/80">
              Colaboradores e a administração da plataforma entram com e-mail. Tutores entram com CPF.
            </p>
          </div>
          <p className="relative text-xs text-white/55">Gestão veterinária Flutz · UpVibe</p>
        </aside>

        <div className="p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-ink lg:hidden dark:text-white">Entrar no Flutz</h1>
          <p className="mt-1 text-sm text-muted lg:hidden">
            Colaborador e administrador: e-mail e senha. Tutor: CPF e senha.
          </p>
          <p className="hidden text-sm text-muted lg:block">Entre com os dados da sua conta.</p>

          {waiting ? (
            <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
              {waitMessage(waitLeft)}
            </p>
          ) : null}
          {notice ? (
            <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100">
              {notice}
            </p>
          ) : null}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              E-mail ou CPF
              <input
                required
                value={identificador}
                onChange={(event) => setIdentificador(event.target.value)}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-950"
                autoComplete="username"
              />
            </label>
            <label className="block text-sm font-medium">
              Senha
              <input
                required
                type="password"
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-950"
                autoComplete="current-password"
              />
            </label>
            <div className="flex items-center justify-between gap-3">
              <Link to="/recuperar-senha" className="text-sm font-medium text-brand hover:underline">
                Esqueci minha senha
              </Link>
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button
              type="submit"
              className="w-full"
              busy={loading || waiting}
              busyLabel={loading ? "Entrando…" : "Aguarde…"}
            >
              Entrar
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted">
            Tutor novo?{" "}
            <Link to="/cadastro?tipo=tutor" className="font-medium text-brand hover:underline">
              Criar conta
            </Link>
            {" · "}
            Clínica nova?{" "}
            <Link to="/cadastro?tipo=clinica" className="font-medium text-brand hover:underline">
              Cadastrar empresa
            </Link>
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
