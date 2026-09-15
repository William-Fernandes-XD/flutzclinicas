import type { ReactNode } from "react";
import { photoForSpecies } from "../../lib/pets-art";
import { mediaUrl } from "../../lib/media";

export function PanelHero({
  image,
  eyebrow,
  title,
  description,
  actions,
}: {
  image: string;
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <section className="relative mb-8 min-w-0 overflow-hidden rounded-[2rem] bg-[#2a1a14] text-white shadow-[0_24px_60px_-28px_rgba(120,40,200,0.45)]">
      <img src={image} alt="" className="absolute inset-0 size-full object-cover object-[center_20%]" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#2a1020]/88 via-[#3b1840]/55 to-transparent" />
      <div className="relative grid min-h-56 content-end p-6 sm:min-h-64 sm:p-8">
        <div className="min-w-0 max-w-xl">
          {eyebrow ? <p className="text-xs font-bold tracking-[0.18em] text-amber-200 uppercase">{eyebrow}</p> : null}
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/85 sm:text-base">{description}</p>
          {actions ? <div className="mt-5 flex min-w-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
    </section>
  );
}

export function PetPhoto({
  especie,
  seed = 0,
  src,
  className = "size-16 rounded-2xl",
}: {
  especie?: string | null;
  seed?: number;
  src?: string | null;
  className?: string;
}) {
  const shown = mediaUrl(src) || photoForSpecies(especie, seed);
  return <img src={shown} alt="" className={`object-cover ${className}`} />;
}
