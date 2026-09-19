import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { mediaUrl } from "../../lib/media";

type Slide = { id: number; url: string; alt?: string | null };

const INTERVAL_MS = 4000;

export function GaleriaCarousel({ items }: { items: Slide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = items.length;

  useEffect(() => {
    setIndex(0);
  }, [total]);

  useEffect(() => {
    if (total <= 1 || paused) return;
    const timer = window.setInterval(() => {
      setIndex((atual) => (atual + 1) % total);
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [total, paused]);

  if (!total) return null;

  const go = (dir: -1 | 1) => {
    setIndex((atual) => (atual + dir + total) % total);
  };

  return (
    <div
      className="relative mt-5 overflow-hidden rounded-3xl bg-[#f7f5fb] ring-1 ring-violet-100"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {items.map((item) => (
          <div key={item.id} className="w-full shrink-0">
            <img
              src={mediaUrl(item.url)}
              alt={item.alt ?? ""}
              className="aspect-[16/10] w-full object-cover sm:aspect-[21/9]"
            />
          </div>
        ))}
      </div>

      {total > 1 ? (
        <>
          <button
            type="button"
            aria-label="Foto anterior"
            onClick={() => go(-1)}
            className="absolute top-1/2 left-3 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-brand shadow-md ring-1 ring-violet-100 hover:bg-white"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Próxima foto"
            onClick={() => go(1)}
            className="absolute top-1/2 right-3 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-brand shadow-md ring-1 ring-violet-100 hover:bg-white"
          >
            <ChevronRight className="size-5" />
          </button>

          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Ir para foto ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "w-6 bg-brand" : "w-2 bg-white/80 ring-1 ring-black/10"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
