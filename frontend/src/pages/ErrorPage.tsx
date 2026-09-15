import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { goBackOrHome } from "../lib/navigation";

type ErrorPageProps = {
  code: string;
  icon: LucideIcon;
  title: string;
  description: string;
  showHome?: boolean;
};

export function ErrorPage({ code, icon: Icon, title, description, showHome = false }: ErrorPageProps) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  return (
    <section className="mx-auto flex min-h-[70vh] w-full min-w-0 max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.4 }}
      >
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-brand-soft text-brand dark:bg-brand/20">
          <Icon className="size-8" aria-hidden="true" />
        </div>
        <p className="mt-6 text-sm font-semibold tracking-wide text-brand uppercase">{code}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight break-words text-ink sm:text-3xl dark:text-white">{title}</h1>
        <p className="mt-3 text-base leading-relaxed text-muted dark:text-zinc-400">{description}</p>
        <div className="mt-8 flex w-full min-w-0 flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
          <Button onClick={() => goBackOrHome(navigate)}>Voltar onde estava</Button>
          {showHome ? (
            <Button to="/" variant="secondary">
              Ir para o início
            </Button>
          ) : null}
        </div>
      </motion.div>
    </section>
  );
}
