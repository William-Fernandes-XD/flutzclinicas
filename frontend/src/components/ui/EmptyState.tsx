import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import emptyIllustration from "../../assets/app/empty-no-results-illustration.png";
import { FlutzLoader } from "./FlutzLoader";

export function EmptyState({
  title = "Nenhum resultado encontrado",
  description = "Não encontramos itens com os filtros selecionados. Tente ajustar ou remover algum filtro para ver mais opções.",
  action,
  onClear,
  clearLabel = "Limpar filtros",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  onClear?: () => void;
  clearLabel?: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg min-w-0 flex-col items-center px-4 py-8 text-center sm:py-10">
      {/* Ilustração sem texto — título/descrição/CTA ficam no HTML por cima */}
      <div className="relative w-full max-w-[17rem] sm:max-w-[19rem]">
        <img
          src={emptyIllustration}
          alt=""
          className="mx-auto h-auto w-full object-contain select-none"
          draggable={false}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent dark:from-[#0f1115]" />
      </div>

      <div className="relative z-10 -mt-2 w-full max-w-md">
        <h2 className="text-xl font-bold tracking-tight text-[#1f1630] sm:text-2xl dark:text-white">{title}</h2>
        <p className="mx-auto mt-3 text-sm leading-relaxed text-[#7a738c] sm:text-[0.95rem]">{description}</p>

        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="pointer-events-auto mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#7828c8] px-6 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(120,40,200,0.35)] transition hover:bg-[#6a22b4]"
          >
            <RefreshCw className="size-4" />
            {clearLabel}
          </button>
        ) : action ? (
          <div className="pointer-events-auto mt-7 flex flex-wrap items-center justify-center gap-3 [&_a]:rounded-full [&_button]:rounded-full">
            {action}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-danger/20 bg-red-50 px-4 py-3 text-sm text-danger dark:border-red-900/40 dark:bg-red-950/30">
      {message}
    </div>
  );
}

export function LoadingState({ label = "Carregando…" }: { label?: string }) {
  return <FlutzLoader label={label} />;
}
