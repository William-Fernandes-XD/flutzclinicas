const STATUS_LABEL: Record<string, string> = {
  SOLICITADO: "Aguardando aprovação",
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  CONFIRMADO: "Confirmado",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
  FALTOU: "Faltou",
  RECUSADO: "Recusado",
  CANCELADO_CLIENTE: "Cancelado pelo tutor",
  CANCELADO_CLINICA: "Cancelado pela clínica",
  AGUARDANDO_CLIENTE: "Aguardando tutor",
};

export const DIAS_SEMANA = [
  { iso: 1, label: "Segunda" },
  { iso: 2, label: "Terça" },
  { iso: 3, label: "Quarta" },
  { iso: 4, label: "Quinta" },
  { iso: 5, label: "Sexta" },
  { iso: 6, label: "Sábado" },
  { iso: 7, label: "Domingo" },
];

export function statusAgenda(codigo: string, descricao?: string | null): string {
  return STATUS_LABEL[codigo] ?? descricao ?? codigo;
}

export type TomAgenda = "warn" | "info" | "ok" | "danger" | "neutral" | "brand";

export function tomStatus(codigo: string): TomAgenda {
  const code = (codigo ?? "").toUpperCase();
  if (code === "CONFIRMADO") return "info";
  if (code === "CONCLUIDO") return "ok";
  if (code.includes("CANCEL") || code === "RECUSADO" || code === "FALTOU") return "danger";
  if (code === "SOLICITADO" || code === "AGUARDANDO_PAGAMENTO" || code === "AGUARDANDO_CLIENTE") return "warn";
  return "neutral";
}

/** Borda/accent dos cards conforme status. */
export function corStatusAgenda(codigo: string): { border: string; soft: string; text: string } {
  const tom = tomStatus(codigo);
  if (tom === "info") {
    return { border: "border-l-sky-500", soft: "bg-sky-50 text-sky-700", text: "text-sky-700" };
  }
  if (tom === "ok") {
    return { border: "border-l-emerald-500", soft: "bg-emerald-50 text-emerald-700", text: "text-emerald-700" };
  }
  if (tom === "danger") {
    return { border: "border-l-red-500", soft: "bg-red-50 text-red-700", text: "text-red-700" };
  }
  if (tom === "warn") {
    return { border: "border-l-amber-400", soft: "bg-amber-50 text-amber-800", text: "text-amber-800" };
  }
  return { border: "border-l-[#7828c8]", soft: "bg-[#f3eafc] text-[#7828c8]", text: "text-[#7828c8]" };
}

export function formatKm(value: number | null | undefined): string {
  if (value == null) return "Distância indisponível";
  return `${value.toLocaleString("pt-BR")} km`;
}

export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}
