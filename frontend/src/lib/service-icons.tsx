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
  Dog,
  Droplets,
  Eye,
  FlaskConical,
  Footprints,
  Heart,
  HeartHandshake,
  HeartPulse,
  Home,
  Microscope,
  PawPrint,
  Pill,
  Scan,
  Scissors,
  Shield,
  Sparkles,
  Smile,
  Stethoscope,
  Syringe,
  Waves,
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
  | "laboratorio"
  | "odontologia"
  | "dermatologia"
  | "cardiologia"
  | "oftalmologia"
  | "fisioterapia"
  | "hotel"
  | "domicilio"
  | "nutricao"
  | "acupuntura"
  | "comportamento"
  | "geriatria"
  | "neonatal"
  | "preventivo"
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
  { id: "laboratorio", label: "Laboratório", nomeSugerido: "Exame laboratorial", Icon: FlaskConical },
  { id: "banho", label: "Banho e tosa", nomeSugerido: "Banho e tosa", Icon: Bath },
  { id: "internacao", label: "Internação", nomeSugerido: "Internação", Icon: Bed },
  { id: "ultrassom", label: "Ultrassom", nomeSugerido: "Ultrassom", Icon: Scan },
  { id: "raiox", label: "Raio-X", nomeSugerido: "Raio-X", Icon: Bone },
  { id: "checkup", label: "Check-up", nomeSugerido: "Check-up", Icon: HeartPulse },
  { id: "microchip", label: "Microchip", nomeSugerido: "Microchipagem", Icon: Cpu },
  { id: "curativo", label: "Curativo", nomeSugerido: "Curativo", Icon: Bandage },
  { id: "medicacao", label: "Medicação", nomeSugerido: "Aplicação de medicamento", Icon: Pill },
  { id: "odontologia", label: "Odontologia", nomeSugerido: "Consulta odontológica", Icon: Smile },
  { id: "dermatologia", label: "Dermatologia", nomeSugerido: "Consulta dermatológica", Icon: Sparkles },
  { id: "cardiologia", label: "Cardiologia", nomeSugerido: "Consulta cardiológica", Icon: Heart },
  { id: "oftalmologia", label: "Oftalmologia", nomeSugerido: "Consulta oftalmológica", Icon: Eye },
  { id: "fisioterapia", label: "Fisioterapia", nomeSugerido: "Fisioterapia", Icon: Activity },
  { id: "hotel", label: "Hotel", nomeSugerido: "Hotel pet", Icon: Home },
  { id: "domicilio", label: "Domicílio", nomeSugerido: "Atendimento domiciliar", Icon: Footprints },
  { id: "nutricao", label: "Nutrição", nomeSugerido: "Consulta nutricional", Icon: Droplets },
  { id: "acupuntura", label: "Acupuntura", nomeSugerido: "Acupuntura", Icon: Waves },
  { id: "comportamento", label: "Comportamento", nomeSugerido: "Consulta comportamental", Icon: Dog },
  { id: "geriatria", label: "Geriatria", nomeSugerido: "Consulta geriátrica", Icon: HeartHandshake },
  { id: "neonatal", label: "Neonatal", nomeSugerido: "Atendimento neonatal", Icon: PawPrint },
  { id: "preventivo", label: "Preventivo", nomeSugerido: "Medicina preventiva", Icon: Shield },
  { id: "geral", label: "Geral", nomeSugerido: "Serviço", Icon: Briefcase },
];

/** Primeiros 10 ícones (2 linhas × 5) no formulário compacto */
export const SERVICE_ICON_PREVIEW = SERVICE_ICON_PALETTE.slice(0, 10);

const byId = Object.fromEntries(SERVICE_ICON_PALETTE.map((i) => [i.id, i])) as Record<
  ServiceIconId,
  ServiceIconDef
>;

export function resolveServiceIconId(icone?: string | null, nome?: string | null): ServiceIconId {
  if (icone && icone in byId) return icone as ServiceIconId;
  const value = (nome ?? "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (/consulta/.test(value) && /odonto|dent/.test(value)) return "odontologia";
  if (/consulta/.test(value) && /dermato|pele/.test(value)) return "dermatologia";
  if (/consulta/.test(value) && /cardio|coracao/.test(value)) return "cardiologia";
  if (/consulta/.test(value) && /oftal|olho/.test(value)) return "oftalmologia";
  if (/consulta/.test(value) && /nutri/.test(value)) return "nutricao";
  if (/consulta/.test(value) && /comport/.test(value)) return "comportamento";
  if (/consulta/.test(value) && /geriatr|idoso/.test(value)) return "geriatria";
  if (/consulta/.test(value)) return "consulta";
  if (/retorno/.test(value)) return "retorno";
  if (/vacin|imuniz/.test(value)) return "vacinacao";
  if (/castra/.test(value)) return "castracao";
  if (/cirurg|proced/.test(value)) return "cirurgia";
  if (/emerg|pronto|uti/.test(value)) return "emergencia";
  if (/lab|hemograma/.test(value)) return "laboratorio";
  if (/exame|coleta/.test(value)) return "exame";
  if (/banho|tosa|higien/.test(value)) return "banho";
  if (/interna|observa/.test(value)) return "internacao";
  if (/ultras/.test(value)) return "ultrassom";
  if (/raio|rx\b/.test(value)) return "raiox";
  if (/check|prevent/.test(value)) return /prevent/.test(value) ? "preventivo" : "checkup";
  if (/microchip/.test(value)) return "microchip";
  if (/curativo|bandag/.test(value)) return "curativo";
  if (/medic|aplicacao|injec/.test(value)) return "medicacao";
  if (/fisio|atividade/.test(value)) return "fisioterapia";
  if (/hotel|creche|day.?care/.test(value)) return "hotel";
  if (/domicil|home.?care|visita/.test(value)) return "domicilio";
  if (/acupun/.test(value)) return "acupuntura";
  if (/neonat|filhote/.test(value)) return "neonatal";
  if (/termom|febre/.test(value)) return "checkup";
  if (/ouvido|otite/.test(value)) return "exame";
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
