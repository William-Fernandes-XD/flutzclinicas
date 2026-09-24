import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function Modal({
  open,
  title,
  description,
  icon,
  children,
  onClose,
  footer,
  wide = false,
}: {
  open: boolean;
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative flex min-w-0 flex-col rounded-3xl bg-white shadow-2xl dark:bg-zinc-900 ${
          wide ? "max-h-[min(92svh,52rem)] w-full max-w-4xl" : "max-h-[min(92svh,40rem)] w-full max-w-lg"
        }`}
      >
        <div className="flex min-w-0 items-start justify-between gap-3 border-b border-line px-5 py-4 dark:border-zinc-800">
          <div className="flex min-w-0 items-start gap-3">
            {icon ? (
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 id="modal-title" className="min-w-0 truncate text-lg font-semibold text-ink dark:text-white">
                {title}
              </h2>
              {description ? <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl hover:bg-brand-soft"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-line px-5 py-4 dark:border-zinc-800">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
