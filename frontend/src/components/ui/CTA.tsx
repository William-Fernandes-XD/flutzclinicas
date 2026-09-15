import type { ReactNode } from "react";
import { Button } from "./Button";

type CTAProps = {
  title: string;
  description: string;
  actionLabel: string;
  href?: string;
  to?: string;
  children?: ReactNode;
};

export function CTA({ title, description, actionLabel, href, to, children }: CTAProps) {
  return (
    <section className="w-full min-w-0 rounded-3xl bg-brand px-4 py-10 text-center text-white sm:px-10 sm:py-12">
      <h2 className="text-2xl font-bold tracking-tight break-words sm:text-3xl">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-white/85">
        {description}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {to ? (
          <Button
            to={to}
            variant="secondary"
            size="lg"
            className="border-transparent bg-white text-brand hover:bg-brand-soft"
          >
            {actionLabel}
          </Button>
        ) : (
          <Button
            href={href ?? "/cadastro"}
            variant="secondary"
            size="lg"
            className="border-transparent bg-white text-brand hover:bg-brand-soft"
          >
            {actionLabel}
          </Button>
        )}
        {children}
      </div>
    </section>
  );
}
