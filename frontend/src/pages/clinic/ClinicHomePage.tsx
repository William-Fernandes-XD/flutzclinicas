import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Dog,
  FileBarChart2,
  Globe,
  MessageSquare,
  PawPrint,
  Stethoscope,
  Syringe,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { LoadingState } from "../../components/ui/EmptyState";
import { Surface } from "../../components/ui/Field";
import { PageHeader } from "../../components/ui/PageHeader";
import { statusAgenda } from "../../lib/agenda";
import { http } from "../../lib/http";
import { isClinicAdmin, isPlatformAdmin } from "../../lib/session";
import { useAuth } from "../../providers/AuthProvider";
import { useClinicBrand } from "../../providers/ClinicContext";
import {
  api,
  type AgendaSolicitacao,
  type AppNotification,
  type ChatSummary,
} from "../../services/api";

type AtendimentoRow = {
  id: number;
  pet: string;
  tutor: string;
  status: string;
  veterinario?: string | null;
  dataInicio?: string | null;
  resumo?: string | null;
};

const QUICK_ADMIN: { to: string; label: string; hint: string; Icon: LucideIcon }[] = [
  { to: "/app/agenda", label: "Agenda", hint: "Marcações do dia", Icon: CalendarDays },
  { to: "/app/atendimentos", label: "Atendimentos", hint: "Fila e prontuário", Icon: Stethoscope },
  { to: "/app/chat", label: "Chat", hint: "Conversas com tutores", Icon: MessageSquare },
  { to: "/app/clientes", label: "Clientes", hint: "Tutores vinculados", Icon: Users },
  { to: "/app/consulta-pets", label: "Pets", hint: "Busca rápida", Icon: Dog },
  { to: "/app/vacinacao", label: "Vacinação", hint: "Doses e atrasos", Icon: Syringe },
  { to: "/app/financeiro", label: "Financeiro", hint: "Recebimentos", Icon: Wallet },
  { to: "/app/relatorios", label: "Relatórios", hint: "Análises completas", Icon: FileBarChart2 },
];

const QUICK_STAFF: { to: string; label: string; hint: string; Icon: LucideIcon }[] = [
  { to: "/app/agenda", label: "Agenda", hint: "Seus horários", Icon: CalendarDays },
  { to: "/app/atendimentos", label: "Atendimentos", hint: "Em andamento", Icon: Stethoscope },
  { to: "/app/chat", label: "Chat", hint: "Mensagens", Icon: MessageSquare },
  { to: "/app/vacinacao", label: "Vacinação", hint: "Aplicações", Icon: Syringe },
  { to: "/app/consulta-pets", label: "Consulta de pets", hint: "Buscar pet", Icon: PawPrint },
  { to: "/app/clientes", label: "Clientes", hint: "Tutores", Icon: Users },
];

function formatWhen(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tituloServico(item: AgendaSolicitacao): string {
  return item.servico || item.vacina || item.tipo || "Serviço";
}

export function ClinicHomePage() {
  const { session } = useAuth();
  const clinic = useClinicBrand();
  const admin = isClinicAdmin(session) || isPlatformAdmin(session);

  const stats = useQuery({ queryKey: ["clinica", "indicadores"], queryFn: api.clinicStats, refetchInterval: 30000 });
  const agenda = useQuery({
    queryKey: ["agenda-solicitacoes"],
    queryFn: () => api.agendaSolicitacoes(),
    refetchInterval: 30000,
  });
  const chats = useQuery({ queryKey: ["chats"], queryFn: api.chats, refetchInterval: 15000 });
  const notificacoes = useQuery({
    queryKey: ["notificacoes"],
    queryFn: api.notificacoes,
    refetchInterval: 15000,
  });
  const atendimentos = useQuery({
    queryKey: ["atendimentos"],
    queryFn: () => http<AtendimentoRow[]>("/api/atendimentos"),
    refetchInterval: 30000,
  });
  const servicos = useQuery({
    queryKey: ["servicos"],
    queryFn: () => http<{ id: number }[]>("/api/servicos"),
    enabled: admin,
  });
  const equipe = useQuery({
    queryKey: ["equipe"],
    queryFn: () => http<{ id: number }[]>("/api/equipe"),
    enabled: admin,
  });
  const pagina = useQuery({
    queryKey: ["pagina"],
    queryFn: api.pageConfig,
    enabled: admin,
  });
  const mensalidade = useQuery({
    queryKey: ["assinatura", "mensalidade"],
    queryFn: api.mensalidade,
    enabled: admin,
  });

  const steps = [
    { label: "Identidade da clínica", done: Boolean(clinic?.logoUrl || clinic?.sobre), to: "/app/pagina" },
    { label: "Serviços", done: (servicos.data?.length ?? 0) > 0, to: "/app/servicos" },
    { label: "Equipe", done: (equipe.data?.length ?? 0) > 0, to: "/app/equipe" },
    { label: "Página pública", done: Boolean(pagina.data?.hero?.titulo), to: "/app/pagina" },
  ];
  const progress = Math.round((steps.filter((step) => step.done).length / steps.length) * 100);

  const pendencias = useMemo(() => {
    const solicitacoes = agenda.data ?? [];
    const semValidacao = solicitacoes
      .filter((item) => (item.statusCodigo || "").toUpperCase() === "SOLICITADO")
      .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());

    const aguardandoPagamento = solicitacoes
      .filter((item) => (item.statusCodigo || "").toUpperCase() === "AGUARDANDO_PAGAMENTO")
      .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());

    const emAndamento = (atendimentos.data ?? []).filter((item) =>
      (item.status || "").toLowerCase().includes("andamento"),
    );

    const chatsAguardando = (chats.data ?? []).filter(
      (item) => item.status === "aberto" && (item.ultimoRemetente || "").toUpperCase() === "CLIENTE",
    );

    const naoLidas = (notificacoes.data ?? []).filter((item) => !item.lida);

    return {
      semValidacao,
      aguardandoPagamento,
      emAndamento,
      chatsAguardando,
      naoLidas,
      vacinasAtrasadas: stats.data?.vacinasAtrasadas ?? 0,
    };
  }, [agenda.data, atendimentos.data, chats.data, notificacoes.data, stats.data]);

  const totalPendencias =
    pendencias.semValidacao.length +
    pendencias.emAndamento.length +
    pendencias.chatsAguardando.length +
    pendencias.naoLidas.length +
    pendencias.aguardandoPagamento.length;

  const loading =
    stats.isLoading || agenda.isLoading || chats.isLoading || notificacoes.isLoading || atendimentos.isLoading;

  if (loading) {
    return <LoadingState label="Carregando pendências da clínica…" />;
  }

  const quick = admin
    ? [
        ...QUICK_ADMIN,
        ...(clinic?.slug
          ? [{ to: `/clinica/${clinic.slug}`, label: "Página pública", hint: "Ver como o tutor vê", Icon: Globe }]
          : [{ to: "/app/pagina", label: "Página pública", hint: "Editar vitrine", Icon: Globe }]),
        { to: "/app/servicos", label: "Serviços", hint: "Catálogo oferecido", Icon: ClipboardList },
      ]
    : QUICK_STAFF;

  return (
    <div className="space-y-6">
      {admin && mensalidade.data?.statusAssinatura === "TRIAL" ? (
        <Surface className="border border-brand/20 bg-brand-soft/70">
          <p className="font-semibold text-ink dark:text-white">
            Período de teste: {diasRestantes(mensalidade.data.proximoVencimento)} dia(s) restante(s)
          </p>
          <p className="mt-1 text-sm text-muted">Conheça os detalhes da assinatura e prepare o primeiro pagamento.</p>
          <Button to="/app/assinatura" variant="secondary" className="mt-3">
            Ver assinatura
          </Button>
        </Surface>
      ) : null}
      {admin &&
      mensalidade.data &&
      (mensalidade.data.statusAssinatura === "INADIMPLENTE" ||
        (mensalidade.data.dataLimiteAcesso != null && diasRestantes(mensalidade.data.dataLimiteAcesso) <= 3)) ? (
        <Surface className="border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-200">
            <AlertCircle className="size-4" />
            {mensalidade.data.statusAssinatura === "INADIMPLENTE"
              ? "Mensalidade em atraso"
              : "Prazo de acesso próximo do fim"}
          </p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            Regularize a assinatura para manter todas as operações da clínica disponíveis.
          </p>
          <Button to="/app/assinatura" className="mt-3">
            Regularizar assinatura
          </Button>
        </Surface>
      ) : null}
      {admin && progress < 100 ? (
        <Surface className="bg-brand-soft/60">
          <p className="font-semibold">Configuração da clínica: {progress}%</p>
          <p className="mt-1 text-sm text-muted">Complete estes passos para a operação e a página pública ficarem prontas.</p>
          <ul className="mt-4 grid gap-2 text-sm">
            {steps.map((step) => (
              <li key={step.label} className="flex items-center justify-between gap-3">
                <span>
                  {step.done ? "✓" : "○"} {step.label}
                </span>
                {!step.done ? (
                  <Link to={step.to} className="font-medium text-brand">
                    Continuar
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </Surface>
      ) : null}

      <PageHeader
        title={clinic?.nome ?? `Oi, ${session?.nome.split(" ")[0]}`}
        description="Pendências do dia e atalhos para o que mais importa na operação."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button to="/app/agenda">Abrir agenda</Button>
            <Button to="/app/chat" variant="secondary">
              Abrir chat
            </Button>
          </div>
        }
      />

      <QuickAccess items={quick} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryChip label="Total pendente" value={totalPendencias} tone="brand" />
        <SummaryChip label="Sem validação" value={pendencias.semValidacao.length} />
        <SummaryChip label="Em andamento" value={pendencias.emAndamento.length} />
        <SummaryChip label="Chat aguardando" value={pendencias.chatsAguardando.length} />
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold tracking-wide text-brand uppercase">Pendências</h2>
            <p className="mt-0.5 text-xs text-muted">O que ainda precisa de alguém da equipe.</p>
          </div>
          {totalPendencias === 0 ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <CheckCircle2 className="size-3.5" /> Tudo em dia
            </span>
          ) : null}
        </div>

        {totalPendencias === 0 ? (
          <article className="living-card flex flex-col items-center gap-2 px-6 py-12 text-center">
            <CheckCircle2 className="size-10 text-emerald-500" />
            <p className="font-semibold text-ink dark:text-white">Nenhuma pendência no momento</p>
            <p className="max-w-md text-sm text-muted">
              Quando houver mensagens sem leitura, serviços em andamento ou marcações esperando a recepção, eles
              aparecem aqui.
            </p>
          </article>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <PendingCard
              title="Sem validação da recepção"
              subtitle="Marcações solicitadas aguardando aprovação"
              count={pendencias.semValidacao.length}
              link="/app/agenda"
              linkLabel="Ver agenda"
              Icon={ClipboardList}
            >
              {!pendencias.semValidacao.length ? (
                <EmptyHint>Nenhuma marcação aguardando validação.</EmptyHint>
              ) : (
                <ul className="divide-y divide-line dark:divide-zinc-800">
                  {pendencias.semValidacao.slice(0, 8).map((item) => (
                    <PendingRow
                      key={item.id}
                      to="/app/agenda"
                      title={`${item.pet} · ${tituloServico(item)}`}
                      meta={`${item.tutor} · ${formatWhen(item.inicio)}`}
                      badge={statusAgenda(item.statusCodigo, item.status)}
                    />
                  ))}
                </ul>
              )}
            </PendingCard>

            <PendingCard
              title="Serviços em andamento"
              subtitle="Atendimentos abertos que ainda não foram concluídos"
              count={pendencias.emAndamento.length}
              link="/app/atendimentos"
              linkLabel="Ver atendimentos"
              Icon={Stethoscope}
            >
              {!pendencias.emAndamento.length ? (
                <EmptyHint>Nenhum atendimento em andamento.</EmptyHint>
              ) : (
                <ul className="divide-y divide-line dark:divide-zinc-800">
                  {pendencias.emAndamento.slice(0, 8).map((item) => (
                    <PendingRow
                      key={item.id}
                      to="/app/atendimentos"
                      title={`${item.pet} · ${item.tutor}`}
                      meta={[item.veterinario, formatWhen(item.dataInicio), item.resumo].filter(Boolean).join(" · ")}
                      badge={item.status}
                    />
                  ))}
                </ul>
              )}
            </PendingCard>

            <PendingCard
              title="Mensagens aguardando resposta"
              subtitle="Conversas em que o tutor falou por último"
              count={pendencias.chatsAguardando.length}
              link="/app/chat"
              linkLabel="Abrir chat"
              Icon={MessageSquare}
            >
              {!pendencias.chatsAguardando.length ? (
                <EmptyHint>Nenhuma conversa aguardando a clínica.</EmptyHint>
              ) : (
                <ul className="divide-y divide-line dark:divide-zinc-800">
                  {pendencias.chatsAguardando.slice(0, 8).map((item) => (
                    <ChatPendingRow key={item.id} item={item} />
                  ))}
                </ul>
              )}
            </PendingCard>

            <PendingCard
              title="Avisos que você ainda não leu"
              subtitle="Notificações pendentes na sua conta"
              count={pendencias.naoLidas.length}
              Icon={AlertCircle}
            >
              {!pendencias.naoLidas.length ? (
                <EmptyHint>Sem avisos não lidos.</EmptyHint>
              ) : (
                <ul className="divide-y divide-line dark:divide-zinc-800">
                  {pendencias.naoLidas.slice(0, 8).map((item) => (
                    <NotifPendingRow key={item.id} item={item} />
                  ))}
                </ul>
              )}
            </PendingCard>

            {pendencias.aguardandoPagamento.length ? (
              <PendingCard
                title="Aguardando pagamento"
                subtitle="Horários aprovados sem confirmação de pagamento"
                count={pendencias.aguardandoPagamento.length}
                link="/app/agenda"
                linkLabel="Ver agenda"
                Icon={Wallet}
              >
                <ul className="divide-y divide-line dark:divide-zinc-800">
                  {pendencias.aguardandoPagamento.slice(0, 8).map((item) => (
                    <PendingRow
                      key={item.id}
                      to="/app/agenda"
                      title={`${item.pet} · ${tituloServico(item)}`}
                      meta={`${item.tutor} · ${formatWhen(item.inicio)}`}
                      badge={statusAgenda(item.statusCodigo, item.status)}
                    />
                  ))}
                </ul>
              </PendingCard>
            ) : null}

            {pendencias.vacinasAtrasadas > 0 ? (
              <PendingCard
                title="Vacinas atrasadas"
                subtitle="Pets com dose vencida no radar da clínica"
                count={pendencias.vacinasAtrasadas}
                link="/app/vacinacao"
                linkLabel="Ver vacinação"
                Icon={Syringe}
              >
                <EmptyHint>
                  Há {pendencias.vacinasAtrasadas} pet(s) com vacina atrasada. Abra a vacinação para agir.
                </EmptyHint>
              </PendingCard>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

function diasRestantes(value?: string | null): number {
  if (!value) return 0;
  const data = new Date(`${value}T00:00:00`);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((data.getTime() - hoje.getTime()) / 86_400_000));
}

function SummaryChip({ label, value, tone }: { label: string; value: number; tone?: "brand" }) {
  return (
    <article className="living-card p-4">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${tone === "brand" ? "text-brand" : "text-ink dark:text-white"}`}>
        {value}
      </p>
    </article>
  );
}

function QuickAccess({
  items,
}: {
  items: { to: string; label: string; hint: string; Icon: LucideIcon }[];
}) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold tracking-wide text-brand uppercase">Acesso rápido</h2>
          <p className="mt-0.5 text-xs text-muted">Atalhos para as rotinas mais usadas.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {items.map(({ to, label, hint, Icon }) => (
          <Link
            key={to + label}
            to={to}
            className="living-card group flex items-start gap-3 p-4 transition hover:-translate-y-0.5 hover:ring-brand/30"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand transition group-hover:bg-brand group-hover:text-white">
              <Icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-ink dark:text-white">{label}</span>
              <span className="mt-0.5 block text-xs text-muted">{hint}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function PendingCard({
  title,
  subtitle,
  count,
  link,
  linkLabel,
  Icon,
  children,
}: {
  title: string;
  subtitle: string;
  count: number;
  link?: string;
  linkLabel?: string;
  Icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <article className="living-card flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5 dark:border-zinc-800">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-ink dark:text-white">{title}</h3>
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand">{count}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
          </div>
        </div>
        {link ? (
          <Link to={link} className="shrink-0 text-xs font-semibold text-brand hover:underline">
            {linkLabel ?? "Ver todos"}
          </Link>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 px-2 py-1 sm:px-3">{children}</div>
    </article>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="px-3 py-6 text-center text-sm text-muted">{children}</p>;
}

function PendingRow({
  to,
  title,
  meta,
  badge,
}: {
  to: string;
  title: string;
  meta?: string;
  badge?: string;
}) {
  return (
    <li>
      <Link to={to} className="flex items-start justify-between gap-3 rounded-xl px-3 py-3 transition hover:bg-brand-soft/50">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink dark:text-white">{title}</span>
          {meta ? <span className="mt-0.5 block text-xs text-muted">{meta}</span> : null}
        </span>
        {badge ? (
          <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            {badge}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

function ChatPendingRow({ item }: { item: ChatSummary }) {
  return (
    <li>
      <Link
        to={`/app/chat?chatId=${item.id}`}
        className="flex items-start gap-3 rounded-xl px-3 py-3 transition hover:bg-brand-soft/50"
      >
        <Avatar name={item.tutor} src={item.fotoUrl} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold text-ink dark:text-white">{item.tutor}</span>
            <span className="shrink-0 text-[11px] text-muted">{formatWhen(item.ultimaAtividade)}</span>
          </span>
          <span className="mt-0.5 line-clamp-2 text-xs text-muted">
            {item.pet ? `${item.pet} · ` : ""}
            {item.preview || "Nova mensagem do tutor"}
          </span>
        </span>
      </Link>
    </li>
  );
}

function NotifPendingRow({ item }: { item: AppNotification }) {
  const to = item.linkPath || "/app";
  return (
    <li>
      <Link to={to} className="flex items-start gap-3 rounded-xl px-3 py-3 transition hover:bg-brand-soft/50">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <Clock3 className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold text-ink dark:text-white">{item.titulo}</span>
            <span className="shrink-0 text-[11px] text-muted">{formatWhen(item.quando)}</span>
          </span>
          <span className="mt-0.5 line-clamp-2 text-xs text-muted">{item.corpo}</span>
        </span>
      </Link>
    </li>
  );
}
