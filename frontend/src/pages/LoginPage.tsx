import { Building2, Eye, EyeOff, Lock, Mail, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { BrandLogo } from "../components/BrandLogo";
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
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [lembrar, setLembrar] = useState(true);
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
    <div className="flex min-h-svh w-full items-center justify-center bg-[#f3ecfb] px-4 py-6 sm:px-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[1.75rem] bg-[#faf7fd] shadow-xl ring-1 ring-[#e4dcf0] lg:h-[34rem] lg:grid-cols-2">
        <aside
          className="relative hidden min-h-0 overflow-hidden bg-[#faf8fc] bg-cover bg-center bg-no-repeat lg:block"
          style={{ backgroundImage: "url('/login-bg.png?v=2')" }}
        >
          <div className="relative z-10 flex h-full min-h-0 flex-col justify-between gap-3 overflow-hidden px-10 py-9 xl:px-14">
            <div className="min-h-0 shrink-0">
              <Link to="/" className="inline-flex w-fit">
                <BrandLogo
                  compact
                  className="gap-3 text-[#2a1848] [&_.brand-logo-mark]:size-12 sm:[&_.brand-logo-mark]:size-14 [&>span]:text-xl sm:[&>span]:text-2xl"
                />
              </Link>
              <h1 className="mt-5 max-w-md text-2xl font-semibold leading-snug text-[#2a1848] xl:text-[1.7rem]">
                Mais saúde e bem-estar para seu pet.
              </h1>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[#5c4d78]">
                Tutores e clínicas no mesmo lugar — agenda, chat e cuidado do dia a dia.
              </p>
            </div>
            <div className="mt-auto flex shrink-0 justify-center">
              <img
                src="/login-pets.png?v=9"
                alt="Cachorro e gato"
                className="h-44 w-auto max-w-[92%] object-contain object-bottom drop-shadow-md"
              />
            </div>
          </div>
        </aside>

        <section className="relative flex min-h-0 flex-col justify-center overflow-hidden bg-[#faf7fd] px-5 py-6 sm:px-10 lg:px-11 xl:px-12">
          <div className="mx-auto w-full max-w-[24rem]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <Link to="/" className="lg:hidden">
                <BrandLogo className="h-8 w-auto" />
              </Link>
              <p className="ml-auto text-sm text-[#6e6680]">
                Novo por aqui?{" "}
                <Link to="/cadastro?tipo=tutor" className="font-semibold text-[#7828c8] hover:underline">
                  Criar conta
                </Link>
              </p>
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-[#2a1848]">Bem-vindo de volta</h2>
            <p className="mt-1 text-sm text-[#6e6680]">Entre com e-mail ou CPF para continuar.</p>

            {waiting ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {waitMessage(waitLeft)}
              </p>
            ) : null}
            {notice ? (
              <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                {notice}
              </p>
            ) : null}

            <form onSubmit={onSubmit} className="mt-5 space-y-3">
              <label className="block text-sm font-medium text-[#2a1848]">
                E-mail ou CPF
                <span className="relative mt-1 block">
                  <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#9a90b0]" />
                  <input
                    required
                    value={identificador}
                    onChange={(event) => setIdentificador(event.target.value)}
                    placeholder="seu@email.com ou CPF"
                    className="h-11 w-full rounded-xl border border-[#e4dcf0] bg-white pr-3 pl-10 text-sm text-[#1f1630] outline-none transition placeholder:text-[#b0a8c0] focus:border-[#7828c8]/50 focus:ring-2 focus:ring-[#7828c8]/15"
                    autoComplete="username"
                  />
                </span>
              </label>

              <label className="block text-sm font-medium text-[#2a1848]">
                Senha
                <span className="relative mt-1 block">
                  <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#9a90b0]" />
                  <input
                    required
                    type={mostrarSenha ? "text" : "password"}
                    value={senha}
                    onChange={(event) => setSenha(event.target.value)}
                    placeholder="Digite sua senha"
                    className="h-11 w-full rounded-xl border border-[#e4dcf0] bg-white pr-11 pl-10 text-sm text-[#1f1630] outline-none transition placeholder:text-[#b0a8c0] focus:border-[#7828c8]/50 focus:ring-2 focus:ring-[#7828c8]/15"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-[#9a90b0] hover:text-[#7828c8]"
                    onClick={() => setMostrarSenha((v) => !v)}
                    aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </span>
              </label>

              <div className="flex items-center justify-between gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[#5c4d78]">
                  <input
                    type="checkbox"
                    checked={lembrar}
                    onChange={(event) => setLembrar(event.target.checked)}
                    className="size-4 rounded border-[#d8cce8] text-[#7828c8] focus:ring-[#7828c8]/30"
                  />
                  Lembrar de mim
                </label>
                <Link to="/recuperar-senha" className="text-sm font-semibold text-[#7828c8] hover:underline">
                  Esqueci minha senha
                </Link>
              </div>

              {error ? <p className="text-sm text-danger">{error}</p> : null}

              <Button
                type="submit"
                className="h-11 w-full !rounded-xl text-base"
                busy={loading || waiting}
                busyLabel={loading ? "Entrando…" : "Aguarde…"}
              >
                Entrar →
              </Button>
            </form>

            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#6e6680]">
              <Link
                to="/cadastro?tipo=clinica&plano=flutz"
                className="inline-flex items-center gap-1.5 font-semibold text-[#7828c8] hover:underline"
              >
                <Building2 className="size-3.5" />
                Cadastrar clínica
              </Link>
              <span className="text-[#cfc4e0]">·</span>
              <Link
                to="/cadastro?tipo=tutor"
                className="inline-flex items-center gap-1.5 font-semibold text-[#7828c8] hover:underline"
              >
                <UserRound className="size-3.5" />
                Cadastrar tutor
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
