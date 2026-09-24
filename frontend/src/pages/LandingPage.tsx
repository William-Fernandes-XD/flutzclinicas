import { PageContainer } from "../components/layout/PageContainer";
import { Button } from "../components/ui/Button";
import { CTA } from "../components/ui/CTA";
import { FadeIn } from "../components/ui/FadeIn";
import { AboutSection } from "./landing/AboutSection";
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
      <AboutSection />
      <FaqSection />
      <div className="py-12 sm:py-20">
        <FadeIn>
          <PageContainer>
            <CTA
              title="Comece a utilizar o Flutz"
              description="Tutor cria a conta e encontra clínicas. Clínica começa com 14 dias gratuitos para testar o SaaS de gestão do Flutz."
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
      </div>
    </>
  );
}
