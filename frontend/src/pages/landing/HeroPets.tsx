import heroCat from "../../assets/hero-cat.png";
import heroKitten from "../../assets/hero-kitten.png";
import heroPuppy from "../../assets/hero-puppy.png";

export function HeroPets() {
  return (
    <div className="mx-auto grid w-full min-w-0 max-w-[20rem] grid-cols-2 gap-2.5 sm:max-w-sm">
      <PetCard src={heroKitten} alt="Gatinho ilustrativo" tall />
      <PetCard src={heroPuppy} alt="Filhote ilustrativo" />
      <PetCard src={heroCat} alt="Gato ilustrativo" className="col-span-2 mx-auto w-1/2" />
    </div>
  );
}

function PetCard({
  src,
  alt,
  className = "",
  tall = false,
}: {
  src: string;
  alt: string;
  className?: string;
  tall?: boolean;
}) {
  return (
    <figure
      className={`min-w-0 overflow-hidden rounded-2xl bg-white ring-4 ring-brand/20 ${tall ? "aspect-[3/4]" : "aspect-[4/5]"} ${className}`.trim()}
    >
      <img
        src={src}
        alt={alt}
        className="size-full max-h-full max-w-full object-cover object-top"
      />
    </figure>
  );
}
