export function Badge({
  children,
  tone = "neutral",
}: {
  children: string;
  tone?: "neutral" | "ok" | "warn" | "danger" | "brand" | "info";
}) {
  const tones = {
    neutral: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
    ok: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200",
    warn: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    danger: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200",
    brand: "bg-brand-soft text-brand",
    info: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}
