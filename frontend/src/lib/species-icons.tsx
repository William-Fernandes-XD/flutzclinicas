import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Bird,
  Bug,
  Cat,
  Dog,
  Egg,
  Fish,
  Mouse,
  PawPrint,
  Rabbit,
  Rat,
  Shell,
  Squirrel,
  Turtle,
  Worm,
} from "lucide-react";

/** Ícones Lucide + SVGs simples para espécies sem ícone nativo. */
export type SpeciesIconId =
  | "cao"
  | "gato"
  | "ave"
  | "peixe"
  | "coelho"
  | "tartaruga"
  | "hamster"
  | "rato"
  | "camundongo"
  | "cavalo"
  | "porco"
  | "vaca"
  | "cabra"
  | "ovelha"
  | "cobra"
  | "lagarto"
  | "sapo"
  | "inseto"
  | "molusco"
  | "furão"
  | "ouriço"
  | "minhoca"
  | "ovo"
  | "outro";

export type SpeciesIconDef = {
  id: SpeciesIconId;
  label: string;
  /** Sugestão de nome ao selecionar na paleta */
  nomeSugerido: string;
  Lucide?: LucideIcon;
};

export const SPECIES_ICON_PALETTE: SpeciesIconDef[] = [
  { id: "cao", label: "Cachorro", nomeSugerido: "Cachorro", Lucide: Dog },
  { id: "gato", label: "Gato", nomeSugerido: "Gato", Lucide: Cat },
  { id: "ave", label: "Ave", nomeSugerido: "Ave", Lucide: Bird },
  { id: "peixe", label: "Peixe", nomeSugerido: "Peixe", Lucide: Fish },
  { id: "coelho", label: "Coelho", nomeSugerido: "Coelho", Lucide: Rabbit },
  { id: "tartaruga", label: "Tartaruga", nomeSugerido: "Tartaruga", Lucide: Turtle },
  { id: "hamster", label: "Hamster", nomeSugerido: "Hamster", Lucide: Squirrel },
  { id: "rato", label: "Rato", nomeSugerido: "Rato", Lucide: Rat },
  { id: "camundongo", label: "Camundongo", nomeSugerido: "Camundongo", Lucide: Mouse },
  { id: "cavalo", label: "Cavalo", nomeSugerido: "Cavalo" },
  { id: "porco", label: "Porco", nomeSugerido: "Porco" },
  { id: "vaca", label: "Bovino", nomeSugerido: "Bovino" },
  { id: "cabra", label: "Cabra", nomeSugerido: "Cabra" },
  { id: "ovelha", label: "Ovelha", nomeSugerido: "Ovelha" },
  { id: "cobra", label: "Cobra", nomeSugerido: "Cobra" },
  { id: "lagarto", label: "Lagarto", nomeSugerido: "Lagarto" },
  { id: "sapo", label: "Sapo", nomeSugerido: "Sapo" },
  { id: "inseto", label: "Inseto", nomeSugerido: "Inseto", Lucide: Bug },
  { id: "molusco", label: "Molusco", nomeSugerido: "Molusco", Lucide: Shell },
  { id: "furão", label: "Furão", nomeSugerido: "Furão" },
  { id: "ouriço", label: "Ouriço", nomeSugerido: "Ouriço" },
  { id: "minhoca", label: "Anelídeo", nomeSugerido: "Anelídeo", Lucide: Worm },
  { id: "ovo", label: "Ovo / ninhal", nomeSugerido: "Outro", Lucide: Egg },
  { id: "outro", label: "Outro", nomeSugerido: "Outro", Lucide: PawPrint },
];

const byId = Object.fromEntries(SPECIES_ICON_PALETTE.map((i) => [i.id, i])) as Record<
  SpeciesIconId,
  SpeciesIconDef
>;

export function resolveSpeciesIconId(icone?: string | null, nome?: string | null): SpeciesIconId {
  if (icone && icone in byId) return icone as SpeciesIconId;
  const value = (nome ?? "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (/cao|cachorro|canin|dog/.test(value)) return "cao";
  if (/gato|felin|cat/.test(value)) return "gato";
  if (/ave|passar|papagaio|calopsita|canario|bird/.test(value)) return "ave";
  if (/peixe|fish|aquario/.test(value)) return "peixe";
  if (/coelh|rabbit/.test(value)) return "coelho";
  if (/tartaruga|turtle/.test(value)) return "tartaruga";
  if (/hamster|gerbil/.test(value)) return "hamster";
  if (/rato|rat/.test(value)) return "rato";
  if (/camundongo|mouse/.test(value)) return "camundongo";
  if (/cavalo|equin|pony|potro/.test(value)) return "cavalo";
  if (/porc|suin/.test(value)) return "porco";
  if (/vaca|boi|bovin|gado/.test(value)) return "vaca";
  if (/cabra|bode|caprin/.test(value)) return "cabra";
  if (/ovelha|carneiro|ovino/.test(value)) return "ovelha";
  if (/cobra|serpente|snake/.test(value)) return "cobra";
  if (/lagarto|gecko|iguana|reptil/.test(value)) return "lagarto";
  if (/sapo|ra\b|frog|anfib/.test(value)) return "sapo";
  if (/inseto|aranha|bug/.test(value)) return "inseto";
  if (/molusc|caracol|ostra/.test(value)) return "molusco";
  if (/furao|furão|ferret/.test(value)) return "furão";
  if (/ourico|ouriço|hedgehog/.test(value)) return "ouriço";
  return "outro";
}

function SvgFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

function HorseSvg({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <path d="M4 16c1.5-3 3-5 6-6l2-4 3 2 3-1 1 3-2 2v6" />
      <path d="M10 10c1 2 1 4 0 6" />
      <path d="M8 20v-3M14 20v-3" />
      <circle cx="16.5" cy="9.5" r="0.6" fill="currentColor" stroke="none" />
    </SvgFrame>
  );
}

function PigSvg({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <ellipse cx="12" cy="13" rx="7" ry="5" />
      <path d="M7 10 5 8M17 10l2-2" />
      <ellipse cx="12" cy="14" rx="2" ry="1.4" />
      <circle cx="9.5" cy="12" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="12" r="0.6" fill="currentColor" stroke="none" />
      <path d="M8 18v1.5M16 18v1.5" />
    </SvgFrame>
  );
}

function CowSvg({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <ellipse cx="12" cy="14" rx="7" ry="5" />
      <path d="M8 9c0-2 1.5-3.5 4-3.5S16 7 16 9" />
      <path d="M7 8 5.5 5.5M17 8l1.5-2.5" />
      <circle cx="10" cy="13" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="14" cy="13" r="0.6" fill="currentColor" stroke="none" />
      <path d="M9 19v1M15 19v1" />
    </SvgFrame>
  );
}

function GoatSvg({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <path d="M7 14c0-3 2-5 5-5s5 2 5 5v3H7z" />
      <path d="M9 9 7 5M15 9l2-4" />
      <path d="M10 14h1.5M12.5 14H14" />
      <path d="M9 20v-2M15 20v-2" />
    </SvgFrame>
  );
}

function SheepSvg({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <circle cx="9" cy="12" r="2.2" />
      <circle cx="13" cy="10.5" r="2.4" />
      <circle cx="15.5" cy="13.5" r="2.1" />
      <circle cx="11.5" cy="14.5" r="2.3" />
      <circle cx="7.5" cy="14.5" r="1.8" />
      <circle cx="17" cy="10" r="1.5" />
      <circle cx="18" cy="10.2" r="0.45" fill="currentColor" stroke="none" />
      <path d="M8 18.5V17M14 18.5V17" />
    </SvgFrame>
  );
}

function SnakeSvg({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <path d="M4 14c2-3 4-3 6 0s4 3 6 0 3-2 4-1" />
      <circle cx="19" cy="12.5" r="0.6" fill="currentColor" stroke="none" />
      <path d="M19.5 13.5 21 15" />
    </SvgFrame>
  );
}

function LizardSvg({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <ellipse cx="11" cy="12" rx="5" ry="3" />
      <path d="M16 12c2 0 3.5-1 5-3" />
      <path d="M8 9.5 6 7M14 9.5l2-2.5M8 14.5 6 17M14 14.5l2 2.5" />
      <circle cx="7.5" cy="11.5" r="0.5" fill="currentColor" stroke="none" />
    </SvgFrame>
  );
}

function FrogSvg({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <ellipse cx="12" cy="14" rx="6" ry="4" />
      <circle cx="8.5" cy="10" r="2" />
      <circle cx="15.5" cy="10" r="2" />
      <circle cx="8.5" cy="10" r="0.55" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="10" r="0.55" fill="currentColor" stroke="none" />
      <path d="M7 17c-1.5 1-2.5 2-2.5 2.5M17 17c1.5 1 2.5 2 2.5 2.5" />
    </SvgFrame>
  );
}

function FerretSvg({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <ellipse cx="11" cy="13" rx="6" ry="3.2" />
      <path d="M17 13c2 .2 3.5-1 4.5-2.5" />
      <path d="M7 11.5 5.5 9M9 11 8 8.5" />
      <circle cx="7.2" cy="12.5" r="0.5" fill="currentColor" stroke="none" />
      <path d="M8 16.5v1.5M13 16.5v1.5" />
    </SvgFrame>
  );
}

function HedgehogSvg({ className }: { className?: string }) {
  return (
    <SvgFrame className={className}>
      <path d="M5 14c0-4 3-7 7-7 3.5 0 6 2 7 5" />
      <path d="M6 11 4.5 8.5M9 8.5 8 6M12 7.5V5M15 8l1-2.5M18 10.5l2-1.5" />
      <ellipse cx="14" cy="15" rx="5" ry="3" />
      <circle cx="17.2" cy="14.2" r="0.5" fill="currentColor" stroke="none" />
      <path d="M11 18v1M16 18v1" />
    </SvgFrame>
  );
}

const CUSTOM: Partial<Record<SpeciesIconId, (p: { className?: string }) => ReactNode>> = {
  cavalo: HorseSvg,
  porco: PigSvg,
  vaca: CowSvg,
  cabra: GoatSvg,
  ovelha: SheepSvg,
  cobra: SnakeSvg,
  lagarto: LizardSvg,
  sapo: FrogSvg,
  furão: FerretSvg,
  ouriço: HedgehogSvg,
};

export function SpeciesIcon({
  icone,
  nome,
  className = "size-5",
}: {
  icone?: string | null;
  nome?: string | null;
  className?: string;
}) {
  const id = resolveSpeciesIconId(icone, nome);
  const def = byId[id];
  const Custom = CUSTOM[id];
  if (Custom) return <Custom className={className} />;
  const Icon = def.Lucide ?? PawPrint;
  return <Icon className={className} aria-hidden />;
}
