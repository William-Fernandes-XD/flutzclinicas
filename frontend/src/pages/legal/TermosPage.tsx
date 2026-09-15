import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "../../components/layout/PageContainer";
import { env } from "../../lib/env";

export function TermosPage() {
  return (
    <PageContainer className="py-12 sm:py-16">
      <article className="mx-auto max-w-3xl">
        <p className="text-sm font-bold tracking-wider text-brand uppercase">Legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Termos de Uso</h1>
        <p className="mt-4 text-sm text-muted">Última atualização: 14 de setembro de 2026.</p>
        <div className="mt-10 space-y-8 text-sm leading-7 text-muted">
          <Section title="1. Aceitação">
            Ao criar uma conta ou usar o {env.appName}, você aceita estes termos e a Política de Privacidade. Se estiver
            usando a plataforma em nome de uma clínica, declara ter autorização para representá-la.
          </Section>
          <Section title="2. Serviço">
            O Flutz oferece recursos de gestão veterinária, relacionamento entre clínicas e tutores, agenda,
            prontuários, vacinação e comunicação. A plataforma não substitui avaliação veterinária nem garante a
            disponibilidade de profissionais ou serviços de terceiros.
          </Section>
          <Section title="3. Conta e responsabilidades">
            Você deve fornecer informações verdadeiras, manter suas credenciais protegidas e comunicar acessos
            indevidos. É proibido violar direitos, inserir conteúdo ilícito, tentar acessar dados de terceiros,
            interferir na segurança ou usar o serviço de forma abusiva.
          </Section>
          <Section title="4. Clínicas e tutores">
            Clínicas são responsáveis pelos serviços veterinários prestados, informações publicadas e cumprimento de
            suas obrigações profissionais. Tutores são responsáveis pelas informações dos pets e por comparecer ou
            cancelar compromissos conforme as regras informadas pela clínica.
          </Section>
          <Section title="5. Planos e pagamentos">
            Recursos pagos, preços, ciclos, descontos e condições de cancelamento são apresentados antes da
            contratação. Serviços veterinários e mensalidades da plataforma podem ter cobranças e responsáveis
            distintos.
          </Section>
          <Section title="6. Disponibilidade e propriedade intelectual">
            Buscamos manter o serviço seguro e disponível, mas manutenções e eventos fora do nosso controle podem causar
            interrupções. A marca, o software e os materiais do Flutz pertencem à {env.companyName} ou a seus
            licenciantes e não podem ser copiados sem autorização.
          </Section>
          <Section title="7. Suspensão e encerramento">
            Contas podem ser suspensas por risco à segurança, inadimplência, violação destes termos ou exigência legal.
            O encerramento respeitará as obrigações de retenção e os direitos previstos na LGPD.
          </Section>
          <Section title="8. Contato e legislação">
            Estes termos são regidos pela legislação brasileira. Dúvidas podem ser enviadas para{" "}
            <a className="font-semibold text-brand hover:underline" href={`mailto:${env.contactEmail}`}>{env.contactEmail}</a>.
          </Section>
        </div>
        <Link to="/privacidade" className="mt-10 inline-flex font-semibold text-brand hover:underline">Leia a Política de Privacidade</Link>
      </article>
    </PageContainer>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-ink dark:text-white">{title}</h2>
      <p className="mt-2">{children}</p>
    </section>
  );
}
