import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "../../components/layout/PageContainer";
import { env } from "../../lib/env";

export function PrivacidadePublicaPage() {
  return (
    <PageContainer className="py-12 sm:py-16">
      <article className="mx-auto max-w-3xl">
        <p className="text-sm font-bold tracking-wider text-brand uppercase">Legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Política de Privacidade</h1>
        <p className="mt-4 text-sm text-muted">Última atualização: 14 de setembro de 2026.</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted">
          <Section title="1. Quem controla seus dados">
            A {env.companyName}, responsável pela plataforma {env.appName}, atua como controladora dos dados da conta
            global e como operadora quando trata informações em nome das clínicas. Cada clínica também pode ser
            controladora dos dados usados em seus atendimentos. O serviço é oferecido sob a marca Flutz, da UpVibe.
          </Section>
          <Section title="2. Dados tratados">
            Tratamos dados cadastrais e de contato, dados de acesso e segurança, vínculos com clínicas, informações dos
            pets, agendamentos, atendimentos, vacinação, chats, pagamentos e registros técnicos necessários para
            segurança e auditoria. Senhas são armazenadas somente na forma de hash.
          </Section>
          <Section title="3. Finalidades e bases legais">
            Usamos os dados para prestar o serviço, autenticar contas, viabilizar o cuidado veterinário, cumprir
            obrigações legais, prevenir fraudes, proteger a plataforma e enviar comunicações autorizadas. As bases
            incluem execução de contrato, cumprimento de obrigação legal, legítimo interesse, proteção da vida e
            consentimento, conforme aplicável.
          </Section>
          <Section title="4. Compartilhamento e segurança">
            Compartilhamos apenas o necessário com clínicas escolhidas pelo tutor e fornecedores de infraestrutura,
            comunicação e pagamentos sujeitos a deveres de confidencialidade. Adotamos controles de acesso, isolamento
            por clínica, registros de auditoria e medidas técnicas compatíveis com o risco.
          </Section>
          <Section title="5. Retenção">
            Conservamos dados pelo tempo necessário à prestação do serviço e aos prazos legais, regulatórios,
            contratuais e de defesa de direitos. Quando a exclusão física não for possível por obrigação legal ou
            integridade do prontuário, os identificadores serão anonimizados ou bloqueados.
          </Section>
          <Section title="6. Seus direitos">
            Você pode confirmar o tratamento, acessar, corrigir, portar, anonimizar ou eliminar dados tratados com
            consentimento, além de revogar consentimentos e obter informações sobre compartilhamentos. Usuários
            autenticados podem usar o Centro de Privacidade em “Meus dados (LGPD)”. Responderemos aos pedidos aplicáveis
            em até 15 dias, sem prejuízo dos prazos previstos em lei.
          </Section>
          <Section title="7. Encarregado e contato">
            O encarregado pelo tratamento de dados é {env.dpoNome}. Para dúvidas ou solicitações, escreva para{" "}
            <a className="font-semibold text-brand hover:underline" href={`mailto:${env.dpoEmail}`}>{env.dpoEmail}</a>.
            Você também pode contatar a Autoridade Nacional de Proteção de Dados (ANPD).
          </Section>
          <Section title="8. Atualizações">
            Esta política pode ser atualizada para refletir mudanças legais ou no serviço. A versão vigente permanecerá
            publicada nesta página.
          </Section>
        </div>
        <Link to="/termos" className="mt-10 inline-flex font-semibold text-brand hover:underline">Consulte também os Termos de Uso</Link>
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
