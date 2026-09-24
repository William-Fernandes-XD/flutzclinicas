import {
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardList,
  Clock,
  CreditCard,
  Globe,
  Home,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  PawPrint,
  Search,
  Shield,
  ScrollText,
  Star,
  Stethoscope,
  Syringe,
  Ticket,
  Users,
  Wallet,
  Settings,
  MessageSquare,
} from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { isClinicAdmin, isPlatformAdmin, isTutor, type Session } from "../../lib/session";
import { Button } from "../ui/Button";

export type PanelVariant = "platform" | "clinic" | "client";
export type NavItem = { to: string; label: string; end?: boolean; icon: ReactNode };
export type NavGroup = { label: string; items: NavItem[] };

export function panelVariantFor(session: Session): PanelVariant {
  if (isPlatformAdmin(session) && !session.empresaId) return "platform";
  if (isTutor(session)) return "client";
  return "clinic";
}

export function labelFor(session: Session | null, variant?: PanelVariant): string {
  if (!session) return "";
  if (session.tipo === "ADMINISTRADOR_SISTEMA" && variant !== "clinic") return "Administração Flutz";
  if (session.tipo === "CLIENTE") return "Área do tutor";
  if (isClinicAdmin(session)) return "Administração da clínica";
  return "Equipe da clínica";
}

export function SidebarBody({
  variant,
  groups,
  session,
  onLogout,
  loggingOut,
  onNavigate,
}: {
  variant: PanelVariant;
  groups: NavGroup[];
  session: Session | null;
  onLogout: () => void;
  loggingOut: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label="Principal">
        {groups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{group.label}</p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <SideLink key={item.to} item={item} onClick={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-line p-4 dark:border-zinc-800">
        <p className="truncate text-sm font-semibold">{session?.nome}</p>
        <p className="truncate text-[11px] text-muted">{labelFor(session, variant)}</p>
        <Button variant="ghost" className="mt-3 w-full" busy={loggingOut} busyLabel="Saindo…" onClick={onLogout}>
          Sair
        </Button>
      </div>
    </>
  );
}

function SideLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) =>
        [
          "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium",
          isActive ? "bg-brand-soft text-brand" : "text-ink hover:bg-brand-soft/70 hover:text-brand dark:text-zinc-200",
        ].join(" ")
      }
    >
      <span className="text-current opacity-80">{item.icon}</span>
      {item.label}
    </NavLink>
  );
}

export function navFor(variant: PanelVariant, session: Session | null): NavGroup[] {
  const size = "size-4";
  if (variant === "platform") {
    return [
      { label: "Visão geral", items: [{ to: "/admin", label: "Início", end: true, icon: <LayoutDashboard className={size} /> }] },
      {
        label: "Negócio",
        items: [
          { to: "/admin/faturamento", label: "Faturamento", icon: <Wallet className={size} /> },
          { to: "/admin/tokens", label: "Tokens", icon: <Ticket className={size} /> },
        ],
      },
      {
        label: "Cadastros",
        items: [
          { to: "/admin/clinicas", label: "Clínicas", icon: <Building2 className={size} /> },
          { to: "/admin/usuarios", label: "Usuários", icon: <Users className={size} /> },
          { to: "/admin/avaliacoes", label: "Avaliações", icon: <Star className={size} /> },
          { to: "/admin/consulta-pets", label: "Consulta de pets", icon: <PawPrint className={size} /> },
          { to: "/admin/suporte", label: "Suporte", icon: <LifeBuoy className={size} /> },
          { to: "/admin/catalogos", label: "Catálogos", icon: <BookOpen className={size} /> },
        ],
      },
      {
        label: "Conta",
        items: [{ to: "/admin/configuracoes", label: "Configurações", icon: <Settings className={size} /> }],
      },
      {
        label: "Plataforma",
        items: [{ to: "/admin/lgpd", label: "LGPD", icon: <Shield className={size} /> }],
      },
    ];
  }
  if (variant === "client") {
    return [
      { label: "Início", items: [{ to: "/cliente", label: "Início", end: true, icon: <Home className={size} /> }] },
      {
        label: "Clínicas",
        items: [{ to: "/cliente/clinicas", label: "Buscar clínicas", icon: <Search className={size} /> }],
      },
      {
        label: "Meu pet",
        items: [
          { to: "/cliente/pets", label: "Meus pets", icon: <PawPrint className={size} /> },
          { to: "/cliente/agenda", label: "Minha agenda", icon: <CalendarDays className={size} /> },
          { to: "/cliente/vacinacao", label: "Vacinação", icon: <Syringe className={size} /> },
          { to: "/cliente/atendimentos", label: "Atendimentos", icon: <ClipboardList className={size} /> },
          { to: "/cliente/chat", label: "Chat", icon: <MessageSquare className={size} /> },
        ],
      },
      {
        label: "Conta",
        items: [
          { to: "/cliente/suporte", label: "Suporte", icon: <LifeBuoy className={size} /> },
          { to: "/cliente/meus-dados", label: "Meus dados (LGPD)", icon: <Shield className={size} /> },
          { to: "/cliente/configuracoes", label: "Configurações", icon: <Settings className={size} /> },
        ],
      },
    ];
  }
  const admin = isClinicAdmin(session) || isPlatformAdmin(session);
  const base: NavGroup[] = [
    { label: "Início", items: [{ to: "/app", label: "Início", end: true, icon: <Home className={size} /> }] },
    {
      label: "Operação",
      items: [
        { to: "/app/agenda", label: "Agenda", icon: <CalendarDays className={size} /> },
        { to: "/app/atendimentos", label: "Atendimentos", icon: <Stethoscope className={size} /> },
        { to: "/app/chat", label: "Chat", icon: <MessageSquare className={size} /> },
      ],
    },
    {
      label: "Cadastros",
      items: [
        { to: "/app/clientes", label: "Clientes", icon: <Users className={size} /> },
        ...(admin
          ? [{ to: "/app/consulta-pets", label: "Consulta de pets", icon: <Search className={size} /> } satisfies NavItem]
          : []),
        { to: "/app/vacinacao", label: "Vacinação", icon: <Syringe className={size} /> },
      ],
    },
  ];
  if (admin) {
    base.push(
      {
        label: "Clínica",
        items: [
          { to: "/app/catalogos", label: "Catálogos", icon: <BookOpen className={size} /> },
          { to: "/app/equipe", label: "Equipe e horários", icon: <Clock className={size} /> },
          { to: "/app/servicos", label: "Serviços", icon: <Briefcase className={size} /> },
          { to: "/app/expediente", label: "Expediente", icon: <CalendarDays className={size} /> },
          { to: "/app/localizacao", label: "Localização", icon: <MapPin className={size} /> },
          { to: "/app/avaliacoes", label: "Avaliações", icon: <Star className={size} /> },
        ],
      },
      {
        label: "Página e gestão",
        items: [
          { to: "/app/pagina", label: "Página pública", icon: <Globe className={size} /> },
          { to: "/app/financeiro", label: "Financeiro", icon: <Wallet className={size} /> },
          { to: "/app/assinatura", label: "Mensalidade", icon: <CreditCard className={size} /> },
          { to: "/app/relatorios", label: "Relatórios", icon: <BarChart3 className={size} /> },
          { to: "/app/logs", label: "Logs", icon: <ScrollText className={size} /> },
        ],
      },
    );
  }
  base.push({
    label: "Conta",
    items: [
      { to: "/app/suporte", label: "Suporte", icon: <LifeBuoy className={size} /> },
      { to: "/app/meus-dados", label: "Meus dados (LGPD)", icon: <Shield className={size} /> },
      { to: "/app/configuracoes", label: "Configurações", icon: <Settings className={size} /> },
    ],
  });
  return base;
}
