import { PageContainer } from "../components/layout/PageContainer";
import { Button } from "../components/ui/Button";
import { CTA } from "../components/ui/CTA";
import { FadeIn } from "../components/ui/FadeIn";
import { BenefitsSection } from "./landing/BenefitsSection";
import { DualAudienceSection } from "./landing/DualAudienceSection";
import { FaqSection } from "./landing/FaqSection";
import { FeaturesSection } from "./landing/FeaturesSection";
import { HeroSection } from "./landing/HeroSection";
import { HowItWorksSection } from "./landing/HowItWorksSection";
import { ProblemSection } from "./landing/ProblemSection";
import { SolutionSection } from "./landing/SolutionSection";

export function LandingPage() {
  return (
    <>
      <HeroSection />
      <DualAudienceSection />
      <ProblemSection />
      <SolutionSection />
      <FeaturesSection />
      <BenefitsSection />
      <HowItWorksSection />
      <FaqSection />
      <section className="py-12 sm:py-20">
        <FadeIn>
          <PageContainer>
            <CTA
              title="Comece pelo lado que é o seu"
              description="Tutor cria a conta e encontra clínicas. Clínica assina o plano mensal do Flutz no cadastro."
              actionLabel="Criar conta de tutor"
              to="/cadastro?tipo=tutor"
            >
              <Button
                to="/cadastro?tipo=clinica&plano=flutz"
                variant="ghost"
                size="lg"
                className="border border-white/40 !bg-transparent !text-white hover:!border-white hover:!bg-white/15"
              >
                Cadastrar minha clínica
              </Button>
            </CTA>
          </PageContainer>
        </FadeIn>
      </section>
    </>
  );
}
