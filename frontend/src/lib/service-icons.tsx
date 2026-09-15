import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Ambulance,
  Bandage,
  Bath,
  Bed,
  Bone,
  Briefcase,
  ClipboardList,
  Cpu,
  Droplets,
  HeartPulse,
  Microscope,
  Pill,
  Scan,
  Scissors,
  Sparkles,
  Stethoscope,
  Syringe,
} from "lucide-react";

export type ServiceIconId =
  | "consulta"
  | "retorno"
  | "vacinacao"
  | "cirurgia"
  | "emergencia"
  | "exame"
  | "banho"
  | "internacao"
  | "ultrassom"
  | "raiox"
  | "castracao"
  | "checkup"
  | "microchip"
  | "curativo"
  | "medicacao"
  | "geral";

export type ServiceIconDef = {
  id: ServiceIconId;
  label: string;
  nomeSugerido: string;
  Icon: LucideIcon;
};

export const SERVICE_ICON_PALETTE: ServiceIconDef[] = [
  { id: "consulta", label: "Consulta", nomeSugerido: "Consulta", Icon: Stethoscope },
  { id: "retorno", label: "Retorno", nomeSugerido: "Retorno", Icon: ClipboardList },
  { id: "vacinacao", label: "Vacinação", nomeSugerido: "Vacinação", Icon: Syringe },
  { id: "cirurgia", label: "Cirurgia", nomeSugerido: "Cirurgia", Icon: Scissors },
  { id: "castracao", label: "Castração", nomeSugerido: "Castração", Icon: Scissors },
  { id: "emergencia", label: "Emergência", nomeSugerido: "Emergência", Icon: Ambulance },
  { id: "exame", label: "Exame", nomeSugerido: "Exame", Icon: Microscope },
  { id: "banho", label: "Banho e tosa", nomeSugerido: "Banho e tosa", Icon: Bath },
  { id: "internacao", label: "Internação", nomeSugerido: "Internação", Icon: Bed },
  { id: "ultrassom", label: "Ultrassom", nomeSugerido: "Ultrassom", Icon: Scan },
  { id: "raiox", label: "Raio-X", nomeSugerido: "Raio-X", Icon: Bone },
  { id: "checkup", label: "Check-up", nomeSugerido: "Check-up", Icon: HeartPulse },
  { id: "microchip", label: "Microchip", nomeSugerido: "Microchipagem", Icon: Cpu },
  { id: "curativo", label: "Curativo", nomeSugerido: "Curativo", Icon: Bandage },
  { id: "medicacao", label: "Medicação", nomeSugerido: "Aplicação de medicamento", Icon: Pill },
  { id: "geral", label: "Geral", nomeSugerido: "Serviço", Icon: Briefcase },
];

const byId = Object.fromEntries(SERVICE_ICON_PALETTE.map((i) => [i.id, i])) as Record<
  ServiceIconId,
  ServiceIconDef
>;

export function resolveServiceIconId(icone?: string | null, nome?: string | null): ServiceIconId {
  if (icone && icone in byId) return icone as ServiceIconId;
  const value = (nome ?? "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (/consulta/.test(value)) return "consulta";
  if (/retorno/.test(value)) return "retorno";
  if (/vacin|imuniz/.test(value)) return "vacinacao";
  if (/castra/.test(value)) return "castracao";
  if (/cirurg|proced/.test(value)) return "cirurgia";
  if (/emerg|pronto|uti/.test(value)) return "emergencia";
  if (/exame|coleta|hemograma|lab/.test(value)) return "exame";
  if (/banho|tosa|higien/.test(value)) return "banho";
  if (/interna|observa/.test(value)) return "internacao";
  if (/ultras/.test(value)) return "ultrassom";
  if (/raio|rx\b/.test(value)) return "raiox";
  if (/check/.test(value)) return "checkup";
  if (/microchip/.test(value)) return "microchip";
  if (/curativo|bandag/.test(value)) return "curativo";
  if (/medic|aplicacao|injec/.test(value)) return "medicacao";
  if (/atividade|fisioterapia/.test(value)) return "checkup";
  return "geral";
}

export function serviceIconComponent(icone?: string | null, nome?: string | null): LucideIcon {
  return byId[resolveServiceIconId(icone, nome)]?.Icon ?? Briefcase;
}

export function ServiceTypeIcon({
  icone,
  nome,
  className = "size-5",
}: {
  icone?: string | null;
  nome?: string | null;
  className?: string;
}) {
  const Icon = serviceIconComponent(icone, nome);
  return <Icon className={className} strokeWidth={2} aria-hidden />;
}

/** Ícones extras usados só no fallback visual */
export const SERVICE_FALLBACK_ICONS = { Activity, Droplets, Sparkles };
