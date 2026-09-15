import { Building2, PawPrint } from "lucide-react";
import { Link } from "react-router-dom";
import { PageContainer } from "../../components/layout/PageContainer";
import { FadeIn } from "../../components/ui/FadeIn";
import { SectionTitle } from "../../components/ui/SectionTitle";

export function DualAudienceSection() {
  return (
    <section id="para-voce" className="scroll-mt-24 border-t border-line py-12 sm:py-20">
      <PageContainer>
        <FadeIn>
          <SectionTitle
            eyebrow="Para você"
            title="Dois caminhos. Um Flutz."
            description="Tutores entram de graça para achar clínicas e pedir horários. Clínicas contratam a plataforma para operar o dia a dia."
          />
        </FadeIn>
        <div className="mt-10 grid grid-cols-1 gap-5 sm:mt-12 lg:grid-cols-2">
          <FadeIn>
            <article className="flex h-full min-w-0 flex-col rounded-3xl border border-line bg-white p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                <PawPrint className="size-6" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-2xl font-bold text-ink dark:text-white">Sou tutor</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted dark:text-zinc-400">
                Crie sua conta com CPF e senha. Depois use a localização para ver clínicas
                próximas, abrir a página pública e solicitar um atendimento ou vacinação.
                A clínica confirma o horário com o profissional.
              </p>
              <Link
                to="/cadastro?tipo=tutor"
                className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover"
              >
                Criar minha conta
              </Link>
            </article>
          </FadeIn>
          <FadeIn delay={0.06}>
            <article className="flex h-full min-w-0 flex-col rounded-3xl border border-brand/30 bg-brand-soft p-6 sm:p-8 dark:border-brand/40 dark:bg-brand/10">
              <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-white text-brand dark:bg-zinc-900">
                <Building2 className="size-6" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-2xl font-bold text-ink dark:text-white">Sou uma clínica</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted dark:text-zinc-400">
                Cadastre a empresa, escolha o plano da plataforma e organize tutores, pets,
                equipe, agenda, atendimentos e a presença digital — com os dados isolados
                no ambiente da sua clínica.
              </p>
              <Link
                to="/cadastro?tipo=clinica"
                className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover"
              >
                Cadastrar a clínica
              </Link>
            </article>
          </FadeIn>
        </div>
      </PageContainer>
    </section>
  );
}
