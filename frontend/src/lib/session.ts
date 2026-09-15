export type Session = {
  tipo: "ADMINISTRADOR_SISTEMA" | "COLABORADOR" | "CLIENTE";
  atorId: number;
  empresaId: number | null;
  nome: string;
  identificador: string;
  papeis: string[];
};

export function homeFor(session: Session): string {
  if (session.tipo === "ADMINISTRADOR_SISTEMA") {
    return session.empresaId ? "/app" : "/admin";
  }
  if (session.tipo === "CLIENTE") return "/cliente";
  return "/app";
}

export function isClinicAdmin(session: Session | null): boolean {
  return Boolean(session?.tipo === "COLABORADOR" && session.papeis.some((papel) => papel.toLowerCase() === "administrador"));
}

export function isPlatformAdmin(session: Session | null): boolean {
  return session?.tipo === "ADMINISTRADOR_SISTEMA";
}

export function isCollaborator(session: Session | null): boolean {
  return session?.tipo === "COLABORADOR";
}

export function isTutor(session: Session | null): boolean {
  return session?.tipo === "CLIENTE";
}
