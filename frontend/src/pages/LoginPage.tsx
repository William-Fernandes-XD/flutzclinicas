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
    <div className="grid min-h-svh w-full bg-[#faf7fd] lg:grid-cols-2">
      <aside className="relative hidden min-h-svh overflow-hidden lg:block">
        <img
          src="/login-bg.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#2a1848]/55 via-[#3b1d6e]/25 to-[#1a0f2e]/70" />

        <div className="relative z-10 flex h-full flex-col px-10 pt-10 pb-0 xl:px-14">
          <Link to="/" className="inline-flex w-fit">
            <BrandLogo className="h-11 w-auto brightness-0 invert" />
          </Link>

          <div className="mt-12 max-w-lg">
            <p className="text-5xl font-bold tracking-tight text-white xl:text-[3.25rem] xl:leading-[1.1]">
              Flutz
            </p>
            <h1 className="mt-4 text-2xl font-semibold leading-snug text-white/95 xl:text-3xl">
              Mais saúde e bem-estar para seu pet.
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-white/80">
              Tutores e clínicas no mesmo lugar — agenda, chat e cuidado do dia a dia.
            </p>
          </div>

          <div className="relative mt-auto flex flex-1 items-end justify-center">
            <img
              src="/login-pets.png"
              alt="Cachorro e gato"
              className="max-h-[min(62vh,36rem)] w-auto max-w-[min(100%,28rem)] object-contain drop-shadow-[0_28px_60px_rgba(0,0,0,0.45)]"
            />
          </div>
        </div>
      </aside>

      <section className="relative flex min-h-svh flex-col px-5 py-8 sm:px-10 lg:px-14 xl:px-20">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link to="/" className="lg:hidden">
            <BrandLogo className="h-9 w-auto" />
          </Link>
          <p className="ml-auto text-sm text-[#6e6680]">
            Novo por aqui?{" "}
            <Link to="/cadastro?tipo=tutor" className="font-semibold text-[#7828c8] hover:underline">
              Criar conta
            </Link>
          </p>
        </div>

        <div className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center">
          <h2 className="text-3xl font-bold tracking-tight text-[#2a1848]">Bem-vindo de volta</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#6e6680]">
            Entre com e-mail ou CPF para continuar.
          </p>

          {waiting ? (
            <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {waitMessage(waitLeft)}
            </p>
          ) : null}
          {notice ? (
            <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {notice}
            </p>
          ) : null}

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block text-sm font-medium text-[#2a1848]">
              E-mail ou CPF
              <span className="relative mt-1.5 block">
                <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#9a90b0]" />
                <input
                  required
                  value={identificador}
                  onChange={(event) => setIdentificador(event.target.value)}
                  placeholder="seu@email.com ou CPF"
                  className="h-12 w-full rounded-xl border border-[#e4dcf0] bg-white pr-3 pl-10 text-sm text-[#1f1630] outline-none transition placeholder:text-[#b0a8c0] focus:border-[#7828c8]/50 focus:ring-2 focus:ring-[#7828c8]/15"
                  autoComplete="username"
                />
              </span>
            </label>

            <label className="block text-sm font-medium text-[#2a1848]">
              Senha
              <span className="relative mt-1.5 block">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#9a90b0]" />
                <input
                  required
                  type={mostrarSenha ? "text" : "password"}
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  placeholder="Digite sua senha"
                  className="h-12 w-full rounded-xl border border-[#e4dcf0] bg-white pr-11 pl-10 text-sm text-[#1f1630] outline-none transition placeholder:text-[#b0a8c0] focus:border-[#7828c8]/50 focus:ring-2 focus:ring-[#7828c8]/15"
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

            <div className="flex items-center justify-between gap-3 pt-1">
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
              className="h-12 w-full !rounded-xl text-base"
              busy={loading || waiting}
              busyLabel={loading ? "Entrando…" : "Aguarde…"}
            >
              Entrar →
            </Button>
          </form>

          <div className="my-8 flex items-center gap-3">
            <span className="h-px flex-1 bg-[#ebe4f4]" />
            <span className="text-xs font-medium tracking-wide text-[#9a90b0] uppercase">ou</span>
            <span className="h-px flex-1 bg-[#ebe4f4]" />
          </div>

          <p className="mb-3 text-sm font-medium text-[#2a1848]">Não tem uma conta?</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              to="/cadastro?tipo=clinica&plano=flutz"
              className="group flex items-start gap-3 rounded-2xl border border-[#ebe4f4] bg-white p-4 transition hover:border-[#d4c4ef] hover:bg-[#faf7fd]"
            >
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#f3eafc] text-[#7828c8]">
                <Building2 className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="font-semibold text-[#2a1848]">Cadastrar clínica</span>
                <span className="mt-0.5 block text-xs leading-snug text-[#6e6680]">
                  Sou uma clínica veterinária e quero usar o Flutz.
                </span>
              </span>
            </Link>
            <Link
              to="/cadastro?tipo=tutor"
              className="group flex items-start gap-3 rounded-2xl border border-[#ebe4f4] bg-white p-4 transition hover:border-[#d4c4ef] hover:bg-[#faf7fd]"
            >
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#f3eafc] text-[#7828c8]">
                <UserRound className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="font-semibold text-[#2a1848]">Cadastrar tutor</span>
                <span className="mt-0.5 block text-xs leading-snug text-[#6e6680]">
                  Quero cuidar do meu pet e agendar na minha clínica.
                </span>
              </span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
