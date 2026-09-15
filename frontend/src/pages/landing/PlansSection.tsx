import { useQuery } from "@tanstack/react-query";
import { PageContainer } from "../../components/layout/PageContainer";
import { FadeIn } from "../../components/ui/FadeIn";
import { PricingCard } from "../../components/ui/PricingCard";
import { SectionTitle } from "../../components/ui/SectionTitle";
import { http } from "../../lib/http";
import { getPlans, mergeOfficialPrices, type OfficialPlan } from "../../lib/plans";

export function PlansSection() {
  const plansQuery = useQuery({
    queryKey: ["public", "planos"],
    queryFn: () => http<OfficialPlan[]>("/api/public/planos"),
    staleTime: 60_000,
  });

  const plans = plansQuery.data ? mergeOfficialPrices(plansQuery.data) : getPlans();
  const fromApi = Boolean(plansQuery.data);
  const plan = plans[0];

  return (
    <section id="planos" className="scroll-mt-24 py-12 sm:py-20">
      <PageContainer>
        <FadeIn>
          <SectionTitle
            eyebrow="Assinatura"
            title="Um plano mensal para a clínica"
            description={
              fromApi
                ? "Valor oficial da mensalidade do Flutz: gestão completa e acesso dos funcionários cadastrados."
                : "Mensalidade única da plataforma. O valor oficial é confirmado pelo sistema no cadastro."
            }
          />
        </FadeIn>
        <div className="mx-auto mt-10 max-w-lg sm:mt-12">
          <FadeIn>
            <PricingCard
              name={plan.name}
              description={plan.description}
              price={plan.price}
              features={plan.features}
              highlighted
              href={`/cadastro?tipo=clinica&plano=${plan.id}`}
            />
          </FadeIn>
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-muted dark:text-zinc-500">
          R$ 149,90 por mês. Página pública, doações, chat e pagamentos da clínica inclusos.
        </p>
      </PageContainer>
    </section>
  );
}
