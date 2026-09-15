import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { CookieBanner } from "../CookieBanner";
import { Footer } from "./Footer";
import { Header } from "./Header";

export function MarketingLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-svh w-full min-w-0 flex-col bg-white dark:bg-[#0f1115]">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-3 focus:py-2 focus:text-white"
      >
        Ir para o conteúdo
      </a>
      <Header />
      <main id="conteudo" className="min-w-0 flex-1">
        {children ?? <Outlet />}
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
}
