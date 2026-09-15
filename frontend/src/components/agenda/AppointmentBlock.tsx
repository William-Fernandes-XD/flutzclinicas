import { corStatusAgenda, statusAgenda, tomStatus } from "../../lib/agenda";
import { PetPhoto } from "../clinic/PanelHero";
import { Badge } from "../ui/Badge";

export type AgendaItemView = {
  id: number;
  inicio: string;
  fim?: string | null;
  status: string;
  statusCodigo?: string;
  petId?: number;
  pet: string;
  especie?: string | null;
  tutor: string;
  clinica?: string;
  fotoUrl?: string | null;
  colaboradorId?: number | null;
  colaborador?: string | null;
  tipo?: string;
  servico?: string | null;
  vacina?: string | null;
  valorCobrado?: number | null;
  valorServico?: number | null;
  codigoCupom?: string | null;
};

export function appointmentLabel(item: AgendaItemView): string {
  if (item.tipo === "VACINACAO") return item.vacina ?? "Vacinação";
  return item.servico ?? "Atendimento";
}

export function AppointmentBlock({
  item,
  onClick,
  compact = false,
}: {
  item: AgendaItemView;
  onClick?: () => void;
  compact?: boolean;
}) {
  const when = new Date(item.inicio);
  const codigo = item.statusCodigo ?? "";
  const cores = corStatusAgenda(codigo || item.status);
  const shell = `flex w-full gap-2 rounded-2xl border border-[#ebe4f4] border-l-4 ${cores.border} bg-white text-left shadow-sm ${
    compact ? "px-2 py-1.5" : "px-3 py-2"
  }`;
  const body = (
    <>
      <PetPhoto
        especie={item.especie}
        seed={item.petId ?? item.id}
        src={item.fotoUrl}
        className={compact ? "mt-0.5 size-7 shrink-0 rounded-full" : "mt-0.5 size-9 shrink-0 rounded-full"}
      />
      <div className="min-w-0 flex-1">
        <p className={`font-bold tracking-wide text-brand uppercase ${compact ? "text-[10px]" : "text-[11px]"}`}>
          {appointmentLabel(item)}
        </p>
        <p className={`font-semibold ${compact ? "text-[11px]" : "text-xs"}`}>
          {when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          {item.fim
            ? ` – ${new Date(item.fim).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
            : ""}
        </p>
        <p className={`truncate font-medium ${compact ? "text-xs" : "text-sm"}`}>{item.pet}</p>
        <p className="truncate text-xs text-muted">{item.tutor}</p>
        {!compact && item.clinica ? <p className="truncate text-xs text-muted">{item.clinica}</p> : null}
        {!compact ? (
          <p className="truncate text-xs font-medium text-brand">
            {item.colaborador ? `Com ${item.colaborador}` : "Profissional a definir"}
          </p>
        ) : null}
        <Badge tone={tomStatus(codigo || item.status)}>{statusAgenda(codigo, item.status)}</Badge>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${shell} hover:bg-[#faf8fc]`}>
        {body}
      </button>
    );
  }

  return <div className={shell}>{body}</div>;
}
