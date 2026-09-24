import { PageContainer } from "../../components/layout/PageContainer";
import { FadeIn } from "../../components/ui/FadeIn";
import { SectionTitle } from "../../components/ui/SectionTitle";
import { env } from "../../lib/env";

/**
 * Bloco institucional: deixa explícito o que é o Flutz (empresa / SaaS / clínicas).
 * Sem inventar métricas, endereços ou funcionalidades.
 */
export function AboutSection() {
  return (
    <section id="sobre" className="scroll-mt-24 py-12 sm:py-20" aria-labelledby="sobre-titulo">
      <PageContainer>
        <FadeIn>
          <SectionTitle
            id="sobre-titulo"
            eyebrow="A empresa"
            title="Conheça o Flutz"
            description="O Flutz é um produto de software da UpVibe: um SaaS criado para a gestão de clínicas veterinárias e para conectar tutores às clínicas."
          />
        </FadeIn>
        <FadeIn delay={0.05}>
          <div className="mx-auto mt-10 max-w-3xl space-y-5 text-base leading-relaxed text-muted dark:text-zinc-400">
            <p>
              O <strong className="font-semibold text-ink dark:text-white">Flutz</strong> é um{" "}
              <strong className="font-semibold text-ink dark:text-white">
                SaaS para clínicas veterinárias
              </strong>
              : um software de gestão veterinária na nuvem, acessado pelo navegador, sem instalação
              local. A plataforma foi desenvolvida especificamente para a rotina de clínicas
              veterinárias e para o tutor que precisa encontrar e agendar com essas clínicas.
            </p>
            <p>
              Para a clínica, o sistema de gestão concentra operação em um ambiente próprio:
              tutores, pets, equipe, serviços, agenda, atendimentos, vacinação e histórico,
              página pública, avaliações, chat, doações e recebimentos — conforme o que a clínica
              configura e o plano contratado. Os dados de cada empresa ficam isolados das demais.
            </p>
            <p>
              Para o tutor, a conta é gratuita: é possível buscar clínicas pela localização, abrir
              a página pública e solicitar atendimento ou vacinação. A clínica confirma o horário
              e o profissional.
            </p>
            <p>
              Em resumo, o Flutz é uma{" "}
              <strong className="font-semibold text-ink dark:text-white">
                plataforma para clínicas veterinárias
              </strong>{" "}
              que centraliza a gestão da clínica e facilita o encontro entre tutor e clínica —
              um software para clínica veterinária pensado para o dia a dia, não um site
              institucional genérico.
            </p>
            <p className="text-sm">
              O Flutz é oferecido pela {env.companyName}
              {env.companyUrl ? (
                <>
                  {" "}
                  (
                  <a
                    href={env.companyUrl}
                    className="font-medium text-brand underline-offset-2 hover:underline"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {env.companyUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                  )
                </>
              ) : null}
              .
            </p>
          </div>
        </FadeIn>
      </PageContainer>
    </section>
  );
}
