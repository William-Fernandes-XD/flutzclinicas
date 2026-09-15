import {
  Building2,
  CalendarClock,
  CreditCard,
  HeartHandshake,
  LayoutTemplate,
  MessageCircle,
  PawPrint,
  ShieldPlus,
  Stethoscope,
  Star,
  Syringe,
  Users,
  UserRound,
} from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { FadeIn } from "../../components/ui/FadeIn";
import { FeatureCard } from "../../components/ui/FeatureCard";
import { SectionTitle } from "../../components/ui/SectionTitle";

const features = [
  {
    icon: Building2,
    title: "Gestão da clínica",
    description: "Cadastro da empresa, dados institucionais e ambiente próprio para a operação.",
  },
  {
    icon: UserRound,
    title: "Tutores e clientes",
    description:
      "O tutor pode criar a própria conta. A clínica também cadastra e vincula tutores, com o histórico da relação na empresa.",
  },
  {
    icon: PawPrint,
    title: "Pets, espécies e raças",
    description: "Cada pet pertence à clínica e ao tutor, com espécie e raça do catálogo da plataforma.",
  },
  {
    icon: Users,
    title: "Colaboradores e especialidades",
    description: "Equipe da clínica, papéis de acesso e especialidades oferecidas pela empresa.",
  },
  {
    icon: ShieldPlus,
    title: "Serviços",
    description: "Serviços da clínica com nome de exibição, preço, duração e visibilidade na página.",
  },
  {
    icon: CalendarClock,
    title: "Agendamentos",
    description: "Compromissos futuros com tutor, pet, serviço e profissional quando atribuído.",
  },
  {
    icon: Stethoscope,
    title: "Atendimentos",
    description: "Registro do ato clínico, equipe envolvida e andamento da visita.",
  },
  {
    icon: Syringe,
    title: "Vacinação e histórico",
    description: "Aplicações, próxima dose e histórico de doenças ligados ao pet da clínica.",
  },
  {
    icon: LayoutTemplate,
    title: "Página pública da clínica",
    description:
      "Hero, sobre, serviços, equipe, avaliações, galeria, localização, contato e doações — com seções configuráveis.",
  },
  {
    icon: Star,
    title: "Avaliações",
    description: "Depoimentos da clínica, exibidos na página pública somente quando autorizados.",
  },
  {
    icon: MessageCircle,
    title: "Chat com a clínica",
    description: "Conversas da clínica com o tutor, com contexto de pet, agenda ou atendimento quando houver.",
  },
  {
    icon: HeartHandshake,
    title: "Doações",
    description: "Campanhas da clínica, com galeria e acompanhamento dos recebimentos associados.",
  },
  {
    icon: CreditCard,
    title: "Pagamentos da clínica",
    description: "Recebimentos de consulta, serviço ou doação na conta conectada da própria clínica.",
  },
];

export function FeaturesSection() {
  return (
    <section id="recursos" className="scroll-mt-24 border-t border-line bg-[#faf8fc] py-12 sm:py-20 dark:border-zinc-800 dark:bg-zinc-950">
      <PageContainer>
        <FadeIn>
          <SectionTitle
            eyebrow="Funcionalidades"
            title="O que a clínica opera — e o que o tutor usa"
            description="A clínica concentra a operação. O tutor entra, encontra empresas próximas e pede horário. Somente o que o produto já prevê."
          />
        </FadeIn>
        <div className="mt-10 grid grid-cols-1 gap-5 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((item, index) => (
            <FadeIn key={item.title} delay={(index % 3) * 0.05}>
              <FeatureCard {...item} />
            </FadeIn>
          ))}
        </div>
      </PageContainer>
    </section>
  );
}
