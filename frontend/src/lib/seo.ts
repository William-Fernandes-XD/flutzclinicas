/** SEO institucional — valores públicos (sem inventar dados comerciais). */

export const SEO = {
  title: "Flutz | SaaS de Gestão para Clínicas Veterinárias",
  description:
    "Conheça o Flutz, um SaaS desenvolvido para clínicas veterinárias. Centralize a gestão da clínica, organize a operação e atenda tutores em uma plataforma na nuvem.",
  ogTitle: "Flutz | SaaS de Gestão para Clínicas Veterinárias",
  ogDescription:
    "Software SaaS para clínicas veterinárias: gestão da operação, agenda, pets, atendimentos e página pública em um só lugar.",
} as const;

/** Rotas que o Google não deve indexar (áreas autenticadas ou de conta). */
export function isPrivatePath(pathname: string): boolean {
  if (
    pathname.startsWith("/app") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/cliente")
  ) {
    return true;
  }
  return (
    pathname === "/login" ||
    pathname === "/cadastro" ||
    pathname === "/recuperar-senha" ||
    pathname === "/403"
  );
}

/** Homepage institucional e páginas legais/públicas de clínica podem ser indexadas. */
export function isIndexablePath(pathname: string): boolean {
  if (isPrivatePath(pathname)) return false;
  if (pathname === "/" || pathname === "/privacidade" || pathname === "/termos") return true;
  if (pathname.startsWith("/clinica/")) return true;
  return false;
}

export function absoluteUrl(path = "/"): string {
  const base = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") || "";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!base) return normalized;
  return `${base}${normalized === "/" ? "/" : normalized}`;
}
