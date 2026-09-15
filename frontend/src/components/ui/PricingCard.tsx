import { Check } from "lucide-react";
import { Button } from "./Button";

type PricingCardProps = {
  name: string;
  description: string;
  price: string;
  features: string[];
  href: string;
  highlighted?: boolean;
};

export function PricingCard({
  name,
  description,
  price,
  features,
  href,
  highlighted = false,
}: PricingCardProps) {
  return (
    <article
      className={[
        "flex h-full min-w-0 flex-col rounded-2xl border p-5 sm:p-8",
        highlighted
          ? "border-brand bg-white shadow-lg shadow-brand/10 ring-1 ring-brand/20 dark:bg-zinc-900"
          : "border-line bg-white dark:border-zinc-800 dark:bg-zinc-900",
      ].join(" ")}
    >
      {highlighted ? (
        <p className="mb-3 text-xs font-semibold tracking-wide text-brand uppercase">
          Mais escolhido
        </p>
      ) : null}
      <h3 className="text-xl font-bold text-ink dark:text-white">{name}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted dark:text-zinc-400">{description}</p>
      <p className="mt-6 text-2xl font-bold break-words text-ink sm:text-3xl dark:text-white">{price}</p>
      <p className="mt-1 text-xs text-muted dark:text-zinc-500">Assinatura mensal da plataforma</p>
      <ul className="mt-6 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex gap-3 text-sm text-ink dark:text-zinc-200">
            <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Button to={href} className="mt-8 w-full" variant={highlighted ? "primary" : "secondary"}>
        Escolher plano
      </Button>
    </article>
  );
}
