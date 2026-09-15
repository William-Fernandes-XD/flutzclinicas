import type { ReactNode } from "react";

type TableFrameProps = {
  children: ReactNode;
  caption?: string;
};

/** Scroll horizontal só da tabela, sem alargar a página. */
export function TableFrame({ children, caption }: TableFrameProps) {
  return (
    <div className="w-full min-w-0 max-w-full">
      <div className="w-full min-w-0 overflow-x-auto rounded-2xl border border-line dark:border-zinc-800">
        {caption ? <p className="sr-only">{caption}</p> : null}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
