import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../ui/Button";
import { Field, Input, Select } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { http, HttpError } from "../../lib/http";
import { api } from "../../services/api";

type CatalogItem = { id: number; nome: string };
type Servico = { id: number; nome: string };

export type WalkInTipo = "ATENDIMENTO" | "VACINACAO";

type Props = {
  open: boolean;
  tipoFixo: WalkInTipo;
  onClose: () => void;
  onSuccess?: () => void;
};

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function WalkInRegistroModal({ open, tipoFixo, onClose, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [especieId, setEspecieId] = useState("");

  const especies = useQuery({
    queryKey: ["catalogos", "especies"],
    queryFn: () => http<CatalogItem[]>("/api/catalogos/especies"),
    enabled: open,
  });
  const racas = useQuery({
    queryKey: ["catalogos", "racas", especieId],
    queryFn: () => http<CatalogItem[]>(`/api/catalogos/racas?especieId=${especieId}`),
    enabled: open && Boolean(especieId),
  });
  const vacinas = useQuery({
    queryKey: ["vacinas"],
    queryFn: () => http<CatalogItem[]>("/api/catalogos/vacinas"),
    enabled: open && tipoFixo === "VACINACAO",
  });
  const servicos = useQuery({
    queryKey: ["servicos"],
    queryFn: () => http<Servico[]>("/api/servicos"),
    enabled: open && tipoFixo === "ATENDIMENTO",
  });

  const salvar = useMutation({
    mutationFn: api.registrarWalkIn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["vacinacoes"] }),
        queryClient.invalidateQueries({ queryKey: ["pets"] }),
        queryClient.invalidateQueries({ queryKey: ["atendimentos"] }),
        queryClient.invalidateQueries({ queryKey: ["agenda-solicitacoes"] }),
      ]);
      onSuccess?.();
      onClose();
    },
  });

  useEffect(() => {
    if (!open) {
      setError("");
      setEspecieId("");
    }
  }, [open]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    try {
      await salvar.mutateAsync({
        tipo: tipoFixo,
        cpf: String(data.get("cpf") || ""),
        nomeTutor: String(data.get("nomeTutor") || ""),
        telefone: String(data.get("telefone") || "") || undefined,
        email: String(data.get("email") || "") || undefined,
        nomePet: String(data.get("nomePet") || ""),
        especieId: Number(data.get("especieId")),
        racaId: data.get("racaId") ? Number(data.get("racaId")) : undefined,
        sexo: String(data.get("sexo") || "I"),
        peso: data.get("peso") ? Number(data.get("peso")) : undefined,
        dataAniversario: String(data.get("dataAniversario") || "") || undefined,
        servicoId: data.get("servicoId") ? Number(data.get("servicoId")) : undefined,
        resumo: String(data.get("resumo") || "") || undefined,
        detalhes: String(data.get("detalhes") || "") || undefined,
        data: String(data.get("data") || "") || undefined,
        vacinaId: data.get("vacinaId") ? Number(data.get("vacinaId")) : undefined,
        dataAplicacao: String(data.get("dataAplicacao") || "") || undefined,
        dataProximaDose: String(data.get("dataProximaDose") || "") || undefined,
        lote: String(data.get("lote") || "") || undefined,
        observacoes: String(data.get("observacoes") || "") || undefined,
      });
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Não foi possível salvar o registro.");
    }
  }

  const titulo = tipoFixo === "VACINACAO" ? "Vacina sem cadastro" : "Atendimento sem cadastro";

  return (
    <Modal
      open={open}
      title={titulo}
      onClose={onClose}
      wide
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={salvar.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="walk-in-form" busy={salvar.isPending} busyLabel="Salvando…">
            Salvar registro
          </Button>
        </div>
      }
    >
      <p className="mb-4 text-sm text-muted">
        Para clientes que chegaram sem conta no Flutz. Informe CPF e nome do tutor, dados do pet e o que foi
        realizado. Se o tutor criar conta depois com o mesmo CPF, o histórico poderá ser incorporado.
      </p>
      <form id="walk-in-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="CPF do tutor">
          <Input name="cpf" required autoComplete="off" />
        </Field>
        <Field label="Nome do tutor">
          <Input name="nomeTutor" required />
        </Field>
        <Field label="Telefone">
          <Input name="telefone" />
        </Field>
        <Field label="E-mail">
          <Input name="email" type="email" />
        </Field>

        <Field label="Nome do pet">
          <Input name="nomePet" required />
        </Field>
        <Field label="Espécie">
          <Select name="especieId" required value={especieId} onChange={(e) => setEspecieId(e.target.value)}>
            <option value="">Selecione</option>
            {(especies.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Raça">
          <Select name="racaId" disabled={!especieId}>
            <option value="">Opcional</option>
            {(racas.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Sexo">
          <Select name="sexo" defaultValue="I">
            <option value="I">Indefinido</option>
            <option value="M">Macho</option>
            <option value="F">Fêmea</option>
          </Select>
        </Field>
        <Field label="Peso (kg)">
          <Input name="peso" type="number" step="0.1" min="0" />
        </Field>
        <Field label="Nascimento">
          <Input name="dataAniversario" type="date" />
        </Field>

        {tipoFixo === "ATENDIMENTO" ? (
          <>
            <Field label="Serviço">
              <Select name="servicoId">
                <option value="">Opcional</option>
                {(servicos.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Data">
              <Input name="data" type="date" defaultValue={todayIso()} />
            </Field>
            <Field label="Resumo / queixa">
              <Input name="resumo" placeholder="Ex.: consulta de rotina, otite…" />
            </Field>
            <Field label="Detalhes internos">
              <Input name="detalhes" placeholder="Observações da equipe" />
            </Field>
          </>
        ) : (
          <>
            <Field label="Vacina">
              <Select name="vacinaId" required>
                <option value="">Selecione</option>
                {(vacinas.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Aplicação">
              <Input name="dataAplicacao" type="date" required defaultValue={todayIso()} />
            </Field>
            <Field label="Próxima dose">
              <Input name="dataProximaDose" type="date" />
            </Field>
            <Field label="Lote">
              <Input name="lote" />
            </Field>
            <Field label="Observações">
              <Input name="observacoes" />
            </Field>
          </>
        )}

        {error ? <p className="sm:col-span-2 text-sm text-danger">{error}</p> : null}
      </form>
    </Modal>
  );
}
