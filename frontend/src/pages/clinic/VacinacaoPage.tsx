import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PetPhoto } from "../../components/clinic/PanelHero";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/EmptyState";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { Field, Input, Select } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { http, HttpError } from "../../lib/http";
import { api, type VacinaGestao, type VaccinationRow } from "../../services/api";
import { useToast } from "../../providers/ToastProvider";

type Pet = { id: number; nome: string; fotoUrl?: string | null; especie?: string };
type Item = { id: number; nome: string };
type StatusProxima = "todas" | "atrasada" | "proxima" | "ok";

type PetVacinaGroup = {
  petId: number;
  pet: string;
  fotoUrl?: string | null;
  especie?: string | null;
  doses: VaccinationRow[];
  ultimaAplicacao: string | null;
  proximaDose: string | null;
};

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR");
}

function daysUntil(value: string | null | undefined): number | null {
  const d = parseDate(value);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function statusProxima(value: string | null | undefined): "atrasada" | "proxima" | "ok" | "sem" {
  const days = daysUntil(value);
  if (days == null) return "sem";
  if (days < 0) return "atrasada";
  if (days <= 7) return "proxima";
  return "ok";
}

function groupByPet(rows: VaccinationRow[]): PetVacinaGroup[] {
  const map = new Map<number, PetVacinaGroup>();
  for (const row of rows) {
    const existing = map.get(row.petId);
    if (existing) {
      existing.doses.push(row);
    } else {
      map.set(row.petId, {
        petId: row.petId,
        pet: row.pet,
        fotoUrl: row.fotoUrl,
        especie: row.especie,
        doses: [row],
        ultimaAplicacao: null,
        proximaDose: null,
      });
    }
  }
  for (const group of map.values()) {
    group.doses.sort((a, b) => {
      const da = parseDate(a.aplicacao)?.getTime() ?? 0;
      const db = parseDate(b.aplicacao)?.getTime() ?? 0;
      return db - da;
    });
    group.ultimaAplicacao = group.doses[0]?.aplicacao ?? null;
    const proximas = group.doses
      .map((d) => d.proxima)
      .filter((v): v is string => Boolean(v))
      .sort((a, b) => (parseDate(a)?.getTime() ?? 0) - (parseDate(b)?.getTime() ?? 0));
    group.proximaDose = proximas[0] ?? null;
  }
  return [...map.values()].sort((a, b) => a.pet.localeCompare(b.pet, "pt-BR"));
}

export function VacinacaoPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const lista = useQuery({ queryKey: ["vacinacoes"], queryFn: api.vaccinations });
  const pets = useQuery({ queryKey: ["pets"], queryFn: () => http<Pet[]>("/api/pets") });
  const vacinas = useQuery({ queryKey: ["vacinas"], queryFn: () => http<Item[]>("/api/catalogos/vacinas") });
  const criar = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.createVaccination(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vacinacoes"] }),
  });

  const [qPet, setQPet] = useState("");
  const [especie, setEspecie] = useState("todas");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [vacinaNome, setVacinaNome] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<StatusProxima>("todas");
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    try {
      await criar.mutateAsync({
        petId: Number(data.get("petId")),
        vacinaId: Number(data.get("vacinaId")),
        dataAplicacao: String(data.get("dataAplicacao")),
        dataProximaDose: String(data.get("dataProximaDose") || ""),
        lote: String(data.get("lote") || ""),
      });
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Não foi possível registrar a aplicação");
    }
  }

  const groups = useMemo(() => groupByPet(lista.data ?? []), [lista.data]);

  const especies = useMemo(() => {
    const set = new Set<string>();
    for (const g of groups) {
      if (g.especie?.trim()) set.add(g.especie.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [groups]);

  const filtered = useMemo(() => {
    const petTerm = qPet.trim().toLowerCase();
    const vacTerm = vacinaNome.trim().toLowerCase();
    const deDate = parseDate(de);
    const ateDate = parseDate(ate);
    return groups.filter((group) => {
      if (petTerm && !group.pet.toLowerCase().includes(petTerm)) return false;
      if (especie !== "todas" && (group.especie ?? "") !== especie) return false;
      if (statusFiltro !== "todas") {
        const st = statusProxima(group.proximaDose);
        if (st !== statusFiltro) return false;
      }
      const matchingDoses = group.doses.filter((dose) => {
        if (vacTerm && !dose.vacina.toLowerCase().includes(vacTerm)) return false;
        const aplic = parseDate(dose.aplicacao);
        if (deDate && aplic && aplic < deDate) return false;
        if (ateDate && aplic && aplic > ateDate) return false;
        return true;
      });
      if ((vacTerm || de || ate) && !matchingDoses.length) return false;
      return true;
    });
  }, [groups, qPet, especie, statusFiltro, vacinaNome, de, ate]);

  const selected = filtered.find((g) => g.petId === selectedPetId) ?? groups.find((g) => g.petId === selectedPetId) ?? null;
  const exportRows = useMemo(() => {
    const vacinaTermo = vacinaNome.trim().toLowerCase();
    const inicio = parseDate(de);
    const fim = parseDate(ate);
    return filtered.flatMap((group) =>
      group.doses
        .filter((dose) => {
          if (vacinaTermo && !dose.vacina.toLowerCase().includes(vacinaTermo)) return false;
          const aplicacao = parseDate(dose.aplicacao);
          if (inicio && aplicacao && aplicacao < inicio) return false;
          if (fim && aplicacao && aplicacao > fim) return false;
          return true;
        })
        .map((dose) => ({ ...dose, especie: group.especie })),
    );
  }, [filtered, vacinaNome, de, ate]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Saúde"
        title="Vacinação"
        description="Registre as doses aplicadas. Cadastre vacinas novas em Catálogos da clínica."
      />
      <PrecosVacinasAgenda />
      <form onSubmit={onSubmit} className="living-card grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
        <select name="petId" required className="rounded-xl border border-line px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950">
          <option value="">Pet</option>
          {(pets.data ?? []).map((pet) => (
            <option key={pet.id} value={pet.id}>
              {pet.nome}
            </option>
          ))}
        </select>
        <select name="vacinaId" required className="rounded-xl border border-line px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950">
          <option value="">Vacina do catálogo</option>
          {(vacinas.data ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.nome}
            </option>
          ))}
        </select>
        <input
          name="dataAplicacao"
          type="date"
          required
          className="rounded-xl border border-line px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          name="dataProximaDose"
          type="date"
          className="rounded-xl border border-line px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          name="lote"
          placeholder="Lote"
          className="rounded-xl border border-line px-3 py-2 sm:col-span-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
        {error ? <ErrorState message={error} /> : null}
        <Button type="submit" busy={criar.isPending} busyLabel="Registrando…" disabled={!vacinas.data?.length}>
          Registrar aplicação
        </Button>
      </form>
      {!vacinas.data?.length ? (
        <p className="text-sm text-muted">
          Nenhuma vacina cadastrada ainda. Inclua as vacinas desta clínica em{" "}
          <Link to="/app/catalogos" className="font-medium text-brand hover:underline">
            Catálogos
          </Link>
          .
        </p>
      ) : null}

      {lista.isLoading ? (
        <LoadingState label="Carregando vacinações…" />
      ) : !groups.length ? (
        <EmptyState
          title="Nenhuma vacinação registrada"
          description="Quando a equipe aplicar uma dose, o histórico e os atrasos aparecem no painel."
        />
      ) : (
        <section className="space-y-4">
          <div className="living-card grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
            <Field label="Pet">
              <Input value={qPet} onChange={(e) => setQPet(e.target.value)} placeholder="Buscar pelo nome" />
            </Field>
            <Field label="Espécie">
              <Select value={especie} onChange={(e) => setEspecie(e.target.value)}>
                <option value="todas">Todas</option>
                {especies.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Aplicação de">
              <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
            </Field>
            <Field label="Aplicação até">
              <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
            </Field>
            <Field label="Vacina">
              <Input value={vacinaNome} onChange={(e) => setVacinaNome(e.target.value)} placeholder="Nome da vacina" />
            </Field>
            <Field label="Status da próxima">
              <Select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value as StatusProxima)}>
                <option value="todas">Todas</option>
                <option value="atrasada">Atrasada</option>
                <option value="proxima">Próxima (7 dias)</option>
                <option value="ok">Em dia</option>
              </Select>
            </Field>
            <div className="flex items-end xl:col-span-4 xl:justify-end">
              <ExportMenu
                filename="vacinacao"
                title="Vacinação"
                rows={exportRows}
                columns={[
                  { header: "Pet", value: (row) => row.pet },
                  { header: "Espécie", value: (row) => row.especie ?? "—" },
                  { header: "Vacina", value: (row) => row.vacina },
                  { header: "Aplicação", value: (row) => formatDate(row.aplicacao) },
                  { header: "Próxima", value: (row) => formatDate(row.proxima) },
                  { header: "Lote", value: (row) => row.lote ?? "—" },
                  {
                    header: "Status",
                    value: (row) => {
                      const status = statusProxima(row.proxima);
                      return status === "atrasada" ? "Atrasada" : status === "proxima" ? "Próxima" : status === "ok" ? "Em dia" : "Sem próxima dose";
                    },
                  },
                ]}
              />
            </div>
          </div>

          {!filtered.length ? (
            <EmptyState title="Nenhum pet encontrado" description="Ajuste os filtros para ver o histórico de vacinas." />
          ) : (
            <div className="living-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[48rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-[11px] tracking-wide text-muted uppercase dark:border-zinc-800">
                      <th className="px-4 py-3 font-semibold">Foto</th>
                      <th className="px-4 py-3 font-semibold">Pet</th>
                      <th className="px-4 py-3 font-semibold">Espécie</th>
                      <th className="px-4 py-3 font-semibold">Doses</th>
                      <th className="px-4 py-3 font-semibold">Última aplicação</th>
                      <th className="px-4 py-3 font-semibold">Próxima dose</th>
                      <th className="px-4 py-3 font-semibold"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((group) => {
                      const st = statusProxima(group.proximaDose);
                      return (
                        <tr key={group.petId} className="border-b border-line/70 last:border-0 dark:border-zinc-800">
                          <td className="px-4 py-3">
                            <PetPhoto
                              seed={group.petId}
                              src={group.fotoUrl}
                              especie={group.especie}
                              className="size-11 rounded-2xl"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Link to={`/app/pets/${group.petId}`} className="font-medium hover:text-brand">
                              {group.pet}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-muted">{group.especie ?? "—"}</td>
                          <td className="px-4 py-3 font-semibold">{group.doses.length}</td>
                          <td className="px-4 py-3">{formatDate(group.ultimaAplicacao)}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span>{formatDate(group.proximaDose)}</span>
                              {st === "atrasada" ? <Badge tone="danger">Atrasada</Badge> : null}
                              {st === "proxima" ? <Badge tone="warn">Próxima</Badge> : null}
                              {st === "ok" ? <Badge tone="ok">Em dia</Badge> : null}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Button type="button" variant="secondary" onClick={() => setSelectedPetId(group.petId)}>
                              Visualizar Vacinas
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      <Modal
        open={selected != null}
        title={selected ? `Vacinas de ${selected.pet}` : "Vacinas"}
        onClose={() => setSelectedPetId(null)}
        wide
      >
        {selected ? (
          <ul className="space-y-3">
            {selected.doses.map((dose) => (
              <li key={dose.id} className="rounded-2xl border border-line p-4 dark:border-zinc-800">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink dark:text-white">{dose.vacina}</p>
                    <p className="mt-1 text-sm text-muted">
                      Aplicação {formatDate(dose.aplicacao)}
                      {dose.proxima ? ` · próxima ${formatDate(dose.proxima)}` : ""}
                      {dose.lote ? ` · lote ${dose.lote}` : ""}
                    </p>
                  </div>
                  {dose.proxima ? (
                    <Badge
                      tone={
                        statusProxima(dose.proxima) === "atrasada"
                          ? "danger"
                          : statusProxima(dose.proxima) === "proxima"
                            ? "warn"
                            : "ok"
                      }
                    >
                      {statusProxima(dose.proxima) === "atrasada"
                        ? "Atrasada"
                        : statusProxima(dose.proxima) === "proxima"
                          ? "Próxima"
                          : "Em dia"}
                    </Badge>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Modal>
    </div>
  );
}

function PrecosVacinasAgenda() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [precos, setPrecos] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const gestao = useQuery({ queryKey: ["agenda", "vacinas-gestao"], queryFn: api.agendaVacinasGestao });

  useEffect(() => {
    if (!gestao.data) return;
    const next: Record<number, string> = {};
    for (const item of gestao.data) {
      next[item.id] = item.preco != null ? String(item.preco) : "";
    }
    setPrecos(next);
  }, [gestao.data]);

  async function salvar(item: VacinaGestao) {
    const raw = (precos[item.id] ?? "").trim().replace(",", ".");
    const preco = Number(raw);
    if (!raw || !Number.isFinite(preco) || preco < 0) {
      setError(`Informe um preço válido para ${item.nome}.`);
      return;
    }
    setSavingId(item.id);
    setError("");
    try {
      await api.agendaPrecoVacina(item.id, preco);
      toast.push(`Preço de ${item.nome} atualizado.`);
      await queryClient.invalidateQueries({ queryKey: ["agenda", "vacinas-gestao"] });
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Não foi possível salvar o preço.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="living-card space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Preços das vacinas na agenda</h2>
        <p className="text-sm text-muted">
          Defina o valor cobrado no agendamento de vacinação. Sem preço, a vacina não entra no fluxo de pagamento.
        </p>
      </div>
      {gestao.isLoading ? <LoadingState label="Carregando vacinas…" /> : null}
      {gestao.isError ? (
        <ErrorState message={gestao.error instanceof HttpError ? gestao.error.message : "Falha ao carregar preços."} />
      ) : null}
      {!gestao.isLoading && !(gestao.data ?? []).length ? (
        <p className="text-sm text-muted">
          Nenhuma vacina oferecida ainda. Cadastre em{" "}
          <Link to="/app/catalogos" className="font-medium text-brand hover:underline">
            Catálogos
          </Link>
          .
        </p>
      ) : null}
      {(gestao.data ?? []).length ? (
        <ul className="space-y-3">
          {(gestao.data ?? []).map((item) => (
            <li key={item.id} className="flex flex-wrap items-end gap-3 rounded-2xl bg-brand-soft/40 p-3 ring-1 ring-brand/10">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.nome}</p>
                {item.fabricante ? <p className="text-xs text-muted">{item.fabricante}</p> : null}
              </div>
              <Field label="Preço (R$)">
                <Input
                  inputMode="decimal"
                  value={precos[item.id] ?? ""}
                  onChange={(event) => setPrecos((atual) => ({ ...atual, [item.id]: event.target.value }))}
                  placeholder="0,00"
                  className="w-32"
                />
              </Field>
              <Button type="button" busy={savingId === item.id} busyLabel="Salvando…" onClick={() => salvar(item)}>
                Salvar
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <ErrorState message={error} /> : null}
    </section>
  );
}
