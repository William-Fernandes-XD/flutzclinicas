import type { LucideIcon } from "lucide-react";

type FeatureCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <article className="h-full min-w-0 rounded-2xl border border-line bg-white p-5 sm:p-6 transition-colors hover:border-brand/30 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand dark:bg-brand/20 dark:text-purple-300">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold break-words text-ink dark:text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted dark:text-zinc-400">{description}</p>
    </article>
  );
}
