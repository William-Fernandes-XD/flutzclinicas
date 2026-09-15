import type { ReactNode } from "react";
import { petArt } from "../../lib/pets-art";

const GALLERY = [petArt.dog, petArt.cat, petArt.bunny, petArt.bird, petArt.puppy, petArt.kitten];

function pickArt(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash + key.charCodeAt(i) * (i + 1)) % GALLERY.length;
  return GALLERY[hash];
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  art,
  hideArt = true,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  art?: string;
  hideArt?: boolean;
}) {
  const image = art ?? pickArt(typeof title === "string" ? title : "Flutz");

  return (
    <div className="living-card mb-6 overflow-hidden sm:mb-8">
      <div className={`grid min-w-0 ${hideArt ? "" : "sm:grid-cols-[minmax(0,1fr)_13rem]"}`}>
        <div className="flex min-w-0 flex-col justify-center gap-4 bg-white p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6 dark:bg-zinc-900">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-xs font-bold tracking-[0.16em] text-brand uppercase">{eyebrow}</p>
            ) : null}
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl dark:text-white">{title}</h1>
            {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex min-w-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
        {!hideArt ? (
          <img src={image} alt="" className="h-40 w-full object-cover sm:h-full sm:min-h-36" />
        ) : null}
      </div>
    </div>
  );
}
