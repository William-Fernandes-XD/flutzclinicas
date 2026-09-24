import { CalendarClock, FileWarning, MapPin } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { FadeIn } from "../../components/ui/FadeIn";
import { FeatureCard } from "../../components/ui/FeatureCard";
import { SectionTitle } from "../../components/ui/SectionTitle";

const problems = [
  {
    icon: MapPin,
    title: "Tutor sem um jeito simples de chegar na clínica",
    description:
      "Achar uma clínica perto, ver o que ela oferece e pedir um horário ainda depende demais de ligação e mensagem solta.",
  },
  {
    icon: CalendarClock,
    title: "Agenda e atendimento separados",
    description:
      "Quando o compromisso e o ato clínico ficam em ferramentas diferentes, a equipe perde o fio da operação.",
  },
  {
    icon: FileWarning,
    title: "Histórico do pet difícil de localizar",
    description:
      "Vacinação, doenças e atendimentos precisam estar ligados ao pet da clínica — não espalhados em arquivos soltos.",
  },
];

export function ProblemSection() {
  return (
    <section className="border-t border-line bg-[#faf8fc] py-12 sm:py-20 dark:border-zinc-800 dark:bg-zinc-950">
      <PageContainer>
        <FadeIn>
          <SectionTitle
            eyebrow="O problema"
            title="O que a gestão de clínica veterinária ainda deixa solto"
            description="Tutores têm dificuldade de chegar até a clínica. A clínica precisa manter tutores, pets, horários e o histórico do pet no mesmo software — não em ferramentas espalhadas."
          />
        </FadeIn>
        <div className="mt-10 grid grid-cols-1 gap-5 sm:mt-12 md:grid-cols-3">
          {problems.map((item, index) => (
            <FadeIn key={item.title} delay={index * 0.06}>
              <FeatureCard {...item} />
            </FadeIn>
          ))}
        </div>
      </PageContainer>
    </section>
  );
}
