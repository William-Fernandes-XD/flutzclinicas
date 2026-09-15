import { motion, useReducedMotion } from "motion/react";
import { Button } from "../../components/ui/Button";
import { PageContainer } from "../../components/layout/PageContainer";
import { HeroPets } from "./HeroPets";

export function HeroSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-x-clip">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(120,40,200,0.08),transparent_42%)]" />
      <PageContainer className="grid grid-cols-1 items-center gap-8 py-10 sm:gap-10 sm:py-14 xl:grid-cols-2 xl:py-16">
        <motion.div
          className="min-w-0"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="mb-4 text-sm font-semibold tracking-wide text-brand uppercase">
            Tutores e clínicas veterinárias
          </p>
          <h1 className="text-[1.65rem] font-bold tracking-tight break-words text-ink sm:text-3xl xl:text-4xl dark:text-white">
            O cuidado do pet e a gestão da clínica, no mesmo lugar
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg dark:text-zinc-400">
            Tutores encontram clínicas próximas e pedem um horário. Clínicas organizam
            tutores, pets, agenda, atendimentos e a página pública — cada empresa no
            próprio ambiente, na nuvem, sem instalação.
          </p>
          <div className="mt-8 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button to="/cadastro?tipo=tutor" size="lg" className="w-full sm:w-auto">
              Sou tutor — criar conta
            </Button>
            <Button to="/cadastro?tipo=clinica" variant="secondary" size="lg" className="w-full sm:w-auto">
              Sou uma clínica
            </Button>
          </div>
        </motion.div>

        <motion.div
          className="min-w-0"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.55, delay: reduceMotion ? 0 : 0.08 }}
        >
          <HeroPets />
        </motion.div>
      </PageContainer>
    </section>
  );
}
