import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/EmptyState";
import { Field, Input, Surface } from "../../components/ui/Field";
import { PageHeader } from "../../components/ui/PageHeader";
import { http, HttpError } from "../../lib/http";
import { mediaUrl } from "../../lib/media";
import type { Perfil } from "../../lib/perfil";
import { isClinicAdmin, isPlatformAdmin, isTutor } from "../../lib/session";
import { useAuth } from "../../providers/AuthProvider";
import { useToast } from "../../providers/ToastProvider";

export function SettingsPage() {
  const { session } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const perfil = useQuery({ queryKey: ["perfil"], queryFn: () => http<Perfil>("/api/perfil") });
  const salvar = useMutation({
    mutationFn: (body: Record<string, unknown>) => http<Perfil>("/api/perfil", { method: "PUT", json: body }),
    onSuccess: (data) => {
      queryClient.setQueryData(["perfil"], data);
      toast.push("Perfil atualizado.");
    },
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    try {
      await salvar.mutateAsync({
        nome: data.get("nome"),
        email: data.get("email"),
        telefone: data.get("telefone"),
        senha: data.get("senha") || null,
        permitirNotificacoes: perfil.data?.permitirNotificacoes == null ? null : data.get("permitirNotificacoes") === "on",
        nomeClinica: data.get("nomeClinica"),
        emailClinica: data.get("emailClinica"),
        telefoneClinica: data.get("telefoneClinica"),
        cidade: data.get("cidade"),
        uf: data.get("uf"),
      });
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Não foi possível salvar o perfil.");
    }
  }

  const data = perfil.data;
  const tutor = isTutor(session);
  const clinicAdmin = isClinicAdmin(session) || (isPlatformAdmin(session) && Boolean(session?.empresaId));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Configurações"
        description="Atualize seus dados e a foto de perfil. A imagem aparece no painel e, quando for o caso, na página da clínica."
      />
      {!data ? (
        <p className="text-sm text-muted">Carregando perfil…</p>
      ) : data.tipo === "plataforma" ? (
        <Surface>
          <h2 className="font-semibold">Conta da plataforma</h2>
          <p className="mt-2 text-sm text-muted">Nome e e-mail desta conta não são alterados por aqui.</p>
          <p className="mt-3 font-medium">{data.nome}</p>
          <p className="text-sm text-muted">{data.email}</p>
        </Surface>
      ) : (
        <>
          {data.tipo === "tutor" || data.tipo === "colaborador" ? (
          <FotoBloco
            titulo={tutor ? "Sua foto" : "Foto do colaborador"}
            atual={data.fotoUrl}
            alvo={tutor ? "tutor" : "colaborador"}
            onSaved={() => queryClient.invalidateQueries({ queryKey: ["perfil"] })}
          />
          ) : null}
          <form onSubmit={onSubmit} className="grid gap-4">
            <Surface className="grid gap-4">
              <h2 className="font-semibold">Seus dados</h2>
              <Field label="Nome"><Input name="nome" defaultValue={data.nome} required /></Field>
              {tutor ? (
                <Field label="E-mail"><Input name="email" type="email" defaultValue={data.email ?? ""} /></Field>
              ) : (
                <Field label="E-mail">
                  <Input name="email" type="email" defaultValue={data.email ?? ""} disabled />
                </Field>
              )}
              <Field label="Telefone"><Input name="telefone" defaultValue={data.telefone ?? ""} /></Field>
              <Field label="Nova senha" hint="Deixe em branco para manter a atual.">
                <Input name="senha" type="password" autoComplete="new-password" />
              </Field>
              {data.permitirNotificacoes != null ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="permitirNotificacoes"
                    key={String(data.permitirNotificacoes)}
                    defaultChecked={Boolean(data.permitirNotificacoes)}
                  />
                  Permitir avisos
                </label>
              ) : null}
            </Surface>
            {clinicAdmin ? (
              <Surface className="grid gap-4">
                <h2 className="font-semibold">Dados da clínica</h2>
                <FotoBloco
                  titulo="Logo da clínica"
                  atual={data.logoUrl}
                  alvo="clinica"
                  onSaved={() => queryClient.invalidateQueries({ queryKey: ["perfil"] })}
                />
                <Field label="Nome da clínica"><Input name="nomeClinica" defaultValue={data.nomeClinica ?? ""} /></Field>
                <Field label="E-mail da clínica"><Input name="emailClinica" type="email" defaultValue={data.emailClinica ?? ""} /></Field>
                <Field label="Telefone"><Input name="telefoneClinica" defaultValue={data.telefoneClinica ?? ""} /></Field>
                <Field label="Cidade"><Input name="cidade" defaultValue={data.cidade ?? ""} /></Field>
                <Field label="UF"><Input name="uf" defaultValue={data.uf ?? ""} maxLength={2} /></Field>
              </Surface>
            ) : null}
            {tutor ? (
              <p className="text-sm text-muted">
                Para alterar nome e foto do pet, abra o animal em Meus pets.
              </p>
            ) : null}
            {error ? <ErrorState message={error} /> : null}
            <Button type="submit" busy={salvar.isPending} busyLabel="Salvando…">
              Salvar alterações
            </Button>
          </form>
        </>
      )}
    </div>
  );
}

function FotoBloco({
  titulo,
  atual,
  alvo,
  petId,
  onSaved,
}: {
  titulo: string;
  atual: string | null | undefined;
  alvo: string;
  petId?: number;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const shown = mediaUrl(atual);

  async function onPick(file: File) {
    if (uploading) return;
    setError("");
    setUploading(true);
    const body = new FormData();
    body.append("alvo", alvo);
    body.append("arquivo", file);
    if (petId) body.append("petId", String(petId));
    try {
      await http("/api/perfil/foto", { method: "POST", body });
      toast.push("Foto atualizada.");
      onSaved();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Não foi possível enviar a foto.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Surface className="grid gap-3">
      <h2 className="font-semibold">{titulo}</h2>
      {shown ? (
        <img src={shown} alt="" className="size-28 rounded-2xl object-cover" />
      ) : (
        <p className="text-sm text-muted">Nenhuma foto ainda. PNG, JPG ou WEBP até 2 MB.</p>
      )}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void onPick(file);
        }}
      />
      {uploading ? <p className="text-sm text-muted">Enviando foto…</p> : null}
      {error ? <ErrorState message={error} /> : null}
    </Surface>
  );
}

export function PetSettingsFields({ petId }: { petId: number }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const pet = useQuery({ queryKey: ["pet", petId], queryFn: () => http<{ nome: string; sexo: string; fotoUrl?: string | null }>(`/api/pets/${petId}`) });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    setError("");
    setSaving(true);
    try {
      await http(`/api/perfil/pets/${petId}`, {
        method: "PUT",
        json: { nome: data.get("nome"), sexo: data.get("sexo") },
      });
      toast.push("Perfil do pet atualizado.");
      queryClient.invalidateQueries({ queryKey: ["pet", petId] });
      queryClient.invalidateQueries({ queryKey: ["pets"] });
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Não foi possível salvar o pet.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    setError("");
  }, [petId]);

  if (!pet.data) return null;

  return (
    <div className="space-y-4">
      <FotoBloco
        titulo="Foto do pet"
        atual={pet.data.fotoUrl}
        alvo="pet"
        petId={petId}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["pet", petId] })}
      />
      <form onSubmit={onSubmit} className="grid gap-3">
        <Field label="Nome"><Input name="nome" defaultValue={pet.data.nome} required /></Field>
        <Field label="Sexo">
          <select name="sexo" defaultValue={pet.data.sexo} className="w-full rounded-xl border border-line px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950">
            <option value="I">Indefinido</option>
            <option value="M">Macho</option>
            <option value="F">Fêmea</option>
          </select>
        </Field>
        {error ? <ErrorState message={error} /> : null}
        <Button type="submit" busy={saving} busyLabel="Salvando…">Salvar pet</Button>
      </form>
    </div>
  );
}
