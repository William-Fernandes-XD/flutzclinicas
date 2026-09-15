import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { http, HttpError } from "../../lib/http";
import { Button } from "../ui/Button";
import { ErrorState } from "../ui/EmptyState";
import { Field, Input } from "../ui/Field";

export type TutorResumo = { id: number; nome: string; cpf: string; email: string | null };
export type PetResumo = { id: number; nome: string; especie?: string; raca?: string | null; clienteId: number };

type Busca = { tutor: TutorResumo; pets: PetResumo[] };

export function TutorCpfPetPicker({
  tutorField = "clienteId",
  petField = "petId",
}: {
  tutorField?: string;
  petField?: string;
}) {
  const [cpf, setCpf] = useState("");
  const [consulta, setConsulta] = useState("");
  const [petId, setPetId] = useState("");
  const [erro, setErro] = useState("");
  const busca = useQuery({
    queryKey: ["tutor-cpf", consulta],
    enabled: consulta.length === 11,
    queryFn: () => http<Busca>(`/api/tutores/busca?cpf=${consulta}`),
  });

  function onBuscar() {
    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11) {
      setErro("Informe um CPF com 11 dígitos.");
      return;
    }
    setErro("");
    setPetId("");
    setConsulta(digits);
  }

  const tutor = busca.data?.tutor;
  const pets = busca.data?.pets ?? [];

  return (
    <div className="grid gap-3 sm:col-span-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label="CPF do tutor">
          <Input
            value={cpf}
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            onChange={(event) => setCpf(event.target.value)}
          />
        </Field>
        <Button type="button" variant="secondary" busy={busca.isFetching} busyLabel="Buscando…" onClick={onBuscar}>
          Buscar pets
        </Button>
      </div>
      {erro ? <ErrorState message={erro} /> : null}
      {busca.error ? (
        <ErrorState message={busca.error instanceof HttpError ? busca.error.message : "Não foi possível buscar o tutor."} />
      ) : null}
      {tutor ? (
        <div className="rounded-2xl border border-line px-4 py-3 dark:border-zinc-700">
          <p className="text-sm font-semibold">{tutor.nome}</p>
          <p className="text-xs text-muted">{tutor.email || "Sem e-mail"}</p>
          {!pets.length ? (
            <p className="mt-2 text-sm text-muted">
              Este tutor ainda não cadastrou pets. O cadastro do animal é feito pelo próprio tutor.
            </p>
          ) : (
            <Field label="Pet">
              <select
                name={petField}
                required
                value={petId}
                onChange={(event) => setPetId(event.target.value)}
                className="w-full min-w-0 rounded-xl border border-line bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="">Selecione o pet</option>
                {pets.map((pet) => (
                  <option key={pet.id} value={pet.id}>
                    {pet.nome}
                    {pet.especie ? ` · ${pet.especie}` : ""}
                    {pet.raca ? ` · ${pet.raca}` : ""}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">Digite o CPF para localizar o tutor e os pets da conta dele.</p>
      )}
      <input type="hidden" name={tutorField} value={tutor?.id ?? ""} />
      {pets.length === 0 ? <input type="hidden" name={petField} value="" /> : null}
    </div>
  );
}
