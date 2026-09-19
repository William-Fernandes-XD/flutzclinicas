import { useQuery } from "@tanstack/react-query";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearLastClinic, readLastClinic } from "../../lib/clinic-storage";
import { homeFor, isPlatformAdmin } from "../../lib/session";
import { useAuth } from "../../providers/AuthProvider";
import { useClinicBrand } from "../../providers/ClinicContext";
import { api } from "../../services/api";
import { BrandLogo } from "../BrandLogo";
import { AccountMenu } from "./AccountMenu";
import { HeaderTools } from "./HeaderTools";
import { navFor, SidebarBody, ThemeToggle, type PanelVariant } from "./panel-nav";

export function AppShell({ variant }: { variant: PanelVariant }) {
  const { session, logout, loggingOut, setClinic } = useAuth();
  const clinic = useClinicBrand();
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();
  const [leavingAdmin, setLeavingAdmin] = useState(false);
  const [desktopNav, setDesktopNav] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const groups = navFor(variant, session);
  const pageBuilder = location.pathname === "/app/pagina";
  const acesso = useQuery({
    queryKey: ["assinatura", "acesso", session?.empresaId],
    queryFn: api.acessoAssinatura,
    enabled: variant === "clinic" && session?.tipo === "COLABORADOR" && session.empresaId != null,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    document.body.style.overflow = mobileNav ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNav]);

  useEffect(() => {
    if (variant !== "client" || !session || session.empresaId) return;
    const last = readLastClinic(session.atorId);
    if (!last) return;
    void setClinic(last).catch(() => clearLastClinic(session.atorId));
  }, [session, setClinic, variant]);

  useEffect(() => {
    if (acesso.data?.podeOperar !== false) return;
    const liberada = ["/app/assinatura", "/app/suporte", "/app/configuracoes"].some((path) =>
      location.pathname.startsWith(path),
    );
    if (!liberada) navigate("/app/assinatura", { replace: true });
  }, [acesso.data?.podeOperar, location.pathname, navigate]);

  async function onLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  function toggleMenu() {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setDesktopNav((value) => !value);
      return;
    }
    setMobileNav((value) => !value);
  }

  const menuOpen = mobileNav;

  return (
    <div className="app-living-bg flex min-h-svh min-w-0 flex-col">
      {isPlatformAdmin(session) && session?.empresaId && clinic ? (
        <div className="bg-ink px-4 py-2 text-center text-xs text-white sm:text-sm">
          Administrando {clinic.nome} como equipe Flutz.{" "}
          <button
            type="button"
            className="font-semibold underline underline-offset-2 disabled:opacity-50"
            disabled={leavingAdmin}
            onClick={() => {
              if (leavingAdmin) return;
              setLeavingAdmin(true);
              void setClinic(null)
                .then(() => navigate("/admin"))
                .finally(() => setLeavingAdmin(false));
            }}
          >
            {leavingAdmin ? "Saindo…" : "Voltar para a administração"}
          </button>
        </div>
      ) : null}
      {variant === "clinic" && acesso.data?.podeOperar === false ? (
        <div className="bg-amber-500 px-4 py-2 text-center text-xs font-semibold text-amber-950 sm:text-sm">
          A clínica está com a mensalidade em atraso. Regularize em Assinatura para liberar as operações.
        </div>
      ) : null}

      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-line/80 bg-white/90 px-3 backdrop-blur-md lg:h-16 lg:px-5 dark:border-zinc-800 dark:bg-[#0f1115]/92">
        <div className="relative flex min-w-0 items-center">
          <button
            type="button"
            className="relative z-0 inline-flex size-10 items-center justify-center rounded-xl text-ink hover:bg-brand-soft hover:text-brand"
            aria-expanded={desktopNav || mobileNav}
            aria-controls="app-menu"
            aria-label={menuOpen || desktopNav ? "Recolher menu" : "Abrir menu"}
            onClick={toggleMenu}
          >
            {mobileNav ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <Link to={session ? homeFor(session) : "/"} className="relative z-10 ml-3 min-w-0">
            <BrandLogo compact className="text-ink dark:text-white" />
          </Link>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
          <HeaderTools variant={variant} />
          <ThemeToggle />
          <div className="shrink-0 sm:min-w-[16rem]">
            <AccountMenu />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1">
        {desktopNav ? (
          <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-64 shrink-0 flex-col border-r border-line bg-white lg:flex lg:top-16 lg:h-[calc(100svh-4rem)] dark:border-zinc-800 dark:bg-[#12141a]">
            <SidebarBody
              variant={variant}
              groups={groups}
              session={session}
              onLogout={() => void onLogout()}
              loggingOut={loggingOut}
            />
          </aside>
        ) : null}

        <AnimatePresence>
          {mobileNav ? (
            <motion.div
              className="fixed inset-0 top-14 z-50 lg:hidden"
              initial={reduce ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Fechar menu" onClick={() => setMobileNav(false)} />
              <motion.aside
                id="app-menu"
                className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl dark:bg-[#12141a]"
                initial={reduce ? { x: 0 } : { x: -24 }}
                animate={{ x: 0 }}
                exit={{ x: -24 }}
                aria-label="Menu"
              >
                <SidebarBody
                  variant={variant}
                  groups={groups}
                  session={session}
                  onLogout={() => void onLogout()}
                  loggingOut={loggingOut}
                  onNavigate={() => setMobileNav(false)}
                />
              </motion.aside>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <main
          className={
            pageBuilder
              ? "flex h-[calc(100svh-3.5rem)] w-full min-w-0 flex-1 flex-col overflow-hidden p-0 lg:h-[calc(100svh-4rem)]"
              : "mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8"
          }
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
