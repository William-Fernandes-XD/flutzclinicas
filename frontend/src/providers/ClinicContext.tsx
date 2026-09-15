import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import { api } from "../services/api";
import type { ClinicBrand } from "../types/api";
import { useAuth } from "./AuthProvider";

const ClinicContext = createContext<ClinicBrand | null>(null);

export function ClinicProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: ["contexto", "clinica", session?.empresaId],
    enabled: Boolean(session?.empresaId),
    queryFn: api.clinicContext,
  });
  return <ClinicContext.Provider value={query.data ?? null}>{children}</ClinicContext.Provider>;
}

export function useClinicBrand(): ClinicBrand | null {
  return useContext(ClinicContext);
}
