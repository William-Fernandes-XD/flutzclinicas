import { Menu, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { homeFor } from "../../lib/session";
import { useAuth } from "../../providers/AuthProvider";
import { BrandLogo } from "../BrandLogo";
import { AccountMenu } from "./AccountMenu";
import { HeaderTools } from "./HeaderTools";
import { navFor, panelVariantFor, SidebarBody, ThemeToggle } from "./panel-nav";

export function PublicClinicShell({ children }: { children: ReactNode }) {
  const { session, loading, logout, loggingOut } = useAuth();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [desktopNav, setDesktopNav] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileNav ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNav]);

  if (loading || !session) {
    return <>{children}</>;
  }

  const variant = panelVariantFor(session);
  const groups = navFor(variant, session);

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

  return (
    <div className="app-living-bg flex min-h-svh min-w-0 flex-col" data-public-panel="">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-line/80 bg-white/90 px-3 backdrop-blur-md lg:h-16 lg:px-5 dark:border-zinc-800 dark:bg-[#0f1115]/92">
        <div className="relative flex min-w-0 items-center">
          <button
            type="button"
            className="relative z-0 inline-flex size-10 items-center justify-center rounded-xl text-ink hover:bg-brand-soft hover:text-brand"
            aria-expanded={desktopNav || mobileNav}
            aria-controls="public-clinic-menu"
            aria-label={mobileNav || desktopNav ? "Recolher menu" : "Abrir menu"}
            onClick={toggleMenu}
          >
            {mobileNav ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <Link to={homeFor(session)} className="relative z-10 ml-3 min-w-0">
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
                id="public-clinic-menu"
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

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
