import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FlutzLoader } from "../components/ui/FlutzLoader";
import { writeLastClinic } from "../lib/clinic-storage";
import { http, HttpError } from "../lib/http";
import type { Session } from "../lib/session";
import { api } from "../services/api";

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  loggingOut: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setClinic: (empresaId: number | null) => Promise<Session>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false);
  const logoutLock = useRef<Promise<void> | null>(null);
  const me = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async ({ signal }) => {
      const timeout = AbortSignal.timeout(12_000);
      const combined =
        typeof AbortSignal.any === "function" ? AbortSignal.any([signal, timeout]) : timeout;
      try {
        return await http<Session>("/api/auth/me", { signal: combined });
      } catch (error) {
        if (error instanceof HttpError && error.status === 401) {
          return null;
        }
        // Rede/5xx/timeout: libera a tela de login em vez de splash infinito.
        if (
          error instanceof HttpError
          || (error instanceof DOMException && error.name === "TimeoutError")
          || (error instanceof TypeError)
          || (error instanceof Error && /abort|timeout|network/i.test(error.message))
        ) {
          return null;
        }
        throw error;
      }
    },
    retry: false,
  });

  // React assume o splash; HTML some na hora (sem fade).
  useEffect(() => {
    document.getElementById("boot-splash")?.remove();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session: me.data ?? null,
      loading: me.isLoading,
      loggingOut,
      refresh: async () => {
        await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      },
      logout: async () => {
        if (logoutLock.current) {
          return logoutLock.current;
        }
        setLoggingOut(true);
        logoutLock.current = (async () => {
          try {
            await http("/api/auth/logout", { method: "POST" });
            queryClient.setQueryData(["auth", "me"], null);
            await queryClient.invalidateQueries();
          } finally {
            logoutLock.current = null;
            setLoggingOut(false);
          }
        })();
        return logoutLock.current;
      },
      setClinic: async (empresaId) => {
        const session = await api.setContext(empresaId);
        queryClient.setQueryData(["auth", "me"], session);
        if (empresaId) {
          writeLastClinic(session.atorId, empresaId);
        }
        await queryClient.invalidateQueries();
        return session;
      },
    }),
    [loggingOut, me.data, me.isLoading, queryClient],
  );

  return (
    <AuthContext.Provider value={value}>
      {me.isLoading ? <FlutzLoader fullScreen label="Preparando o Flutz…" /> : children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth precisa estar dentro de AuthProvider");
  }
  return value;
}
