import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { mediaUrl } from "../lib/media";
import { HttpError } from "../lib/http";

type Toast = {
  id: number;
  message: string;
  detail?: string;
  fotoUrl?: string | null;
  atorNome?: string | null;
  tone: "ok" | "danger";
};

type PushOptions = {
  tone?: Toast["tone"];
  detail?: string;
  fotoUrl?: string | null;
  atorNome?: string | null;
};

const ToastContext = createContext<{
  push: (message: string, toneOrOptions?: Toast["tone"] | PushOptions) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((message: string, toneOrOptions: Toast["tone"] | PushOptions = "ok") => {
    const opts: PushOptions =
      typeof toneOrOptions === "string" ? { tone: toneOrOptions } : (toneOrOptions ?? {});
    const id = Date.now() + Math.random();
    setItems((current) => [
      ...current,
      {
        id,
        message,
        detail: opts.detail,
        fotoUrl: opts.fotoUrl,
        atorNome: opts.atorNome,
        tone: opts.tone ?? "ok",
      },
    ]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 5200);
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
        {items.map((item) => {
          const foto = mediaUrl(item.fotoUrl);
          const inicial = (item.atorNome?.trim()?.[0] || item.message.trim()[0] || "?").toUpperCase();
          return (
            <div
              key={item.id}
              className={`flex items-start gap-3 rounded-2xl px-3 py-3 text-sm shadow-xl ${
                item.tone === "danger"
                  ? "bg-red-50 text-danger"
                  : "bg-white text-ink ring-1 ring-black/5"
              }`}
            >
              {item.tone === "ok" ? (
                foto ? (
                  <img src={foto} alt="" className="mt-0.5 size-10 shrink-0 rounded-full object-cover" />
                ) : item.atorNome || item.detail ? (
                  <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f3eafc] text-sm font-bold text-[#7828c8]">
                    {inicial}
                  </span>
                ) : null
              ) : null}
              <div className="min-w-0 flex-1">
                {item.atorNome ? (
                  <p className="truncate text-xs font-semibold text-[#7828c8]">{item.atorNome}</p>
                ) : null}
                <p className="font-medium leading-snug">{item.message}</p>
                {item.detail ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-[#6e6680]">{item.detail}</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast precisa do ToastProvider");
  return value;
}
