import { useState } from "react";
import { Field, Input } from "./Field";

export function PhotoFileField({
  name = "foto",
  label = "Foto de perfil",
  hint = "PNG, JPG ou WEBP até 2 MB. Opcional — você pode incluir agora ou depois nas configurações.",
}: {
  name?: string;
  label?: string;
  hint?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <Field label={label} hint={hint}>
      <div className="grid gap-3">
        {preview ? <img src={preview} alt="" className="size-24 rounded-2xl object-cover ring-1 ring-line" /> : null}
        <Input
          name={name}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setPreview((atual) => {
              if (atual) URL.revokeObjectURL(atual);
              return file ? URL.createObjectURL(file) : null;
            });
          }}
        />
      </div>
    </Field>
  );
}
