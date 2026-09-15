import { mediaUrl } from "../../lib/media";

export function Avatar({ name, src, size = "md" }: { name: string; src?: string | null; size?: "sm" | "md" | "lg" }) {
  const box = size === "sm" ? "size-8 text-xs" : size === "lg" ? "size-14 text-lg" : "size-10 text-sm";
  const shown = mediaUrl(src);
  if (shown) {
    return <img src={shown} alt="" className={`${box} rounded-2xl object-cover`} />;
  }
  return (
    <span className={`inline-flex ${box} items-center justify-center rounded-2xl bg-brand-soft font-bold text-brand`}>
      {(name.trim()[0] || "?").toUpperCase()}
    </span>
  );
}
