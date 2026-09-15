import { http } from "./http";

export type FotoAlvo = "tutor" | "pet" | "colaborador" | "clinica";

export function fileFromForm(data: FormData, name = "foto"): File | null {
  const value = data.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

export async function uploadPerfilFoto(opts: {
  alvo: FotoAlvo;
  arquivo: File;
  petId?: number;
  colaboradorId?: number;
  clienteId?: number;
}): Promise<void> {
  const body = new FormData();
  body.append("alvo", opts.alvo);
  body.append("arquivo", opts.arquivo);
  if (opts.petId) body.append("petId", String(opts.petId));
  if (opts.colaboradorId) body.append("colaboradorId", String(opts.colaboradorId));
  if (opts.clienteId) body.append("clienteId", String(opts.clienteId));
  await http("/api/perfil/foto", { method: "POST", body });
}
