import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Power, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { ServiceIconPicker } from "../../components/clinic/ServiceIconPicker";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/EmptyState";
import { Field, FormSection, Input, Select, Surface } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { servicosSugeridosPorTipo } from "../../lib/catalog-presets";
import { http, HttpError } from "../../lib/http";
import { resolveServiceIconId, ServiceTypeIcon, type ServiceIconId } from "../../lib/service-icons";
import { useToast } from "../../providers/ToastProvider";

type Servico = {
  id: number;
  nome: string;
  preco: number | null;
  visivelPagina: boolean;
  ativo?: boolean;
  icone?: string | null;
  tipoNome?: string | null;
};
type Tipo = { id: number; nome: string; icone?: string | null };

export function ServicosPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [nomeExibicao, setNomeExibicao] = useState("");
  const [preco, setPreco] = useState("");
  const [iconeServico, setIconeServico] = useState<ServiceIconId>("consulta");
  const [desativarDe, setDesativarDe] = useState<{ servico: Servico; porConflito: boolean } | null>(null);

  const lista = useQuery({ queryKey: ["servicos"], queryFn: () => http<Servico[]>("/api/servicos") });
  const tipos = useQuery({
    queryKey: ["tipos-servico"],
    queryFn: () => http<Tipo[]>("/api/clinica/catalogos/tipos-servico"),
  });

  const tipoSelecionado = useMemo(
    () => (tipos.data ?? []).find((t) => String(t.id) === tipoId) ?? null,
    [tipos.data, tipoId],
  );

  const sugestoes = useMemo(
    () => servicosSugeridosPorTipo(tipoSelecionado?.nome, lista.data ?? []),
    [tipoSelecionado?.nome, lista.data],
  );

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["servicos"] });
    queryClient.invalidateQueries({ queryKey: ["tipos-servico"] });
    queryClient.invalidateQueries({ queryKey: ["agenda"] });
    queryClient.invalidateQueries({ queryKey: ["pagina"] });
  };

  const criar = useMutation({
    mutationFn: async (body: {
      tipoServicoId: number;
      nomeExibicao?: string;
      preco: number;
      visivelPagina: boolean;
      icone: ServiceIconId;
      tipoNome: string;
      iconeAtual?: string | null;
    }) => {
      const iconeAtual = resolveServiceIconId(body.iconeAtual, body.tipoNome);
      if (body.icone !== iconeAtual) {
        await http(`/api/clinica/catalogos/tipos-servico/${body.tipoServicoId}`, {
          method: "PUT",
          json: { nome: body.tipoNome, icone: body.icone },
        });
      }
      return http("/api/servicos", {
        method: "POST",
        json: {
          tipoServicoId: body.tipoServicoId,
          nomeExibicao: body.nomeExibicao,
          preco: body.preco,
          visivelPagina: body.visivelPagina,
        },
      });
    },
    onSuccess: () => {
      invalidar();
      setOpen(false);
      setTipoId("");
      setNomeExibicao("");
      setPreco("");
      setIconeServico("consulta");
      toast.push("Serviço oferecido nesta clínica.");
    },
  });

  const remover = useMutation({
    mutationFn: (id: number) => http(`/api/servicos/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidar();
      toast.push("Serviço excluído.");
    },
  });

  const desativar = useMutation({
    mutationFn: (id: number) => http<Servico>(`/api/servicos/${id}/desativar`, { method: "POST" }),
    onSuccess: () => {
      invalidar();
      setDesativarDe(null);
      toast.push("Serviço desativado na clínica.");
    },
  });

  const reativar = useMutation({
    mutationFn: (id: number) => http<Servico>(`/api/servicos/${id}/reativar`, { method: "POST" }),
    onSuccess: () => {
      invalidar();
      toast.push("Serviço reativado.");
    },
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const valor = Number(preco.replace(",", "."));
      if (!preco.trim() || !Number.isFinite(valor) || valor < 0) {
        setError("Informe um preço válido para o serviço.");
        return;
      }
      if (!tipoId || !tipoSelecionado) {
        setError("Selecione o tipo de serviço.");
        return;
      }
      await criar.mutateAsync({
        tipoServicoId: Number(tipoId),
        nomeExibicao: nomeExibicao.trim() || undefined,
        preco: valor,
        visivelPagina: true,
        icone: iconeServico,
        tipoNome: tipoSelecionado.nome,
        iconeAtual: tipoSelecionado.icone,
      });
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Falha ao oferecer serviço");
    }
  }

  function tentarExcluir(servico: Servico) {
    setError("");
    remover.mutate(servico.id, {
      onError: (err) => {
        if (err instanceof HttpError && err.status === 409) {
          setDesativarDe({ servico, porConflito: true });
          return;
        }
        toast.push(err instanceof HttpError ? err.message : "Não foi possível excluir.", "danger");
      },
    });
  }

  if (lista.isLoading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Serviços"
        description="Ofereça tipos de serviço com nome, ícone e preço desta clínica. Escolha um tipo para ver sugestões comuns."
        actions={<Button onClick={() => setOpen(true)}>+ Oferecer serviço</Button>}
      />
      {!lista.data?.length ? (
        <EmptyState
          title="Nenhum serviço oferecido"
          description="Escolha um tipo do catálogo da clínica e publique na página."
          action={<Button onClick={() => setOpen(true)}>Oferecer</Button>}
        />
      ) : (
        <DataTable
          rows={lista.data}
          exportTitle="Serviços"
          exportColumns={[
            { header: "Nome", value: (row) => row.nome },
            { header: "Preço", value: (row) => row.preco },
            { header: "Ativo", value: (row) => (row.ativo === false ? "Não" : "Sim") },
            { header: "Na página", value: (row) => row.visivelPagina },
          ]}
          columns={[
            {
              key: "nome",
              header: "Serviço",
              cell: (row) => (
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#f3eafc] text-[#7828c8]">
                    <ServiceTypeIcon
                      icone={row.icone}
                      nome={row.tipoNome ?? row.nome}
                      className="size-5 shrink-0"
                    />
                  </span>
                  <div>
                    <span className={`font-medium ${row.ativo === false ? "text-muted line-through" : ""}`}>{row.nome}</span>
                    {row.ativo === false ? <p className="text-xs text-amber-700">Desativado</p> : null}
                  </div>
                </div>
              ),
            },
            {
              key: "preco",
              header: "Preço",
              cell: (row) => (row.preco != null ? `R$ ${Number(row.preco).toFixed(2)}` : "Sem preço"),
            },
            {
              key: "visivel",
              header: "Página",
              cell: (row) => (
                <Badge tone={row.visivelPagina ? "ok" : "neutral"}>{row.visivelPagina ? "Na página" : "Oculto"}</Badge>
              ),
            },
            {
              key: "acoes",
              header: "Ações",
              cell: (row) => (
                <div className="flex flex-wrap gap-2 whitespace-nowrap">
                  {row.ativo === false ? (
                    <Button
                      variant="secondary"
                      disabled={reativar.isPending}
                      onClick={() => reativar.mutate(row.id)}
                    >
                      <Power className="mr-1 inline size-3.5" />
                      Reativar
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      disabled={desativar.isPending}
                      onClick={() => setDesativarDe({ servico: row, porConflito: false })}
                    >
                      Desativar
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    disabled={remover.isPending}
                    onClick={() => tentarExcluir(row)}
                  >
                    <Trash2 className="mr-1 inline size-3.5" />
                    Excluir
                  </Button>
                </div>
              ),
            },
          ]}
          mobile={(row) => (
            <Surface>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`font-semibold ${row.ativo === false ? "text-muted line-through" : ""}`}>{row.nome}</p>
                  {row.ativo === false ? <p className="text-xs text-amber-700">Desativado</p> : null}
                </div>
                <Badge tone={row.visivelPagina ? "ok" : "neutral"}>{row.visivelPagina ? "Na página" : "Oculto"}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted">
                {row.preco != null ? `R$ ${Number(row.preco).toFixed(2)}` : "Sem preço"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {row.ativo === false ? (
                  <Button variant="secondary" onClick={() => reativar.mutate(row.id)}>
                    Reativar
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => setDesativarDe({ servico: row, porConflito: false })}>
                    Desativar
                  </Button>
                )}
                <Button variant="secondary" onClick={() => tentarExcluir(row)}>
                  Excluir
                </Button>
              </div>
            </Surface>
          )}
        />
      )}

      <Modal
        open={open}
        title="Oferecer serviço"
        onClose={() => setOpen(false)}
        wide
        footer={
          <Button type="submit" form="servico-form" busy={criar.isPending} busyLabel="Salvando…">
            Salvar
          </Button>
        }
      >
        <form id="servico-form" onSubmit={onSubmit} className="grid gap-5">
          <FormSection title="Catálogo e exibição">
            <Field label="Tipo de serviço">
              <Select
                name="tipoServicoId"
                required
                value={tipoId}
                onChange={(event) => {
                  const id = event.target.value;
                  setTipoId(id);
                  const tipo = (tipos.data ?? []).find((item) => String(item.id) === id);
                  setNomeExibicao(tipo?.nome ?? "");
                  setIconeServico(resolveServiceIconId(tipo?.icone, tipo?.nome));
                }}
              >
                <option value="">Selecione</option>
                {(tipos.data ?? []).map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nome}
                  </option>
                ))}
              </Select>
            </Field>

            {tipoSelecionado ? (
              <div className="sm:col-span-2">
                <ServiceIconPicker value={iconeServico} onChange={setIconeServico} />
              </div>
            ) : null}

            {sugestoes.length > 0 ? (
              <div className="sm:col-span-2">
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Sugestões para este tipo</p>
                <div className="flex flex-wrap gap-2">
                  {sugestoes.map((nome) => (
                    <button
                      key={nome}
                      type="button"
                      onClick={() => setNomeExibicao(nome)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                        nomeExibicao === nome
                          ? "bg-[#7828c8] text-white"
                          : "bg-[#f3eafc] text-[#5c4d78] hover:bg-[#ebe0fa]"
                      }`}
                    >
                      <Plus className="size-3.5" />
                      {nome}
                    </button>
                  ))}
                </div>
              </div>
            ) : tipoId ? (
              <p className="sm:col-span-2 text-xs text-muted">
                Sem sugestões restantes para este tipo — digite um nome personalizado.
              </p>
            ) : null}

            <Field label="Nome na clínica" hint="Pode usar uma sugestão ou escrever o seu.">
              <Input name="nomeExibicao" value={nomeExibicao} onChange={(e) => setNomeExibicao(e.target.value)} />
            </Field>
            <Field label="Preço" hint="Obrigatório para agendamentos com pagamento.">
              <Input
                name="preco"
                type="number"
                step="0.01"
                min="0"
                required
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
              />
            </Field>
          </FormSection>
          {error ? <ErrorState message={error} /> : null}
        </form>
      </Modal>

      <Modal
        open={!!desativarDe}
        title="Desativar serviço?"
        onClose={() => setDesativarDe(null)}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setDesativarDe(null)} disabled={desativar.isPending}>
              Cancelar
            </Button>
            <Button
              busy={desativar.isPending}
              busyLabel="Desativando…"
              onClick={() => desativarDe && desativar.mutate(desativarDe.servico.id)}
            >
              Sim, desativar
            </Button>
          </div>
        }
      >
        {desativarDe ? (
          <p className="text-sm text-[#4a4258]">
            {desativarDe.porConflito ? (
              <>
                Não é possível excluir esse serviço, pois já temos atendimentos atrelados a ele. Deseja desativar esse
                serviço na sua clínica?
              </>
            ) : (
              <>
                Deseja desativar <strong>{desativarDe.servico.nome}</strong> na sua clínica? Ele deixa de aparecer para
                novos agendamentos, mas o histórico permanece.
              </>
            )}
            {desativarDe.porConflito ? (
              <span className="mt-2 block font-semibold text-[#1f1630]">{desativarDe.servico.nome}</span>
            ) : null}
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
