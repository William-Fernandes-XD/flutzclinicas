import { Menu, Moon, Sun, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { homeFor } from "../../lib/session";
import { useAuth } from "../../providers/AuthProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { BrandLogo } from "../BrandLogo";
import { Button } from "../ui/Button";
import { PageContainer } from "./PageContainer";

const NAV = [
  { href: "/#para-voce", label: "Para você" },
  { href: "/#recursos", label: "Recursos" },
  { href: "/#beneficios", label: "Benefícios" },
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/#faq", label: "FAQ" },
] as const;

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const { session, loading, logout, loggingOut } = useAuth();
  const [open, setOpen] = useState(false);
  const appHome = session ? homeFor(session) : "/login";

  async function onLogout() {
    await logout();
    setOpen(false);
    navigate("/", { replace: true });
  }

  return (
    <header className="sticky top-0 z-40 w-full min-w-0 border-b border-line/80 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-[#0f1115]/90">
      <PageContainer>
        <div className="flex h-14 w-full min-w-0 items-center justify-between gap-4">
          <Link to="/" className="shrink-0" onClick={() => setOpen(false)}>
            <BrandLogo compact className="text-ink dark:text-white" />
          </Link>

          <nav className="hidden items-center gap-5 lg:flex" aria-label="Seções da página">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium whitespace-nowrap text-muted transition-colors hover:text-brand dark:text-zinc-400 dark:hover:text-purple-300"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center justify-end gap-2">
            <div className="hidden items-center gap-2 lg:flex">
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex size-10 items-center justify-center rounded-xl text-muted hover:bg-brand-soft hover:text-brand dark:text-zinc-400 dark:hover:bg-zinc-800"
                aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
              >
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
              {loading ? null : session ? (
                <>
                  <Button to={appHome} variant="ghost">
                    Ir ao painel
                  </Button>
                  <Button variant="secondary" busy={loggingOut} busyLabel="Saindo…" onClick={onLogout}>
                    Sair
                  </Button>
                </>
              ) : (
                <>
                  <Button to="/login" variant="ghost">
                    Entrar
                  </Button>
                  <Button to="/cadastro">Começar agora</Button>
                </>
              )}
            </div>

            <button
              type="button"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-ink lg:hidden dark:text-white"
              aria-expanded={open}
              aria-controls="menu-mobile"
              aria-label={open ? "Fechar menu" : "Abrir menu"}
              onClick={() => setOpen((current) => !current)}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </PageContainer>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="menu-mobile"
            className="w-full min-w-0 border-t border-line bg-white px-4 py-4 lg:hidden dark:border-zinc-800 dark:bg-[#0f1115]"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.25 }}
          >
            <nav className="flex min-w-0 flex-col gap-2" aria-label="Menu móvel">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-xl px-3 py-2 text-sm font-medium break-words text-ink hover:bg-brand-soft dark:text-zinc-100 dark:hover:bg-zinc-800"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="mt-4 flex min-w-0 flex-col gap-2">
              {session ? (
                <>
                  <Button to={appHome} variant="secondary" className="w-full" onClick={() => setOpen(false)}>
                    Ir ao painel
                  </Button>
                  <Button variant="ghost" className="w-full" busy={loggingOut} busyLabel="Saindo…" onClick={onLogout}>
                    Sair
                  </Button>
                </>
              ) : (
                <>
                  <Button to="/login" variant="secondary" className="w-full" onClick={() => setOpen(false)}>
                    Entrar
                  </Button>
                  <Button to="/cadastro" className="w-full" onClick={() => setOpen(false)}>
                    Começar agora
                  </Button>
                </>
              )}
              <Button variant="ghost" className="w-full" onClick={toggleTheme}>
                {theme === "dark" ? "Modo claro" : "Modo escuro"}
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
