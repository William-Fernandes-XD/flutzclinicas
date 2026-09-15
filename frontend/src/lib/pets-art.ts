import bird from "../assets/app/panel-bird-card.png";
import bunny from "../assets/app/panel-bunny.png";
import cat from "../assets/app/panel-cat-card.png";
import dog from "../assets/app/panel-dog-card.png";
import kitten from "../assets/app/panel-kitten.png";
import puppy from "../assets/app/panel-puppy.png";

export const petArt = { puppy, kitten, dog, cat, bird, bunny };

export function photoForSpecies(especie?: string | null, seed = 0): string {
  const value = (especie ?? "").toLowerCase();
  if (value.includes("gato") || value.includes("felin")) return cat;
  if (value.includes("ave") || value.includes("páss") || value.includes("passaro") || value.includes("pássaro")) return bird;
  if (value.includes("cão") || value.includes("cao") || value.includes("cachorr") || value.includes("canin")) return dog;
  return [dog, cat, bunny, bird][Math.abs(seed) % 4];
}
