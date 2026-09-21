import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { PageHeader } from "../../components/ui/PageHeader";
import { presetsDisponiveis, racasSugeridas, type CatalogPreset } from "../../lib/catalog-presets";
import { http, HttpError } from "../../lib/http";
import {
  SPECIES_ICON_PALETTE,
  SpeciesIcon,
  resolveSpeciesIconId,
  type SpeciesIconId,
} from "../../lib/species-icons";
import { useToast } from "../../providers/ToastProvider";
import { api } from "../../services/api";

const TIPOS = [
  { id: "especies", label: "Espécies" },
  { id: "racas", label: "Raças" },
  { id: "vacinas", label: "Vacinas" },
  { id: "doencas", label: "Doenças" },
  { id: "especialidades", label: "Especialidades" },
] as const;

type Item = {
  id: number;
  nome: string;
  daClinica?: boolean;
  icone?: string | null;
  ativo?: boolean | null;
};

export function ClinicCatalogosPage() {
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]["id"]>("especies");
  const [nome, setNome] = useState("");
  const [icone, setIcone] = useState<SpeciesIconId>("cao");
  const [especieId, setEspecieId] = useState<number | undefined>();
  const [editando, setEditando] = useState<Item | null>(null);
  const [error, setError] = useState("");
  const toast = useToast();
  const queryClient = useQueryClient();

  const especies = useQuery({
    queryKey: ["clinica", "catalogos", "especies"],
    queryFn: () => http<Item[]>("/api/clinica/catalogos/especies"),
  });
  const lista = useQuery({
    queryKey: ["clinica", "catalogos", tipo],
    queryFn: () => http<Item[]>(`/api/clinica/catalogos/${tipo}`),
  });
  const racasDaEspecie = useQuery({
    queryKey: ["clinica", "catalogos", "racas", especieId],
    queryFn: () => http<Item[]>(`/api/clinica/catalogos/racas?especieId=${especieId}`),
    enabled: tipo === "racas" && especieId != null,
  });

  const sugestoes = useMemo((): CatalogPreset[] => {
    if (tipo === "racas") {
      if (!especieId) return [];
      const especie = (especies.data ?? []).find((item) => item.id === especieId);
      return racasSugeridas(especie?.nome, racasDaEspecie.data ?? []).map((nome) => ({ nome }));
    }
    return presetsDisponiveis(tipo, lista.data ?? []);
  }, [tipo, lista.data, especieId, especies.data, racasDaEspecie.data]);

  useEffect(() => {
    setNome("");
    setIcone("cao");
    setEspecieId(undefined);
    setEditando(null);
    setError("");
  }, [tipo]);

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["clinica", "catalogos", tipo] });
    queryClient.invalidateQueries({ queryKey: ["clinica", "catalogos", "racas"] });
    queryClient.invalidateQueries({ queryKey: ["clinica", "catalogos", "especies"] });
    queryClient.invalidateQueries({ queryKey: ["catalogos"] });
    queryClient.invalidateQueries({ queryKey: ["especies"] });
    queryClient.invalidateQueries({ queryKey: ["racas"] });
    queryClient.invalidateQueries({ queryKey: ["vacinas"] });
    queryClient.invalidateQueries({ queryKey: ["agenda-vacinas"] });
  };

  const criarItem = async (preset: CatalogPreset) => {
    if (tipo === "especies") {
      return http<Item>(`/api/clinica/catalogos/${tipo}`, {
        method: "POST",
        json: { nome: preset.nome, icone: preset.icone ?? "outro" },
      });
    }
    if (tipo === "racas") {
      if (!especieId) {
        throw new HttpError(400, "BAD_REQUEST", "Selecione a espécie antes de adicionar a raça.");
      }
      return http<Item>(`/api/clinica/catalogos/${tipo}`, {
        method: "POST",
        json: { nome: preset.nome, especieId },
      });
    }
    return http<Item>(`/api/clinica/catalogos/${tipo}`, {
      method: "POST",
      json: { nome: preset.nome },
    });
  };

  const salvar = useMutation({
    mutationFn: async () => {
      const body = tipo === "especies" ? { nome, especieId, icone } : { nome, especieId };
      if (editando) {
        return http<Item>(`/api/clinica/catalogos/${tipo}/${editando.id}`, {
          method: "PUT",
          json: body,
        });
      }
      return http<Item>(`/api/clinica/catalogos/${tipo}`, {
        method: "POST",
        json: body,
      });
    },
    onSuccess: () => {
      setNome("");
      setIcone("cao");
      setEditando(null);
      setError("");
      toast.push(editando ? "Item atualizado." : "Item cadastrado para esta clínica.");
      invalidar();
    },
  });

  const adicionarSugestao = useMutation({
    mutationFn: (preset: CatalogPreset) => criarItem(preset),
    onSuccess: (_data, preset) => {
      toast.push(`${preset.nome} adicionado.`);
      invalidar();
    },
  });

  const adicionarTodas = useMutation({
    mutationFn: async (presets: CatalogPreset[]) => {
      let ok = 0;
      for (const preset of presets) {
        try {
          await criarItem(preset);
          ok += 1;
        } catch {
          /* já existe ou conflito pontual — segue */
        }
      }
      return ok;
    },
    onSuccess: (ok) => {
      toast.push(ok > 0 ? `${ok} item(ns) adicionado(s).` : "Nada novo para adicionar.");
      invalidar();
    },
  });

  const remover = useMutation({
    mutationFn: (id: number) => http(`/api/clinica/catalogos/${tipo}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.push("Item removido.");
      invalidar();
    },
  });

  const alternarAtivo = useMutation({
    mutationFn: ({ id, ativo }: { id: number; ativo: boolean }) =>
      http<Item>(`/api/clinica/catalogos/especies/${id}/ativo`, {
        method: "POST",
        json: { ativo },
      }),
    onSuccess: (_data, vars) => {
      toast.push(vars.ativo ? "Espécie reativada." : "Espécie desativada.");
      invalidar();
    },
  });

  const iniciarEdicao = (item: Item) => {
    setEditando(item);
    setNome(item.nome.includes(" · ") ? item.nome.split(" · ").slice(1).join(" · ") : item.nome);
    if (tipo === "especies") {
      setIcone(resolveSpeciesIconId(item.icone, item.nome));
    }
    setError("");
  };

  const cancelarEdicao = () => {
    setEditando(null);
    setNome("");
    setIcone("cao");
    setError("");
  };

  const ofertaVacina = useMutation({
    mutationFn: ({ id, oferecer }: { id: number; oferecer: boolean }) => api.ofertaVacinaClinica(id, oferecer),
    onSuccess: (_data, vars) => {
      toast.push(vars.oferecer ? "Vacina ativada na clínica." : "Vacina removida da oferta da clínica.");
      invalidar();
    },
  });

  const busySugestao = adicionarSugestao.isPending || adicionarTodas.isPending;

  if (tipo === "vacinas") {
    const oferecidas = (lista.data ?? []).filter((item) => item.daClinica).length;
    return (
      <div>
        <PageHeader
          eyebrow="Clínica"
          title="Catálogos da clínica"
          description="Vacinas vêm do catálogo Flutz. Ative as que sua clínica oferece e defina o preço em Vacinação."
        />
        <div className="mb-5 flex min-w-0 flex-wrap gap-2">
          {TIPOS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTipo(item.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tipo === item.id ? "bg-brand text-white" : "bg-white ring-1 ring-line dark:bg-zinc-900"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="mb-4 text-sm text-muted">
          {lista.isLoading
            ? "Carregando catálogo…"
            : `${oferecidas} de ${(lista.data ?? []).length} vacinas ativas nesta clínica.`}
        </p>
        {error ? <ErrorState message={error} /> : null}
        {!lista.data?.length && !lista.isLoading ? (
          <EmptyState
            title="Nenhuma vacina no catálogo"
            description="Peça ao administrador Flutz para cadastrar vacinas em Admin → Catálogos."
          />
        ) : (
          <ul className="living-card divide-y divide-line dark:divide-zinc-800">
            {(lista.data ?? []).map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-[#1f1630]">{item.nome}</p>
                  <p className="text-xs text-muted">{item.daClinica ? "Oferecida pela clínica" : "Não oferecida"}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!item.daClinica}
                  disabled={ofertaVacina.isPending}
                  onClick={() => {
                    setError("");
                    ofertaVacina.mutate(
                      { id: item.id, oferecer: !item.daClinica },
                      {
                        onError: (err) =>
                          setError(err instanceof HttpError ? err.message : "Não foi possível atualizar."),
                      },
                    );
                  }}
                  className={`relative h-8 w-14 rounded-full transition ${
                    item.daClinica ? "bg-[#7828c8]" : "bg-[#d8cce8]"
                  } disabled:opacity-50`}
                >
                  <span
                    className={`absolute top-1 size-6 rounded-full bg-white shadow transition ${
                      item.daClinica ? "left-7" : "left-1"
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-muted">
          Depois de ativar, defina o preço em{" "}
          <a href="/app/vacinacao" className="font-semibold text-brand hover:underline">
            Vacinação
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Clínica"
        title="Catálogos da clínica"
        description="Use as sugestões prontas para montar o básico rápido, ou cadastre itens manuais conforme a necessidade da clínica."
      />
      <div className="mb-5 flex min-w-0 flex-wrap gap-2">
        {TIPOS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTipo(item.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tipo === item.id ? "bg-brand text-white" : "bg-white ring-1 ring-line dark:bg-zinc-900"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tipo === "racas" && !editando ? (
        <section className="living-card mb-6 space-y-3 p-4">
          <div>
            <h2 className="text-sm font-bold text-[#1f1630]">Sugestões de raças</h2>
            <p className="mt-1 text-xs text-muted">Escolha a espécie para ver raças comuns sugeridas.</p>
          </div>
          <select
            className="max-w-md rounded-2xl border border-line px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            value={especieId ?? ""}
            onChange={(event) => setEspecieId(Number(event.target.value) || undefined)}
          >
            <option value="">Espécie</option>
            {(especies.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
          {especieId && sugestoes.length === 0 ? (
            <p className="text-xs text-muted">Todas as sugestões desta espécie já estão cadastradas.</p>
          ) : null}
          {sugestoes.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted">Clique para adicionar.</p>
                <Button
                  type="button"
                  variant="secondary"
                  busy={adicionarTodas.isPending}
                  busyLabel="Adicionando…"
                  disabled={busySugestao}
                  onClick={() => {
                    setError("");
                    adicionarTodas.mutate(sugestoes, {
                      onError: (err) =>
                        setError(err instanceof HttpError ? err.message : "Não foi possível adicionar as sugestões."),
                    });
                  }}
                >
                  Adicionar todas ({sugestoes.length})
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {sugestoes.map((preset) => (
                  <button
                    key={preset.nome}
                    type="button"
                    disabled={busySugestao}
                    onClick={() => {
                      setError("");
                      adicionarSugestao.mutate(preset, {
                        onError: (err) =>
                          setError(err instanceof HttpError ? err.message : "Não foi possível adicionar."),
                      });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#f3eafc] px-3 py-1.5 text-sm font-semibold text-[#5c4d78] transition hover:bg-[#ebe0fa] disabled:opacity-50"
                  >
                    <Plus className="size-3.5" />
                    {preset.nome}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {tipo !== "racas" && sugestoes.length > 0 && !editando ? (
        <section className="living-card mb-6 space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-[#1f1630]">Sugestões prontas</h2>
              <p className="text-xs text-muted">Clique para adicionar à clínica. O que já existe some desta lista.</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              busy={adicionarTodas.isPending}
              busyLabel="Adicionando…"
              disabled={busySugestao}
              onClick={() => {
                setError("");
                adicionarTodas.mutate(sugestoes, {
                  onError: (err) =>
                    setError(err instanceof HttpError ? err.message : "Não foi possível adicionar as sugestões."),
                });
              }}
            >
              Adicionar todas ({sugestoes.length})
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {sugestoes.map((preset) => (
              <button
                key={preset.nome}
                type="button"
                disabled={busySugestao}
                onClick={() => {
                  setError("");
                  adicionarSugestao.mutate(preset, {
                    onError: (err) =>
                      setError(err instanceof HttpError ? err.message : "Não foi possível adicionar."),
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#f3eafc] px-3 py-1.5 text-sm font-semibold text-[#5c4d78] transition hover:bg-[#ebe0fa] disabled:opacity-50"
              >
                {tipo === "especies" && preset.icone ? (
                  <SpeciesIcon icone={preset.icone} className="size-4" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                {preset.nome}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <form
        className="living-card mb-6 space-y-4 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          salvar.mutate(undefined, {
            onError: (err) => setError(err instanceof HttpError ? err.message : "Não foi possível salvar."),
          });
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-[#1f1630]">
            {editando
              ? `Editar ${TIPOS.find((t) => t.id === tipo)?.label.toLowerCase()}`
              : "Cadastro manual"}
          </h2>
          {editando ? (
            <button type="button" className="text-sm font-semibold text-muted hover:text-brand" onClick={cancelarEdicao}>
              Cancelar edição
            </button>
          ) : null}
        </div>

        {tipo === "especies" ? (
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Escolha o animal</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
              {SPECIES_ICON_PALETTE.map((opt) => {
                const selected = icone === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    title={opt.label}
                    onClick={() => {
                      setIcone(opt.id);
                      if (!editando && (!nome.trim() || SPECIES_ICON_PALETTE.some((p) => p.nomeSugerido === nome))) {
                        setNome(opt.nomeSugerido);
                      }
                    }}
                    className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-center transition ${
                      selected
                        ? "bg-[#7828c8] text-white shadow-sm"
                        : "bg-[#f7f1fc] text-[#5c4d78] hover:bg-[#ebe0fa]"
                    }`}
                  >
                    <SpeciesIcon icone={opt.id} className="size-6" />
                    <span className="line-clamp-1 text-[10px] font-semibold leading-tight">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
          {tipo === "racas" ? (
            <select
              className="rounded-2xl border border-line px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              value={especieId ?? ""}
              onChange={(event) => setEspecieId(Number(event.target.value) || undefined)}
              required={!editando}
              disabled={!!editando}
            >
              <option value="">Espécie</option>
              {(especies.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          ) : null}
          <input
            required
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            placeholder={tipo === "especies" ? "Nome da espécie" : "Nome personalizado"}
            className="min-w-0 flex-1 rounded-2xl border border-line px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <Button type="submit" busy={salvar.isPending} busyLabel="Salvando…">
            {editando ? "Salvar" : "Adicionar"}
          </Button>
        </div>
      </form>

      {error ? <ErrorState message={error} /> : null}

      {!lista.data?.length ? (
        <EmptyState
          title="Nada cadastrado ainda"
          description="Use as sugestões prontas acima ou inclua o primeiro item manualmente."
        />
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <ExportMenu
              filename={`catalogo-${tipo}`}
              title="Catálogo da clínica"
              columns={
                tipo === "especies"
                  ? [
                      { header: "Nome", value: (row: Item) => row.nome },
                      { header: "Ícone", value: (row: Item) => row.icone ?? "" },
                      { header: "Ativo", value: (row: Item) => (row.ativo === false ? "Não" : "Sim") },
                    ]
                  : [{ header: "Nome", value: (row: Item) => row.nome }]
              }
              rows={lista.data}
            />
          </div>
          <ul className="living-card divide-y divide-line dark:divide-zinc-800">
            {lista.data.map((item) => {
              const inativo = tipo === "especies" && item.ativo === false;
              return (
                <li
                  key={item.id}
                  className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${inativo ? "opacity-55" : ""}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {tipo === "especies" ? (
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#f3eafc] text-[#7828c8]">
                        <SpeciesIcon icone={item.icone} nome={item.nome} className="size-5" />
                      </span>
                    ) : null}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#1f1630]">{item.nome}</p>
                      <p className="text-xs text-muted">
                        {item.daClinica ? "Da clínica" : "Plataforma"}
                        {inativo ? " · Desativada" : ""}
                      </p>
                    </div>
                  </div>
                  {item.daClinica || tipo === "racas" ? (
                    <div className="flex flex-wrap gap-2">
                      {item.daClinica ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-xl border border-line bg-white px-3 py-1.5 text-sm font-semibold text-[#5c4d78] hover:bg-[#f7f1fc]"
                          onClick={() => iniciarEdicao(item)}
                        >
                          <Pencil className="size-3.5" />
                          Editar
                        </button>
                      ) : null}
                      {tipo === "especies" && item.daClinica ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-xl border border-line bg-white px-3 py-1.5 text-sm font-semibold text-[#5c4d78] hover:bg-[#f7f1fc] disabled:opacity-50"
                          disabled={alternarAtivo.isPending}
                          onClick={() => {
                            setError("");
                            alternarAtivo.mutate(
                              { id: item.id, ativo: item.ativo === false },
                              {
                                onError: (err) =>
                                  setError(err instanceof HttpError ? err.message : "Não foi possível alterar o status."),
                              },
                            );
                          }}
                        >
                          <Power className="size-3.5" />
                          {item.ativo === false ? "Reativar" : "Desativar"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-xl border border-red-500 bg-transparent px-3 py-1.5 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
                        disabled={remover.isPending}
                        onClick={() => {
                          setError("");
                          remover.mutate(item.id, {
                            onError: (err) =>
                              setError(err instanceof HttpError ? err.message : "Não foi possível remover."),
                          });
                        }}
                      >
                        <Trash2 className="size-3.5" />
                        Remover
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
