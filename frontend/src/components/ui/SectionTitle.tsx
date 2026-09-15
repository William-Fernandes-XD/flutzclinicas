type SectionTitleProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  id?: string;
};

export function SectionTitle({
  eyebrow,
  title,
  description,
  align = "center",
  id,
}: SectionTitleProps) {
  const alignment = align === "center" ? "mx-auto text-center" : "text-left";

  return (
    <div className={`w-full min-w-0 max-w-2xl ${alignment}`}>
      {eyebrow ? (
        <p className="mb-3 text-sm font-semibold tracking-wide text-brand uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h2 id={id} className="text-2xl font-bold tracking-tight break-words text-ink sm:text-3xl lg:text-4xl dark:text-white">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-relaxed text-muted dark:text-zinc-400">
          {description}
        </p>
      ) : null}
    </div>
  );
}
