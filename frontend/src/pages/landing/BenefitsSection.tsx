import { CheckCircle2 } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { FadeIn } from "../../components/ui/FadeIn";
import { SectionTitle } from "../../components/ui/SectionTitle";

const tutorBenefits = [
  {
    title: "Conta própria, sem mensalidade",
    description: "Você se cadastra com CPF e senha. Quem paga a plataforma é a clínica, não o tutor.",
  },
  {
    title: "Clínicas perto de você",
    description: "A busca usa a localização para ordenar clínicas por distância e abrir a página de cada uma.",
  },
  {
    title: "Pedido de horário direto",
    description: "Solicite atendimento ou vacinação. A clínica confirma o profissional e o horário de término.",
  },
];

const clinicBenefits = [
  {
    title: "Operação em um só ambiente",
    description: "Tutores, pets, colaboradores, serviços, agenda e atendimentos da sua empresa.",
  },
  {
    title: "Presença digital da clínica",
    description:
      "Página pública com hero, sobre, serviços, equipe, avaliações, galeria, localização, contato e doações — conforme o plano.",
  },
  {
    title: "Dados só da sua clínica",
    description: "Ambiente multiempresa: o que é da sua operação não aparece para outra empresa.",
  },
];

export function BenefitsSection() {
  return (
    <section id="beneficios" className="scroll-mt-24 py-12 sm:py-20">
      <PageContainer>
        <FadeIn>
          <SectionTitle
            eyebrow="Benefícios"
            title="Uma plataforma criada para a rotina veterinária"
            description="Por que uma clínica veterinária usaria um SaaS como o Flutz: operação centralizada, presença digital e dados isolados por empresa — e o tutor chega sem pagar mensalidade da plataforma."
          />
        </FadeIn>
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold tracking-wide text-brand uppercase">Para o tutor</h3>
            {tutorBenefits.map((item, index) => (
              <FadeIn key={item.title} delay={index * 0.05}>
                <BenefitRow title={item.title} description={item.description} />
              </FadeIn>
            ))}
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-semibold tracking-wide text-brand uppercase">Para a clínica</h3>
            {clinicBenefits.map((item, index) => (
              <FadeIn key={item.title} delay={index * 0.05}>
                <BenefitRow title={item.title} description={item.description} />
              </FadeIn>
            ))}
          </div>
        </div>
      </PageContainer>
    </section>
  );
}

function BenefitRow({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-w-0 gap-4 rounded-2xl border border-line bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-brand" aria-hidden="true" />
      <div className="min-w-0">
        <h4 className="font-semibold text-ink dark:text-white">{title}</h4>
        <p className="mt-1 text-sm leading-relaxed text-muted dark:text-zinc-400">{description}</p>
      </div>
    </div>
  );
}
