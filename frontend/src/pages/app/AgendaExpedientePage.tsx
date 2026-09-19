import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/EmptyState";
import { Field, Input, Surface } from "../../components/ui/Field";
import { PageHeader } from "../../components/ui/PageHeader";
import { DIAS_SEMANA } from "../../lib/agenda";
import { HttpError } from "../../lib/http";
import { useToast } from "../../providers/ToastProvider";
import { api, type AgendaFaixa } from "../../services/api";

export function AgendaExpedientePage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [erro, setErro] = useState("");
  const expediente = useQuery({ queryKey: ["agenda-expediente"], queryFn: api.agendaExpediente });
  const feriados = useQuery({ queryKey: ["agenda-feriados"], queryFn: api.agendaFeriados });
  const config = useQuery({ queryKey: ["agenda-config"], queryFn: api.agendaConfig });
  const [faixas, setFaixas] = useState<AgendaFaixa[] | null>(null);
  const visiveis = faixas ?? expediente.data ?? [];

  const salvarExp = useMutation({
    mutationFn: api.saveExpediente,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agenda-expediente"] });
      toast.push("Expediente salvo.");
    },
  });
  const salvarCfg = useMutation({
    mutationFn: api.saveAgendaConfig,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agenda-config"] });
      toast.push("Configuração da agenda salva.");
    },
  });

  if (expediente.isLoading || feriados.isLoading || config.isLoading) {
    return <LoadingState />;
  }

  function addFaixa() {
    setFaixas([...visiveis, { diaSemana: 1, inicio: "08:00", fim: "18:00" }]);
  }

  async function onExpediente(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    try {
      await salvarExp.mutateAsync(
        visiveis.map((item) => ({
          diaSemana: Number(item.diaSemana),
          inicio: item.inicio.length === 5 ? `${item.inicio}:00` : item.inicio,
          fim: item.fim.length === 5 ? `${item.fim}:00` : item.fim,
        })),
      );
    } catch (err) {
      setErro(err instanceof HttpError ? err.message : "Não foi possível salvar o expediente");
    }
  }

  async function onConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const minutos = String(data.get("cancelamento") ?? "");
    setErro("");
    try {
      await salvarCfg.mutateAsync({
        latitude: config.data?.latitude ?? null,
        longitude: config.data?.longitude ?? null,
        cancelamentoAntecedenciaMinutos: minutos ? Number(minutos) : null,
      });
    } catch (err) {
      setErro(err instanceof HttpError ? err.message : "Não foi possível salvar");
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Expediente da clínica"
        description="Grade semanal, feriados e antecedência de cancelamento. A localização da clínica fica em Clínica → Localização."
      />
      {erro ? <ErrorState message={erro} /> : null}

      <form id="agenda-config" onSubmit={(event) => void onConfig(event)}>
        <Surface className="grid gap-3 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Cancelamento pelo tutor</h2>
          <Field label="Cancelar até (minutos antes)" hint="Vazio = o tutor cancela enquanto o horário não passou.">
            <Input
              name="cancelamento"
              type="number"
              min={0}
              defaultValue={config.data?.cancelamentoAntecedenciaMinutos ?? ""}
            />
          </Field>
          <div className="flex flex-wrap items-end gap-2">
            <Button type="submit" busy={salvarCfg.isPending} busyLabel="Salvando…">
              Salvar
            </Button>
          </div>
        </Surface>
      </form>

      <form onSubmit={(event) => void onExpediente(event)}>
        <Surface>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-semibold">Grade semanal</h2>
            <Button type="button" variant="secondary" onClick={addFaixa}>
              + Faixa
            </Button>
          </div>
          {!visiveis.length ? (
            <p className="text-sm text-muted">Nenhuma faixa. Sem isso, vale a grade dos colaboradores.</p>
          ) : (
            <ul className="space-y-3">
              {visiveis.map((faixa, index) => (
                <li key={`${faixa.diaSemana}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_8rem_8rem_auto]">
                  <select
                    className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
                    value={faixa.diaSemana}
                    onChange={(event) => {
                      const next = [...visiveis];
                      next[index] = { ...faixa, diaSemana: Number(event.target.value) };
                      setFaixas(next);
                    }}
                  >
                    {DIAS_SEMANA.map((dia) => (
                      <option key={dia.iso} value={dia.iso}>
                        {dia.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="time"
                    value={faixa.inicio.slice(0, 5)}
                    onChange={(event) => {
                      const next = [...visiveis];
                      next[index] = { ...faixa, inicio: event.target.value };
                      setFaixas(next);
                    }}
                  />
                  <Input
                    type="time"
                    value={faixa.fim.slice(0, 5)}
                    onChange={(event) => {
                      const next = [...visiveis];
                      next[index] = { ...faixa, fim: event.target.value };
                      setFaixas(next);
                    }}
                  />
                  <Button type="button" variant="ghost" onClick={() => setFaixas(visiveis.filter((_, i) => i !== index))}>
                    Remover
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button className="mt-4" type="submit" busy={salvarExp.isPending} busyLabel="Salvando…">
            Salvar expediente
          </Button>
        </Surface>
      </form>

      <FeriadosList />
    </div>
  );
}

function FeriadosList() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const lista = useQuery({ queryKey: ["agenda-feriados"], queryFn: api.agendaFeriados });
  const criar = useMutation({
    mutationFn: api.criarFeriado,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agenda-feriados"] });
      toast.push("Feriado cadastrado.");
    },
  });
  const excluir = useMutation({
    mutationFn: api.excluirFeriado,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agenda-feriados"] });
    },
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const atende = data.get("atende") === "on";
    await criar.mutateAsync({
      data: String(data.get("data")),
      nome: String(data.get("nome")),
      atende,
      inicio: atende ? String(data.get("inicio")) : null,
      fim: atende ? String(data.get("fim")) : null,
    });
    event.currentTarget.reset();
  }

  return (
    <Surface>
      <h2 className="font-semibold">Feriados</h2>
      <form onSubmit={(event) => void onSubmit(event)} className="mt-4 grid gap-2 sm:grid-cols-5">
        <Input name="data" type="date" required />
        <Input name="nome" placeholder="Nome" required />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="atende" /> Atende
        </label>
        <Input name="inicio" type="time" />
        <Input name="fim" type="time" />
        <Button type="submit" className="sm:col-span-5" busy={criar.isPending} busyLabel="Adicionando…">
          Adicionar feriado
        </Button>
      </form>
      {!lista.data?.length ? (
        <div className="mt-4">
          <EmptyState title="Nenhum feriado" description="Dias fechados ou com horário excepcional." />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {lista.data.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                {item.data} · {item.nome} · {item.atende ? `atende ${item.inicio}–${item.fim}` : "fechado"}
              </span>
              <Button
                variant="ghost"
                busy={excluir.isPending}
                busyLabel="Excluindo…"
                onClick={() => item.id && excluir.mutate(item.id)}
              >
                Excluir
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}
