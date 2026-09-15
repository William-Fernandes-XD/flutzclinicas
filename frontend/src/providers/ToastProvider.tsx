import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { HttpError } from "../lib/http";

type Toast = { id: number; message: string; tone: "ok" | "danger" };

const ToastContext = createContext<{ push: (message: string, tone?: Toast["tone"]) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  useEffect(() => {
    return queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "error") return;
      if (event.mutation.options.meta && (event.mutation.options.meta as { skipErrorToast?: boolean }).skipErrorToast) {
        return;
      }
      const error = event.mutation.state.error;
      const message =
        error instanceof HttpError
          ? error.message
          : error instanceof Error && error.message
            ? error.message
            : "Não foi possível salvar. Tente de novo.";
      push(message, "danger");
    });
  }, [push, queryClient]);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 z-[70] flex w-[min(22rem,calc(100%-2rem))] flex-col gap-2">
        {items.map((item) => (
          <p
            key={item.id}
            className={`rounded-2xl px-4 py-3 text-sm font-medium shadow-xl ${
              item.tone === "danger" ? "bg-red-50 text-danger" : "bg-white text-ink ring-1 ring-black/5"
            }`}
          >
            {item.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast precisa do ToastProvider");
  return value;
}
