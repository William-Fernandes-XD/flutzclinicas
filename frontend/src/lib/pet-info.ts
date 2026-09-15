export function sexoLabel(sexo?: string | null): string {
  if (sexo === "M") return "Macho";
  if (sexo === "F") return "Fêmea";
  return "Sexo indefinido";
}

export function idadeLabel(nascimento?: string | null): string | null {
  if (!nascimento) return null;
  const date = new Date(`${nascimento}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - date.getFullYear();
  let months = now.getMonth() - date.getMonth();
  if (now.getDate() < date.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years <= 0 && months <= 0) return "Filhote";
  if (years <= 0) return `${months} ${months === 1 ? "mês" : "meses"}`;
  return `${years} ${years === 1 ? "ano" : "anos"}`;
}

export function formatCpf(value?: string | null): string {
  const digits = (value ?? "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const iso = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return value.includes("T") ? date.toLocaleString("pt-BR") : date.toLocaleDateString("pt-BR");
}
