import { useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  List,
  PawPrint,
  Search,
  UserRound,
} from "lucide-react";
import { statusAgenda } from "../../lib/agenda";
import { type AgendaSolicitacao } from "../../services/api";
import { PetPhoto } from "../clinic/PanelHero";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Modal } from "../ui/Modal";

export type AtendimentoItem = {
  id: number;
  petId: number;
  pet: string;
  especie?: string | null;
  fotoUrl?: string | null;
  tutor: string;
  clinica: string;
  profissional: string | null;
  statusCodigo: string;
  status: string;
  tipo: string;
  resumo: string | null;
  quando: string;
};

type Filtro = "todos" | "andamento" | "concluidos";
type Kind = "andamento" | "concluido" | "outro";

type PetGrupo = {
  petId: number;
  pet: string;
  especie?: string | null;
  fotoUrl?: string | null;
  tutor: string;
  itens: AtendimentoItem[];
  ultimo: AtendimentoItem;
};

export function fromAgendaSolicitacao(item: AgendaSolicitacao): AtendimentoItem {
  return {
    id: item.id,
    petId: item.petId,
    pet: item.pet,
    especie: item.especie,
    fotoUrl: item.fotoUrl,
    tutor: item.tutor,
    clinica: item.clinica,
    profissional: item.colaborador,
    statusCodigo: item.statusCodigo,
    status: item.status,
    tipo: item.tipo === "VACINACAO" ? "Vacinação" : "Atendimento",
    resumo: item.observacoes || (item.tipo === "VACINACAO" ? item.vacina : item.servico) || null,
    quando: item.inicio,
  };
}

/** Em andamento = futuro/ativo; Concluído = já ocorreu (ou status CONCLUIDO). */
function kindOf(item: AtendimentoItem): Kind {
  const code = (item.statusCodigo || "").toUpperCase();
  if (["CANCELADO_CLIENTE", "CANCELADO_CLINICA", "RECUSADO", "FALTOU", "CANCELADO"].includes(code)) {
    return "outro";
  }
  if (code === "CONCLUIDO") return "concluido";
  if (code === "AGUARDANDO_PAGAMENTO") return "andamento";

  const when = new Date(item.quando).getTime();
  const jaPassou = Number.isFinite(when) && when < Date.now();

  if (["SOLICITADO", "CONFIRMADO", "AGUARDANDO_CLIENTE"].includes(code)) {
    // CONFIRMADO futuro = andamento; passado = concluído (lógica existente)
    return jaPassou ? "concluido" : "andamento";
  }
  return jaPassou ? "concluido" : "andamento";
}

function rotuloKind(item: AtendimentoItem): string {
  const kind = kindOf(item);
  if (kind === "andamento") return "Em andamento";
  if (kind === "concluido") return "Concluído";
  return statusAgenda(item.statusCodigo, item.status);
}

function tomKind(item: AtendimentoItem): "warn" | "ok" | "danger" | "neutral" {
  const kind = kindOf(item);
  if (kind === "andamento") return "warn"; // amarelo
  if (kind === "concluido") return "ok"; // verde
  return "danger";
}

function formatQuando(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function agruparPorPet(itens: AtendimentoItem[]): PetGrupo[] {
  const mapa = new Map<number, AtendimentoItem[]>();
  for (const item of itens) {
    const lista = mapa.get(item.petId) ?? [];
    lista.push(item);
    mapa.set(item.petId, lista);
  }
  return [...mapa.entries()]
    .map(([petId, lista]) => {
      const ordenada = [...lista].sort((a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime());
      const primeiro = ordenada[0];
      return {
        petId,
        pet: primeiro.pet,
        especie: primeiro.especie,
        fotoUrl: primeiro.fotoUrl,
        tutor: primeiro.tutor,
        itens: ordenada,
        ultimo: primeiro,
      };
    })
    .sort((a, b) => new Date(b.ultimo.quando).getTime() - new Date(a.ultimo.quando).getTime());
}

export function AtendimentosPorPetPanel({
  itens,
  clinicMode,
  loading,
}: {
  itens: AtendimentoItem[];
  clinicMode: boolean;
  loading?: boolean;
}) {
  const [buscaPets, setBuscaPets] = useState("");
  const [modalPetId, setModalPetId] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [buscaModal, setBuscaModal] = useState("");

  const grupos = useMemo(() => {
    const q = buscaPets.trim().toLowerCase();
    return agruparPorPet(itens).filter((grupo) => {
      if (!q) return true;
      const hay = [grupo.pet, grupo.tutor, grupo.ultimo.clinica, grupo.ultimo.resumo].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [buscaPets, itens]);

  const grupoModal = useMemo(() => {
    if (modalPetId == null) return null;
    return agruparPorPet(itens).find((g) => g.petId === modalPetId) ?? null;
  }, [itens, modalPetId]);

  const historicoFiltrado = useMemo(() => {
    if (!grupoModal) return [];
    const q = buscaModal.trim().toLowerCase();
    return grupoModal.itens.filter((item) => {
      const kind = kindOf(item);
      if (filtro === "andamento" && kind !== "andamento") return false;
      if (filtro === "concluidos" && kind !== "concluido") return false;
      if (!q) return true;
      const hay = [item.resumo, item.clinica, item.profissional, item.tutor, item.tipo, item.status].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [buscaModal, filtro, grupoModal]);

  if (loading) return null;

  return (
    <>
      <section className="mb-5 rounded-3xl border border-[#ebe4f4] bg-white p-3 shadow-sm sm:p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#9a90b0]" />
          <input
            value={buscaPets}
            onChange={(event) => setBuscaPets(event.target.value)}
            placeholder={clinicMode ? "Buscar por pet ou tutor..." : "Buscar por pet ou clínica..."}
            className="h-10 w-full rounded-full border border-[#ebe4f4] bg-[#faf8fc] py-2 pr-3 pl-9 text-sm outline-none focus:border-[#7828c8]/40"
          />
        </label>
      </section>

      {!itens.length ? (
        <EmptyState
          title="Nenhum atendimento"
          description={
            clinicMode
              ? "Quando houver horários marcados na agenda, eles aparecem aqui agrupados por pet."
              : "Os atendimentos marcados nas clínicas vinculadas ficam aqui, por pet."
          }
        />
      ) : !grupos.length ? (
        <EmptyState
          title="Nenhum resultado"
          description="Nenhum pet encontrado com essa busca."
          onClear={() => setBuscaPets("")}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {grupos.map((grupo) => {
            const ultimo = grupo.ultimo;
            const kind = kindOf(ultimo);
            return (
              <li key={grupo.petId} className="rounded-3xl border border-[#ebe4f4] bg-white p-4 shadow-sm sm:p-5">
                <div className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2 sm:grid-cols-[7rem_1fr]">
                  <PetPhoto
                    especie={grupo.especie}
                    seed={grupo.petId}
                    src={grupo.fotoUrl}
                    className="row-span-2 size-full min-h-[5.5rem] rounded-2xl object-cover sm:min-h-[7rem]"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-[#1f1630]">{grupo.pet}</p>
                      <Badge tone={tomKind(ultimo)}>{rotuloKind(ultimo)}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-[#6e6680]">
                      {clinicMode ? grupo.tutor : ultimo.clinica}
                      {grupo.especie ? ` · ${grupo.especie}` : ""}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold tracking-wide text-[#7828c8] uppercase">
                      Último atendimento
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[#6e6680] sm:text-sm">
                      <span className="inline-flex items-center gap-1.5">
                        <PawPrint className="size-3.5 text-[#7828c8]" />
                        {ultimo.resumo?.trim() || ultimo.tipo}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="size-3.5 text-[#7828c8]" />
                        {formatQuando(ultimo.quando)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        {clinicMode ? (
                          <>
                            <UserRound className="size-3.5 text-[#7828c8]" />
                            {ultimo.profissional?.trim() || "A definir"}
                          </>
                        ) : (
                          <>
                            <Building2 className="size-3.5 text-[#7828c8]" />
                            {ultimo.clinica}
                          </>
                        )}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[#9a90b0]">
                      {grupo.itens.length} atendimento{grupo.itens.length === 1 ? "" : "s"} no histórico
                      {kind === "andamento" ? " · em andamento" : kind === "concluido" ? " · último já realizado" : ""}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-4 w-full !rounded-full"
                  onClick={() => {
                    setFiltro("todos");
                    setBuscaModal("");
                    setModalPetId(grupo.petId);
                  }}
                >
                  <List className="size-4" />
                  Listar todos os atendimentos
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={grupoModal != null}
        wide
        title={grupoModal ? `Atendimentos · ${grupoModal.pet}` : "Atendimentos"}
        onClose={() => setModalPetId(null)}
      >
        {grupoModal ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-[#faf8fc] p-3">
              <PetPhoto
                especie={grupoModal.especie}
                seed={grupoModal.petId}
                src={grupoModal.fotoUrl}
                className="size-12 rounded-full"
              />
              <div className="min-w-0">
                <p className="font-semibold text-[#1f1630]">{grupoModal.pet}</p>
                <p className="text-sm text-[#6e6680]">
                  {clinicMode ? grupoModal.tutor : grupoModal.ultimo.clinica}
                  {` · ${grupoModal.itens.length} registro${grupoModal.itens.length === 1 ? "" : "s"}`}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: "todos", label: "Todos", icon: <PawPrint className="size-3.5" /> },
                    { id: "andamento", label: "Em andamento", icon: <Clock3 className="size-3.5" /> },
                    { id: "concluidos", label: "Concluídos", icon: <CheckCircle2 className="size-3.5" /> },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFiltro(item.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                      filtro === item.id ? "bg-[#7828c8] text-white" : "border border-[#e4dcf0] bg-white text-[#5c4d78]"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
              <label className="relative min-w-0 flex-1 lg:max-w-md">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#9a90b0]" />
                <input
                  value={buscaModal}
                  onChange={(event) => setBuscaModal(event.target.value)}
                  placeholder={clinicMode ? "Buscar motivo, tutor ou profissional..." : "Buscar motivo, clínica ou profissional..."}
                  className="h-10 w-full rounded-full border border-[#ebe4f4] bg-[#faf8fc] py-2 pr-3 pl-9 text-sm outline-none focus:border-[#7828c8]/40"
                />
              </label>
            </div>

            {!historicoFiltrado.length ? (
              <EmptyState
                title="Nenhum resultado encontrado"
                description="Não encontramos atendimentos com esses filtros."
                onClear={() => {
                  setFiltro("todos");
                  setBuscaModal("");
                }}
              />
            ) : (
              <ul className="max-h-[min(55svh,28rem)] space-y-3 overflow-y-auto pr-1">
                {historicoFiltrado.map((item) => {
                  const kind = kindOf(item);
                  const emAndamento = kind === "andamento";
                  return (
                    <li
                      key={item.id}
                      className={`flex flex-col gap-3 rounded-3xl border border-[#ebe4f4] bg-white p-4 shadow-sm ${
                        emAndamento ? "border-l-4 border-l-[#7828c8]" : ""
                      }`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <PetPhoto
                          especie={item.especie}
                          seed={item.petId}
                          src={item.fotoUrl}
                          className="size-12 shrink-0 rounded-full"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-[#1f1630]">
                              {item.pet} · {item.tipo}
                            </p>
                            <Badge tone={tomKind(item)}>{rotuloKind(item)}</Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[#6e6680] sm:text-sm">
                            <span className="inline-flex items-center gap-1.5">
                              <PawPrint className="size-3.5 text-[#7828c8]" />
                              {item.resumo?.trim() || "Sem motivo informado"}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarDays className="size-3.5 text-[#7828c8]" />
                              {formatQuando(item.quando)}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Building2 className="size-3.5 text-[#7828c8]" />
                              {item.clinica}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <UserRound className="size-3.5 text-[#7828c8]" />
                              {clinicMode
                                ? item.profissional?.trim() || "Profissional a definir"
                                : item.profissional?.trim() || "Equipe da clínica"}
                            </span>
                            {clinicMode ? (
                              <span className="inline-flex items-center gap-1.5">
                                <UserRound className="size-3.5 text-[#7828c8]" />
                                Tutor: {item.tutor}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
