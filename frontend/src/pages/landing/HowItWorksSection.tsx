import { PageContainer } from "../../components/layout/PageContainer";
import { FadeIn } from "../../components/ui/FadeIn";
import { SectionTitle } from "../../components/ui/SectionTitle";

const tutorSteps = [
  {
    number: "1",
    title: "Crie sua conta",
    description: "Informe nome, CPF e senha. Não há mensalidade da plataforma para o tutor.",
  },
  {
    number: "2",
    title: "Encontre clínicas",
    description: "Use a localização para ver clínicas próximas e abrir a página pública de cada uma.",
  },
  {
    number: "3",
    title: "Peça um horário",
    description: "Solicite atendimento ou vacinação. A clínica confirma o profissional e o término.",
  },
];

const clinicSteps = [
  {
    number: "1",
    title: "Escolha o plano",
    description: "Os valores da plataforma aparecem só neste passo, no cadastro da clínica.",
  },
  {
    number: "2",
    title: "Cadastre a empresa",
    description: "Informe os dados da clínica para criar o ambiente isolado na plataforma.",
  },
  {
    number: "3",
    title: "Configure e atenda",
    description: "Equipe, horários, serviços e a confirmação da agenda dos tutores.",
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="como-funciona"
      className="scroll-mt-24 border-t border-line bg-[#faf8fc] py-12 sm:py-20 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <PageContainer>
        <FadeIn>
          <SectionTitle
            eyebrow="Como funciona"
            title="Comece a utilizar o Flutz"
            description="O tutor entra de graça. A clínica vê os planos só quando decide cadastrar a empresa e começar a usar o software de gestão."
          />
        </FadeIn>
        <div className="mt-10 grid grid-cols-1 gap-10 sm:mt-12 lg:grid-cols-2">
          <ol className="space-y-4">
            <li className="text-sm font-semibold tracking-wide text-brand uppercase">Para o tutor</li>
            {tutorSteps.map((step, index) => (
              <FadeIn key={step.title} delay={index * 0.05} as="li">
                <div className="min-w-0 rounded-2xl border border-line bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                  <span className="flex size-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                    {step.number}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-ink dark:text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted dark:text-zinc-400">
                    {step.description}
                  </p>
                </div>
              </FadeIn>
            ))}
          </ol>
          <ol className="space-y-4">
            <li className="text-sm font-semibold tracking-wide text-brand uppercase">Para a clínica</li>
            {clinicSteps.map((step, index) => (
              <FadeIn key={step.title} delay={index * 0.05} as="li">
                <div className="min-w-0 rounded-2xl border border-line bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                  <span className="flex size-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                    {step.number}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-ink dark:text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted dark:text-zinc-400">
                    {step.description}
                  </p>
                </div>
              </FadeIn>
            ))}
          </ol>
        </div>
      </PageContainer>
    </section>
  );
}
