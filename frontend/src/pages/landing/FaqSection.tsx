import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import { PageContainer } from "../../components/layout/PageContainer";
import { FadeIn } from "../../components/ui/FadeIn";
import { SectionTitle } from "../../components/ui/SectionTitle";
import { env } from "../../lib/env";

const faqs = [
  {
    question: "O que é o Flutz?",
    answer:
      "O Flutz é um SaaS para clínicas veterinárias e para os tutores que as procuram. Cada clínica tem o próprio ambiente para tutores, pets, equipe, serviços, agenda, atendimentos, vacinação, página pública, avaliações, chat, doações e pagamentos. O tutor cria a conta, encontra clínicas e solicita horários.",
  },
  {
    question: "Posso me cadastrar como tutor?",
    answer:
      "Sim. O cadastro do tutor usa nome, CPF e senha. Não há mensalidade da plataforma para o tutor. Depois de entrar, você busca clínicas pela localização e pede um horário na página da empresa.",
  },
  {
    question: "Quanto custa para a clínica?",
    answer:
      "Há um único plano mensal de R$ 149,90, que libera o sistema de gestão e o acesso dos funcionários cadastrados. Tutores não passam por essa etapa.",
  },
  {
    question: "Para quem a plataforma é indicada?",
    answer:
      "Para tutores que precisam encontrar clínicas e pedir horários, e para gestores e equipes de clínicas veterinárias que precisam de um sistema próprio, isolado das demais empresas da plataforma.",
  },
  {
    question: "Preciso instalar algum programa?",
    answer:
      "Não. O Flutz funciona na nuvem, pelo navegador, sem instalação local.",
  },
  {
    question: "Posso acessar pelo celular?",
    answer:
      "Sim. A interface é responsiva e pode ser usada no celular, no tablet e no computador.",
  },
  {
    question: "Meus dados ficam separados dos de outras clínicas?",
    answer:
      "Sim. O Flutz é multiempresa: os dados de uma clínica ficam isolados das demais. Esse isolamento é aplicado no servidor, não apenas na tela.",
  },
  {
    question: "Como funciona a contratação da clínica?",
    answer:
      "No cadastro da clínica você informa os dados da empresa e começa com 14 dias gratuitos para testar o Flutz. Depois do período de testes, a assinatura mensal precisa ser paga para manter o acesso.",
  },
  {
    question: "Como funciona o pagamento da assinatura?",
    answer:
      "Após os 14 dias gratuitos, a clínica paga a mensalidade da plataforma. Isso é distinto dos pagamentos que a clínica recebe de tutores ou doações.",
  },
  {
    question: "Posso cancelar?",
    answer:
      "O cancelamento seguirá a política comercial da assinatura, ainda em definição.",
  },
  {
    question: "Como funciona o suporte?",
    answer: `O suporte é prestado pela ${env.companyName}, empresa responsável pelo Flutz.`,
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-24 border-t border-line bg-[#faf8fc] py-12 sm:py-20 dark:border-zinc-800 dark:bg-zinc-950">
      <PageContainer>
        <FadeIn>
          <SectionTitle
            eyebrow="FAQ"
            title="Perguntas frequentes"
            description="Respostas alinhadas às regras já definidas do produto. O que ainda não está definido comercialmente não é inventado aqui."
          />
        </FadeIn>
        <div className="mx-auto mt-10 max-w-3xl space-y-3 sm:mt-12">
          {faqs.map((item) => (
            <FaqItem key={item.question} question={item.question} answer={item.answer} />
          ))}
        </div>
      </PageContainer>
    </section>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const panelId = useId();

  return (
    <div className="rounded-2xl border border-line bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <h3>
        <button
          type="button"
          className="flex w-full min-w-0 items-center justify-between gap-4 px-4 py-4 text-left text-sm font-semibold break-words text-ink sm:px-5 dark:text-white"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
        >
          {question}
          <ChevronDown
            className={`size-4 shrink-0 text-brand transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={panelId}
            initial={reduceMotion ? { height: "auto" } : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.25 }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-4 text-sm leading-relaxed text-muted dark:text-zinc-400">{answer}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
