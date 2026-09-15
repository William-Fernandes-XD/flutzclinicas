import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Eye,
  Heart,
  PawPrint,
  Syringe,
  UserRound,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import heroPets from "../../assets/app/tutor-home-hero-pets.png";
import { PetPhoto } from "../../components/clinic/PanelHero";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState, LoadingState } from "../../components/ui/EmptyState";
import { statusAgenda, tomStatus } from "../../lib/agenda";
import { http } from "../../lib/http";
import { useAuth } from "../../providers/AuthProvider";
import { api, type AgendaSolicitacao } from "../../services/api";

type Atendimento = {
  id: number;
  petId?: number;
  pet: string;
  status: string;
  resumo: string | null;
  fotoUrl?: string | null;
  especie?: string | null;
  clinica?: string | null;
  veterinario?: string | null;
  dataInicio?: string | null;
};

type HomeItem = {
  key: string;
  pet: string;
  petId?: number;
  fotoUrl?: string | null;
  especie?: string | null;
  statusLabel: string;
  statusTone: "brand" | "ok" | "info" | "warn" | "danger" | "neutral";
  tipo: string;
  quando: Date;
  clinica: string;
  profissional: string;
  to: string;
};

export function ClientHomePage() {
  const { session } = useAuth();
  const firstName = session?.nome.split(" ")[0] ?? "tutor";
  const agenda = useQuery({ queryKey: ["agenda-solicitacoes"], queryFn: () => api.agendaSolicitacoes() });
  const atendimentos = useQuery({
    queryKey: ["atendimentos"],
    queryFn: () => http<Atendimento[]>("/api/atendimentos"),
  });

  const itens = useMemo(() => montarItens(agenda.data ?? [], atendimentos.data ?? []), [agenda.data, atendimentos.data]);
  const proximos = itens.slice(0, 5);
  const proximaConsulta = useMemo(() => escolherProximaConsulta(agenda.data ?? []), [agenda.data]);

  if (agenda.isLoading || atendimentos.isLoading) return <LoadingState />;

  return (
    <div className="space-y-5 pb-8">
      <section className="relative overflow-hidden rounded-3xl border border-[#ebe4f4] bg-[linear-gradient(120deg,#f7f0ff_0%,#f3eafc_45%,#efe6fb_100%)] shadow-sm">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 28%, rgba(120,40,200,0.12), transparent 28%), radial-gradient(circle at 72% 18%, rgba(120,40,200,0.08), transparent 22%)",
          }}
          aria-hidden
        />
        <Heart className="pointer-events-none absolute top-8 left-[42%] size-8 rotate-12 text-[#d7c4f2]/70" aria-hidden />
        <PawPrint className="pointer-events-none absolute bottom-10 left-[48%] size-10 -rotate-12 text-[#d7c4f2]/55" aria-hidden />

        <div className="relative grid items-center gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(14rem,0.9fr)]">
          <div className="px-5 py-6 sm:px-7 sm:py-8">
            <p className="text-[11px] font-bold tracking-[0.18em] text-[#7828c8] uppercase">Olá, {firstName}</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#1f1630] sm:text-3xl">Bem-vindo de volta!</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#6e6680]">
              Aqui você encontra tudo o que precisa para cuidar do seu pet, de forma simples e prática.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <HeroChip to="/cliente/pets" icon={<PawPrint className="size-3.5" />} label="Meus pets" />
              <HeroChip to="/cliente/agenda" icon={<CalendarDays className="size-3.5" />} label="Agendar" />
              <HeroChip to="/cliente/vacinacao" icon={<Syringe className="size-3.5" />} label="Vacinação" />
              <HeroChip to="/cliente/atendimentos" icon={<ClipboardList className="size-3.5" />} label="Atendimentos" />
            </div>
          </div>

          <div className="relative px-4 pb-2 sm:px-6 lg:self-end lg:px-5 lg:pb-0">
            <div className="mx-auto h-48 w-full max-w-sm sm:h-56 lg:ml-auto lg:h-[16.5rem] lg:max-w-none">
              <img
                src={heroPets}
                alt="Filhote de cachorro e gatinho abraçados"
                className="h-full w-full object-contain object-bottom drop-shadow-[0_12px_24px_rgba(80,40,140,0.18)] lg:object-right-bottom"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_18.5rem]">
        <section className="rounded-3xl border border-[#ebe4f4] bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-[#f3eafc] text-[#7828c8]">
                <CalendarDays className="size-5" />
              </span>
              <h2 className="text-base font-semibold text-[#1f1630]">Próximos atendimentos</h2>
            </div>
            <Button to="/cliente/agenda" variant="secondary" className="!rounded-full !px-3 !py-1.5 text-xs">
              Ver minha agenda
            </Button>
          </div>

          {!proximos.length ? (
            <EmptyState
              title="Nada por aqui ainda"
              description="Quando você agendar ou a clínica abrir um atendimento, o resumo aparece nesta lista."
            />
          ) : (
            <ul className="space-y-3">
              {proximos.map((item) => (
                <li
                  key={item.key}
                  className="flex flex-col gap-3 rounded-2xl border border-[#ebe4f4] bg-[#fcfbfe] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-3.5"
                >
                  <div className="flex min-w-0 items-start gap-3 sm:items-center">
                    <PetPhoto
                      especie={item.especie}
                      seed={item.petId ?? item.key}
                      src={item.fotoUrl}
                      className="size-12 rounded-full"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#1f1630]">
                          {item.pet} · {item.statusLabel.toLowerCase()}
                        </p>
                        <Badge tone={item.statusTone}>{item.statusLabel}</Badge>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#6e6680]">
                        <span className="inline-flex items-center gap-1">
                          <PawPrint className="size-3 text-[#7828c8]" />
                          {item.tipo}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="size-3 text-[#7828c8]" />
                          {formatQuando(item.quando)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="size-3 text-[#7828c8]" />
                          {item.clinica}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="size-3 text-[#7828c8]" />
                          {item.profissional}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button to={item.to} variant="secondary" className="!rounded-full shrink-0">
                    <Eye className="size-4" />
                    Ver detalhes
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-[#7828c8] px-4 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium leading-relaxed">
              Cuidar é amar! Mantenha as vacinas em dia e não deixe de realizar os check-ups.
            </p>
            <Button to="/cliente/vacinacao" variant="secondary" className="!rounded-full shrink-0 !bg-white !text-[#7828c8]">
              Ver vacinas
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </section>

        <aside className="space-y-4">
          <article className="rounded-3xl border border-[#ebe4f4] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold tracking-[0.14em] text-[#7828c8] uppercase">Sua próxima consulta</p>
                {proximaConsulta ? (
                  <>
                    <p className="mt-2 text-lg font-semibold text-[#1f1630]">{proximaConsulta.pet}</p>
                    <p className="mt-1 text-sm text-[#6e6680]">{formatQuando(new Date(proximaConsulta.inicio))}</p>
                    <p className="text-sm text-[#6e6680]">{proximaConsulta.clinica}</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-[#6e6680]">Nenhuma consulta agendada no momento.</p>
                )}
              </div>
              <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-[#f3eafc] text-[#7828c8]">
                <CalendarDays className="size-5" />
              </span>
            </div>
            <Button to="/cliente/agenda" variant="secondary" className="mt-4 w-full !rounded-full">
              Ver detalhes
            </Button>
          </article>

          <article className="rounded-3xl border border-[#ebe4f4] bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-[#1f1630]">Acesso rápido</h2>
            <div className="grid grid-cols-2 gap-2.5">
              <QuickCard to="/cliente/pets" title="Meus pets" description="Ver meus pets" icon={<PawPrint className="size-4" />} />
              <QuickCard
                to="/cliente/agenda"
                title="Minha agenda"
                description="Ver compromissos"
                icon={<CalendarDays className="size-4" />}
              />
              <QuickCard
                to="/cliente/vacinacao"
                title="Vacinação"
                description="Linha do tempo"
                icon={<Syringe className="size-4" />}
              />
              <QuickCard
                to="/cliente/atendimentos"
                title="Atendimentos"
                description="Histórico de atendimentos"
                icon={<ClipboardList className="size-4" />}
              />
            </div>
          </article>
        </aside>
      </div>
    </div>
  );
}

function HeroChip({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white px-3.5 py-2 text-xs font-semibold text-[#5c4d78] shadow-sm transition hover:border-[#7828c8]/30 hover:text-[#7828c8]"
    >
      <span className="text-[#7828c8]">{icon}</span>
      {label}
    </Link>
  );
}

function QuickCard({
  to,
  title,
  description,
  icon,
}: {
  to: string;
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-[#ebe4f4] bg-[#faf8fc] p-3 transition hover:border-[#7828c8]/25 hover:bg-[#f3eafc]/60"
    >
      <span className="inline-flex size-8 items-center justify-center rounded-xl bg-white text-[#7828c8] shadow-sm">{icon}</span>
      <p className="mt-2 text-sm font-semibold text-[#1f1630]">{title}</p>
      <p className="mt-0.5 flex items-center justify-between gap-1 text-[11px] text-[#8b7fa3]">
        <span>{description}</span>
        <ChevronRight className="size-3.5 opacity-70 transition group-hover:translate-x-0.5" />
      </p>
    </Link>
  );
}

function montarItens(agenda: AgendaSolicitacao[], atendimentos: Atendimento[]): HomeItem[] {
  const fromAgenda: HomeItem[] = agenda.map((item) => {
    const tone = tomStatus(item.statusCodigo);
    return {
      key: `agenda-${item.id}`,
      pet: item.pet,
      petId: item.petId,
      fotoUrl: item.fotoUrl,
      especie: item.especie,
      statusLabel: statusAgenda(item.statusCodigo, item.status),
      statusTone: tone === "warn" ? "brand" : tone,
      tipo: item.tipo === "VACINACAO" ? item.vacina ?? "Vacinação" : item.servico ?? "Consulta",
      quando: new Date(item.inicio),
      clinica: item.clinica,
      profissional: item.colaborador?.trim() || "Equipe da clínica",
      to: "/cliente/agenda",
    };
  });

  const fromAtend: HomeItem[] = atendimentos.map((item) => {
    const status = item.status.trim().toLowerCase();
    const concluido = status.includes("conclu");
    const andamento = status.includes("andamento");
    return {
      key: `atend-${item.id}`,
      pet: item.pet,
      petId: item.petId,
      fotoUrl: item.fotoUrl,
      especie: item.especie,
      statusLabel: concluido ? "Concluído" : andamento ? "Em andamento" : item.status,
      statusTone: concluido ? "ok" : andamento ? "brand" : "neutral",
      tipo: item.resumo?.trim() || "Atendimento",
      quando: item.dataInicio ? new Date(item.dataInicio) : new Date(0),
      clinica: item.clinica?.trim() || "Clínica",
      profissional: item.veterinario?.trim() || "Equipe da clínica",
      to: "/cliente/atendimentos",
    };
  });

  return [...fromAgenda, ...fromAtend]
    .filter((item) => !Number.isNaN(item.quando.getTime()))
    .sort((a, b) => b.quando.getTime() - a.quando.getTime());
}

function escolherProximaConsulta(agenda: AgendaSolicitacao[]): AgendaSolicitacao | null {
  const agora = Date.now();
  const ativos = new Set(["SOLICITADO", "AGUARDANDO_PAGAMENTO", "CONFIRMADO", "AGUARDANDO_CLIENTE"]);
  return (
    agenda
      .filter((item) => ativos.has(item.statusCodigo) && new Date(item.inicio).getTime() >= agora - 60 * 60 * 1000)
      .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime())[0] ?? null
  );
}

function formatQuando(date: Date): string {
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
