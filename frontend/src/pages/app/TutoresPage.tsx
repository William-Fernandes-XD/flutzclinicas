import { useQuery } from "@tanstack/react-query";
import { Eye, Mail, Phone, RefreshCw, Search, UserMinus, Users } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { PetPhoto } from "../../components/clinic/PanelHero";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState, LoadingState } from "../../components/ui/EmptyState";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { Input, Select, Surface } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { http } from "../../lib/http";

type Tutor = {
  id: number;
  nome: string;
  cpf: string;
  email: string | null;
  telefone: string | null;
  fotoUrl?: string | null;
  ativo?: boolean;
  vinculadoEm?: string | null;
  ultimoAtendimentoEm?: string | null;
  ultimoAtendimentoServico?: string | null;
};

type Pet = { id: number; nome: string; clienteId: number; especie: string; fotoUrl?: string | null };

type Row = Tutor & { pets: Pet[] };

type StatusFilter = "todos" | "ativo" | "inativo";
type SortKey = "recentes" | "nome" | "atendimento";

const PAGE_SIZE = 8;

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function formatCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function isNovo(vinculadoEm?: string | null): boolean {
  if (!vinculadoEm) return false;
  const d = new Date(vinculadoEm);
  if (Number.isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() < 30 * 24 * 60 * 60 * 1000;
}

export function TutoresPage() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [especieFilter, setEspecieFilter] = useState("todas");
  const [sort, setSort] = useState<SortKey>("recentes");
  const [page, setPage] = useState(1);
  const [detalhe, setDetalhe] = useState<Row | null>(null);

  const lista = useQuery({ queryKey: ["tutores"], queryFn: () => http<Tutor[]>("/api/tutores") });
  const pets = useQuery({ queryKey: ["pets"], queryFn: () => http<Pet[]>("/api/pets") });

  const especies = useMemo(() => {
    const set = new Set<string>();
    for (const pet of pets.data ?? []) {
      if (pet.especie?.trim()) set.add(pet.especie.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [pets.data]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    let list: Row[] = (lista.data ?? []).map((tutor) => ({
      ...tutor,
      pets: (pets.data ?? []).filter((pet) => pet.clienteId === tutor.id),
      ativo: tutor.ativo !== false,
    }));

    list = list.filter((tutor) => {
      if (statusFilter === "ativo" && !tutor.ativo) return false;
      if (statusFilter === "inativo" && tutor.ativo) return false;
      if (especieFilter !== "todas" && !tutor.pets.some((p) => p.especie === especieFilter)) return false;
      if (!term) return true;
      return (
        tutor.nome.toLowerCase().includes(term) ||
        (tutor.email ?? "").toLowerCase().includes(term) ||
        (tutor.telefone ?? "").toLowerCase().includes(term) ||
        (digits.length > 0 && tutor.cpf.replace(/\D/g, "").includes(digits)) ||
        tutor.cpf.includes(term)
      );
    });

    list.sort((a, b) => {
      if (sort === "nome") return a.nome.localeCompare(b.nome, "pt-BR");
      if (sort === "atendimento") {
        const ta = a.ultimoAtendimentoEm ? new Date(a.ultimoAtendimentoEm).getTime() : 0;
        const tb = b.ultimoAtendimentoEm ? new Date(b.ultimoAtendimentoEm).getTime() : 0;
        return tb - ta;
      }
      const va = a.vinculadoEm ? new Date(a.vinculadoEm).getTime() : 0;
      const vb = b.vinculadoEm ? new Date(b.vinculadoEm).getTime() : 0;
      return vb - va || a.nome.localeCompare(b.nome, "pt-BR");
    });

    return list;
  }, [lista.data, pets.data, q, statusFilter, especieFilter, sort]);

  const kpis = useMemo(() => {
    const all = lista.data ?? [];
    const total = all.length;
    const novos = all.filter((t) => isNovo(t.vinculadoEm)).length;
    const comVisita = all.filter((t) => Boolean(t.ultimoAtendimentoEm)).length;
    const inativos = all.filter((t) => t.ativo === false).length;
    return { total, novos, comVisita, inativos };
  }, [lista.data]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (lista.isLoading) return <LoadingState label="Carregando clientes…" />;

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Tutores vinculados à sua clínica. Eles chegam pelo primeiro contato — pedido de agendamento, chat ou cadastro na página pública. Aqui você consulta e acompanha."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Total de clientes"
          value={kpis.total}
          hint="Vinculados a esta clínica"
          icon={<Users className="size-4" />}
        />
        <Kpi
          label="Novos clientes"
          value={kpis.novos}
          hint="Vinculados nos últimos 30 dias"
          icon={<RefreshCw className="size-4" />}
        />
        <Kpi
          label="Já atenderam"
          value={kpis.comVisita}
          hint="Com pelo menos um agendamento"
          icon={<Users className="size-4" />}
        />
        <Kpi
          label="Inativos"
          value={kpis.inativos}
          hint="Vínculo desativado na clínica"
          icon={<UserMinus className="size-4" />}
          muted
        />
      </div>

      <Surface className="mb-4 !p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
              placeholder="Pesquisar por nome, e-mail, telefone ou CPF…"
              className="pl-10"
            />
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as StatusFilter);
                setPage(1);
              }}
              className="w-auto min-w-[8rem]"
            >
              <option value="todos">Status: Todos</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </Select>
            <Select
              value={especieFilter}
              onChange={(event) => {
                setEspecieFilter(event.target.value);
                setPage(1);
              }}
              className="w-auto min-w-[9rem]"
            >
              <option value="todas">Espécie: Todas</option>
              {especies.map((esp) => (
                <option key={esp} value={esp}>
                  {esp}
                </option>
              ))}
            </Select>
            <Select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="w-auto min-w-[10rem]"
            >
              <option value="recentes">Ordenar: Mais recentes</option>
              <option value="nome">Ordenar: Nome</option>
              <option value="atendimento">Ordenar: Último atendimento</option>
            </Select>
            <ExportMenu
              filename="Clientes da clínica"
              title="Clientes da clínica"
              rows={rows}
              columns={[
                { header: "Nome", value: (row) => row.nome },
                { header: "CPF", value: (row) => row.cpf },
                { header: "E-mail", value: (row) => row.email },
                { header: "Telefone", value: (row) => row.telefone },
                { header: "Pets", value: (row) => row.pets.map((pet) => pet.nome).join(", ") },
                { header: "Último atendimento", value: (row) => formatDate(row.ultimoAtendimentoEm) },
                { header: "Status", value: (row) => (row.ativo ? "Ativo" : "Inativo") },
              ]}
            />
          </div>
        </div>
      </Surface>

      {!rows.length ? (
        <EmptyState
          title="Nenhum cliente por aqui"
          description="A clínica não cria contas. Quando um tutor fizer o primeiro contato — agendamento, chat ou cadastro na página — ele aparece nesta lista."
        />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {pageRows.map((row) => (
              <Surface key={row.id} className="!p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={row.nome} src={row.fotoUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{row.nome}</p>
                      <Badge tone={row.ativo ? "ok" : "warn"}>{row.ativo ? "Ativo" : "Inativo"}</Badge>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted">{row.email || row.telefone || formatCpf(row.cpf)}</p>
                    <p className="mt-2 text-xs text-muted">
                      {row.pets.length} pet(s)
                      {row.ultimoAtendimentoEm
                        ? ` · Último: ${formatDate(row.ultimoAtendimentoEm)} ${row.ultimoAtendimentoServico ?? ""}`
                        : " · Sem atendimento ainda"}
                    </p>
                  </div>
                </div>
                <Button variant="secondary" className="mt-3" onClick={() => setDetalhe(row)}>
                  Ver detalhes
                </Button>
              </Surface>
            ))}
          </div>

          <div className="living-card hidden overflow-x-auto md:block">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] tracking-wide text-muted uppercase dark:border-zinc-800">
                  <th className="px-4 py-3 font-semibold">Foto</th>
                  <th className="px-4 py-3 font-semibold">Nome</th>
                  <th className="px-4 py-3 font-semibold">Contato</th>
                  <th className="px-4 py-3 font-semibold">Pets</th>
                  <th className="px-4 py-3 font-semibold">Último atendimento</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-line/70 last:border-0 hover:bg-brand-soft/35 dark:border-zinc-800"
                  >
                    <td className="px-4 py-3">
                      <Avatar name={row.nome} src={row.fotoUrl} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink dark:text-white">{row.nome}</p>
                      <p className="text-xs text-muted">{formatCpf(row.cpf)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1 text-sm">
                        {row.email ? (
                          <p className="flex items-center gap-1.5 text-muted">
                            <Mail className="size-3.5 shrink-0" />
                            <span className="truncate">{row.email}</span>
                          </p>
                        ) : null}
                        {row.telefone ? (
                          <p className="flex items-center gap-1.5 text-muted">
                            <Phone className="size-3.5 shrink-0" />
                            {row.telefone}
                          </p>
                        ) : null}
                        {!row.email && !row.telefone ? <span className="text-muted">—</span> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {row.pets.length ? (
                        <div className="flex items-center gap-2">
                          <span className="flex -space-x-2">
                            {row.pets.slice(0, 3).map((pet) => (
                              <PetPhoto
                                key={pet.id}
                                especie={pet.especie}
                                seed={pet.id}
                                src={pet.fotoUrl}
                                className="size-8 rounded-full ring-2 ring-white dark:ring-zinc-900"
                              />
                            ))}
                          </span>
                          <span className="text-xs font-medium text-muted">
                            {row.pets.length} pet{row.pets.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.ultimoAtendimentoEm ? (
                        <div>
                          <p className="font-medium">{formatDate(row.ultimoAtendimentoEm)}</p>
                          <p className="text-xs text-muted">{row.ultimoAtendimentoServico ?? "Atendimento"}</p>
                        </div>
                      ) : (
                        <span className="text-muted">Ainda sem visita</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={row.ativo ? "ok" : "warn"}>{row.ativo ? "Ativo" : "Inativo"}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        title="Ver detalhes"
                        onClick={() => setDetalhe(row)}
                        className="inline-flex size-9 items-center justify-center rounded-xl text-brand transition hover:bg-brand-soft"
                      >
                        <Eye className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              Mostrando {pageRows.length} de {rows.length} cliente{rows.length === 1 ? "" : "s"}
              {rows.length !== (lista.data?.length ?? 0) ? ` (filtro de ${lista.data?.length ?? 0})` : ""}
            </p>
            {pageCount > 1 ? (
              <div className="flex flex-wrap items-center gap-1">
                <PagerButton disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  ‹
                </PagerButton>
                {Array.from({ length: pageCount }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === pageCount || Math.abs(n - currentPage) <= 1)
                  .reduce<(number | "…")[]>((acc, n, idx, arr) => {
                    if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push("…");
                    acc.push(n);
                    return acc;
                  }, [])
                  .map((n, idx) =>
                    n === "…" ? (
                      <span key={`e-${idx}`} className="px-1 text-muted">
                        …
                      </span>
                    ) : (
                      <PagerButton key={n} active={n === currentPage} onClick={() => setPage(n)}>
                        {n}
                      </PagerButton>
                    ),
                  )}
                <PagerButton disabled={currentPage >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
                  ›
                </PagerButton>
              </div>
            ) : null}
          </div>
        </>
      )}

      <Modal open={Boolean(detalhe)} title={detalhe?.nome ?? "Cliente"} onClose={() => setDetalhe(null)}>
        {detalhe ? (
          <div className="grid gap-5">
            <div className="flex items-center gap-4">
              <Avatar name={detalhe.nome} src={detalhe.fotoUrl} size="lg" />
              <div>
                <Badge tone={detalhe.ativo ? "ok" : "warn"}>{detalhe.ativo ? "Ativo" : "Inativo"}</Badge>
                <p className="mt-2 text-sm text-muted">CPF {formatCpf(detalhe.cpf)}</p>
                {detalhe.vinculadoEm ? (
                  <p className="text-xs text-muted">Vinculado em {formatDate(detalhe.vinculadoEm)}</p>
                ) : null}
              </div>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p className="rounded-2xl bg-brand-soft/50 px-3 py-2">
                <span className="text-xs font-semibold tracking-wide text-muted uppercase">E-mail</span>
                <br />
                {detalhe.email || "—"}
              </p>
              <p className="rounded-2xl bg-brand-soft/50 px-3 py-2">
                <span className="text-xs font-semibold tracking-wide text-muted uppercase">Telefone</span>
                <br />
                {detalhe.telefone || "—"}
              </p>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Pets</p>
              {detalhe.pets.length ? (
                <ul className="grid gap-2">
                  {detalhe.pets.map((pet) => (
                    <li key={pet.id}>
                      <Link
                        to={`/app/pets/${pet.id}`}
                        className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-brand-soft/60"
                      >
                        <PetPhoto especie={pet.especie} seed={pet.id} src={pet.fotoUrl} className="size-10 rounded-xl" />
                        <span>
                          <span className="font-medium">{pet.nome}</span>
                          <span className="block text-xs text-muted">{pet.especie}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Nenhum pet cadastrado ainda.</p>
              )}
            </div>
            <p className="text-sm text-muted">
              Último atendimento:{" "}
              {detalhe.ultimoAtendimentoEm
                ? `${formatDate(detalhe.ultimoAtendimentoEm)} · ${detalhe.ultimoAtendimentoServico ?? "Atendimento"}`
                : "ainda não houve visita nesta clínica"}
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon,
  muted,
}: {
  label: string;
  value: number;
  hint: string;
  icon: ReactNode;
  muted?: boolean;
}) {
  return (
    <article className="living-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
        <span
          className={`inline-flex size-8 items-center justify-center rounded-xl ${
            muted ? "bg-amber-50 text-amber-700" : "bg-[#f3eafc] text-[#7828c8]"
          }`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-[#1f1630] dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </article>
  );
}

function PagerButton({
  children,
  onClick,
  disabled,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex size-9 items-center justify-center rounded-xl text-sm font-semibold transition ${
        active
          ? "bg-[#7828c8] text-white"
          : "bg-white text-ink ring-1 ring-line hover:bg-brand-soft disabled:opacity-40 dark:bg-zinc-900 dark:text-white dark:ring-zinc-700"
      }`}
    >
      {children}
    </button>
  );
}
