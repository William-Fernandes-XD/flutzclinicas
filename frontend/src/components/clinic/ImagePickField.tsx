import { useState } from "react";
import { mediaUrl } from "../../lib/media";
import { Field, Input } from "../ui/Field";

export function ImagePickField({
  label,
  destine,
  currentUrl,
  onPick,
}: {
  label: string;
  destine: "logo" | "hero" | "galeria";
  currentUrl?: string | null;
  onPick: (file: File, previewUrl: string) => void;
}) {
  const [local, setLocal] = useState<{ name: string; size: string; url: string } | null>(null);
  const shown = local?.url || mediaUrl(currentUrl);

  return (
    <Field label={label} hint={hintFor(destine)}>
      <div className="grid gap-3">
        {shown ? (
          <figure className="overflow-hidden rounded-2xl bg-[#f7f5fb] ring-1 ring-line">
            <img src={shown} alt="" className={destine === "logo" ? "mx-auto size-28 object-cover" : "h-40 w-full object-cover"} />
            <figcaption className="px-3 py-2 text-xs text-muted">
              {local ? (
                <>
                  Arquivo escolhido: <strong className="text-ink">{local.name}</strong> · {local.size}
                  {destine === "logo" ? " · vai para a logo da clínica" : destine === "hero" ? " · vai para o fundo da hero" : " · vai para a galeria"}
                </>
              ) : (
                "Imagem atual nesta posição"
              )}
            </figcaption>
          </figure>
        ) : (
          <p className="rounded-2xl bg-[#f7f5fb] px-3 py-4 text-sm text-muted">Nenhuma imagem nesta posição ainda.</p>
        )}
        <Input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            if (destine !== "galeria" && local?.url.startsWith("blob:")) URL.revokeObjectURL(local.url);
            const url = URL.createObjectURL(file);
            setLocal({ name: file.name, size: bytes(file.size), url });
            onPick(file, url);
          }}
        />
      </div>
    </Field>
  );
}

function hintFor(destine: "logo" | "hero" | "galeria"): string {
  if (destine === "logo") return "PNG, JPG ou WEBP até 2 MB. Esta é a marca no topo da página.";
  if (destine === "hero") return "PNG, JPG ou WEBP até 2 MB. Esta é a foto de fundo da faixa inicial.";
  return "PNG, JPG ou WEBP até 2 MB. Esta foto entra na galeria pública.";
}

function bytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
