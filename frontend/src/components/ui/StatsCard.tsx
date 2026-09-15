import type { ReactNode } from "react";

export function StatsCard({
  label,
  value,
  hint,
  trend,
  chart,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: string;
  chart?: ReactNode;
}) {
  return (
    <article className="min-w-0 rounded-3xl bg-white/90 p-5 shadow-[0_16px_40px_-24px_rgba(120,40,200,0.35)] ring-1 ring-brand/10 dark:bg-zinc-900 dark:ring-white/5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-ink dark:text-white">{value}</p>
      {trend ? <p className="mt-1 text-xs font-medium text-brand">{trend}</p> : null}
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      {chart ? <div className="mt-4 h-14 min-w-0">{chart}</div> : null}
    </article>
  );
}
