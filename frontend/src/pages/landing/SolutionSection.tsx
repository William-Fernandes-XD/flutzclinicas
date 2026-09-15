import { Cloud, PawPrint, ShieldCheck } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { FadeIn } from "../../components/ui/FadeIn";
import { FeatureCard } from "../../components/ui/FeatureCard";
import { SectionTitle } from "../../components/ui/SectionTitle";

const pillars = [
  {
    icon: PawPrint,
    title: "O tutor entra por conta própria",
    description:
      "Cadastro com CPF e senha, busca de clínicas pela localização e pedido de horário na página da empresa.",
  },
  {
    icon: ShieldCheck,
    title: "A clínica opera no próprio ambiente",
    description:
      "Tutores, pets, equipe, serviços, agenda e atendimentos ficam isolados por empresa. O isolamento é regra da plataforma.",
  },
  {
    icon: Cloud,
    title: "Na nuvem, sem instalar",
    description:
      "O acesso é pelo navegador, no computador ou no celular. Não há instalação local do sistema.",
  },
];

export function SolutionSection() {
  return (
    <section className="py-12 sm:py-20">
      <PageContainer>
        <FadeIn>
          <SectionTitle
            eyebrow="A solução"
            title="Flutz aproxima o tutor da clínica — e organiza a operação"
            description="Quem tem pet cria a conta e encontra clínicas. Quem tem clínica cadastra a empresa, escolhe o plano e passa a usar agenda, atendimentos, vacinação e — conforme o plano — página pública, chat, doações e recebimentos."
          />
        </FadeIn>
        <div className="mt-10 grid grid-cols-1 gap-5 sm:mt-12 md:grid-cols-3">
          {pillars.map((item, index) => (
            <FadeIn key={item.title} delay={index * 0.06}>
              <FeatureCard {...item} />
            </FadeIn>
          ))}
        </div>
      </PageContainer>
    </section>
  );
}
