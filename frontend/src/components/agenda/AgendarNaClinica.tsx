import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isoDate } from "../../lib/agenda";
import { http, HttpError } from "../../lib/http";
import { fileFromForm, uploadPerfilFoto } from "../../lib/perfil-foto";
import { isTutor } from "../../lib/session";
import { useAuth } from "../../providers/AuthProvider";
import { useToast } from "../../providers/ToastProvider";
import { api, type AgendaDia, type AgendaSlot } from "../../services/api";
import { Button } from "../ui/Button";
import { ErrorState } from "../ui/EmptyState";
import { Field, Input, Select } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { PhotoFileField } from "../ui/PhotoFileField";

const DRAFT_KEY = "flutz.agendar";

type Draft = { slug?: string; dia?: string; slot?: string; tipo?: "ATENDIMENTO" | "VACINACAO" };

function monthBounds(cursor: Date) {
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  return { de: isoDate(start), ate: isoDate(end) };
}

function readDraft(slug?: string): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    if (slug && draft.slug && draft.slug !== slug) return null;
    return draft;
  } catch {
    return null;
  }
}

function countLivres(dia?: AgendaDia): number {
  return dia?.slots.filter((item) => item.estado === "LIVRE").length ?? 0;
}

export function AgendarNaClinica({
  empresaId,
  nome,
  slug,
  preview = false,
}: {
  empresaId?: number;
  nome: string;
  slug?: string;
  preview?: boolean;
}) {
  const { session } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = isoDate(new Date());
  const saved = !preview ? readDraft(slug) : null;
  const [tipo, setTipo] = useState<"ATENDIMENTO" | "VACINACAO">(saved?.tipo ?? "ATENDIMENTO");
  const [petId, setPetId] = useState("");
  const [alvoId, setAlvoId] = useState("");
  const [cursor, setCursor] = useState(() => {
    const base = saved?.dia ? new Date(`${saved.dia}T12:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [dia, setDia] = useState(saved?.dia && saved.dia >= today ? saved.dia : today);
  const [slot, setSlot] = useState(saved?.slot ?? "");
  const [erro, setErro] = useState("");
  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [cadastroErro, setCadastroErro] = useState("");

  const { de, ate } = monthBounds(cursor);
  const tutor = isTutor(session);
  const live = !preview && Boolean(slug || empresaId);

  const disponibilidade = useQuery({
    queryKey: ["agenda-disp-public", slug, empresaId, de, ate],
    queryFn: () =>
      slug
        ? api.publicClinicDisponibilidade(slug, de, ate)
        : api.agendaDisponibilidade(empresaId!, de, ate),
    enabled: live,
  });
  const pets = useQuery({
    queryKey: ["agenda-pets", empresaId],
    queryFn: () => api.agendaPets(empresaId!),
    enabled: live && tutor && Boolean(empresaId),
  });
  const especies = useQuery({
    queryKey: ["especies", empresaId],
    queryFn: () => http<{ id: number; nome: string }[]>("/api/catalogos/especies"),
    enabled: live && tutor,
  });
  const cadastrarPet = useMutation({
    mutationFn: async (payload: { body: Record<string, unknown>; foto: File | null }) => {
      const pet = await http<{ id: number }>("/api/pets", { method: "POST", json: payload.body });
      if (payload.foto) {
        try {
          await uploadPerfilFoto({ alvo: "pet", arquivo: payload.foto, petId: pet.id });
        } catch {
          /* pet já cadastrado */
        }
      }
      return pet;
    },
    onSuccess: async (pet) => {
      toast.push("Pet cadastrado na sua conta.");
      setPetId(String(pet.id));
      setCadastroAberto(false);
      setCadastroErro("");
      await queryClient.invalidateQueries({ queryKey: ["agenda-pets", empresaId] });
      await queryClient.invalidateQueries({ queryKey: ["pets"] });
    },
  });
  const servicos = useQuery({
    queryKey: ["agenda-servicos", empresaId],
    queryFn: () => api.agendaServicos(empresaId!),
    enabled: live && tutor && Boolean(empresaId),
  });
  const vacinas = useQuery({
    queryKey: ["agenda-vacinas", empresaId],
    queryFn: () => api.agendaVacinas(empresaId!),
    enabled: live && tutor && Boolean(empresaId),
  });
  const criar = useMutation({
    mutationFn: api.criarSolicitacao,
    onSuccess: async () => {
      toast.push("Solicitação enviada. A clínica analisa o horário.");
      setSlot("");
      sessionStorage.removeItem(DRAFT_KEY);
      await queryClient.invalidateQueries({ queryKey: ["agenda-disp-public"] });
      await queryClient.invalidateQueries({ queryKey: ["agenda-solicitacoes"] });
    },
  });

  const dias = disponibilidade.data?.dias ?? (preview ? demoDias(cursor) : []);
  const porData = useMemo(() => new Map(dias.map((item) => [item.data, item])), [dias]);
  const escolhido = porData.get(dia);
  const slots = escolhido?.slots ?? [];
  const livres = slots.filter((item) => item.estado === "LIVRE");

  const dateTabs = useMemo(() => {
    const start = new Date(`${de}T12:00:00`);
    const end = new Date(`${ate}T12:00:00`);
    const out: { data: string; livres: number; label: string; short: string }[] = [];
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const data = isoDate(date);
      if (data < today) continue;
      const info = porData.get(data);
      out.push({
        data,
        livres: countLivres(info),
        label: date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }),
        short: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      });
    }
    return out;
  }, [ate, de, porData, today]);

  useEffect(() => {
    if (!porData.has(dia) || dia < today) {
      const fallback =
        dateTabs.find((item) => item.livres > 0)?.data ??
        dateTabs[0]?.data ??
        dias.find((item) => item.data >= today && item.slots.some((slotItem) => slotItem.estado === "LIVRE"))?.data;
      if (fallback) setDia(fallback);
    }
  }, [dateTabs, dia, dias, porData, today]);

  function persistDraft() {
    if (!slug) return;
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ slug, dia, slot, tipo } satisfies Draft));
  }

  async function enviar() {
    setErro("");
    if (!empresaId) return;
    if (!petId || !slot) {
      setErro("Escolha o pet e um horário livre.");
      return;
    }
    const escolhidoSlot = livres.find((item) => item.inicio === slot);
    if (!escolhidoSlot) {
      setErro("Este horário não está mais livre.");
      return;
    }
    try {
      await criar.mutateAsync({
        empresaId,
        petId: Number(petId),
        tipo,
        empresaServicoId: tipo === "ATENDIMENTO" && alvoId ? Number(alvoId) : null,
        empresaVacinaId: tipo === "VACINACAO" && alvoId ? Number(alvoId) : null,
        dataHoraInicio: escolhidoSlot.inicio,
        dataHoraFim: escolhidoSlot.fim,
      });
    } catch (err) {
      setErro(err instanceof HttpError ? err.message : "Não foi possível solicitar o horário");
    }
  }

  function confirmar() {
    setErro("");
    if (preview) return;
    if (!slot) {
      setErro("Escolha um horário disponível.");
      return;
    }
    persistDraft();
    if (!session) {
      const next = encodeURIComponent(`/clinica/${slug ?? ""}#agendar`);
      navigate(`/login?next=${next}`);
      return;
    }
    if (!tutor) {
      setErro("O agendamento público é feito pela conta do tutor.");
      return;
    }
    if (!pets.data?.length) {
      setErro("Cadastre um pet para confirmar o horário.");
      setCadastroAberto(true);
      return;
    }
    void enviar();
  }

  const mesLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <section id="agendar" className="px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#f3eafc] via-[#efe7fb] to-[#e8dff8] px-5 py-10 shadow-sm ring-1 ring-brand/10 sm:px-8 lg:px-12">
        <div className="text-center">
          <p className="text-xs font-bold tracking-[0.2em] text-brand uppercase">Flutz</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Agendar em {nome}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            Escolha a data, o horário e o pet. A clínica confirma o profissional — você não precisa escolher quem atende.
          </p>
        </div>

        {live && disponibilidade.isError ? (
          <div className="mx-auto mt-6 max-w-xl">
            <ErrorState message="Não foi possível carregar os horários desta clínica." />
          </div>
        ) : null}

        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-2xl bg-white text-brand shadow-sm ring-1 ring-brand/10 hover:bg-brand-soft"
            aria-label="Mês anterior"
            onClick={() => setCursor((atual) => new Date(atual.getFullYear(), atual.getMonth() - 1, 1))}
          >
            <ChevronLeft className="size-5" />
          </button>
          <p className="text-sm font-semibold capitalize text-ink">{mesLabel}</p>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-2xl bg-white text-brand shadow-sm ring-1 ring-brand/10 hover:bg-brand-soft"
            aria-label="Próximo mês"
            onClick={() => setCursor((atual) => new Date(atual.getFullYear(), atual.getMonth() + 1, 1))}
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        <div className="mt-4 -mx-1 flex gap-2 overflow-x-auto pb-2">
          {dateTabs.length ? (
            dateTabs.map((tab) => {
              const selected = tab.data === dia;
              const closed = tab.livres === 0;
              return (
                <button
                  key={tab.data}
                  type="button"
                  onClick={() => {
                    setDia(tab.data);
                    setSlot("");
                  }}
                  className={`min-w-[4.75rem] shrink-0 rounded-2xl px-3 py-2.5 text-left transition ${
                    selected
                      ? "bg-brand text-white shadow-md"
                      : closed
                        ? "bg-white/70 text-muted ring-1 ring-brand/5"
                        : "bg-white text-ink ring-1 ring-brand/10 hover:bg-brand-soft"
                  }`}
                >
                  <p className={`text-[11px] font-semibold uppercase ${selected ? "text-white/80" : "text-muted"}`}>
                    {tab.label.split(" ")[0]}
                  </p>
                  <p className="text-sm font-bold">{tab.short}</p>
                  <p className={`mt-1 text-[11px] font-medium ${selected ? "text-white/90" : closed ? "text-muted" : "text-brand"}`}>
                    {closed ? "Lotado" : `${tab.livres} livres`}
                  </p>
                </button>
              );
            })
          ) : (
            <p className="px-1 text-sm text-muted">Nenhuma data disponível neste mês.</p>
          )}
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,18rem)_1fr] lg:items-start">
          <div className="rounded-3xl bg-white/90 p-5 shadow-sm ring-1 ring-brand/10">
            <p className="text-sm font-semibold text-ink">Detalhes</p>
            <p className="mt-1 text-xs text-muted">
              {escolhido?.feriado ? `${escolhido.feriado} · ` : ""}
              {rotuloEstado(escolhido?.estado)}
            </p>

            {tutor && empresaId && !preview ? (
              <div className="mt-4 grid gap-3">
                <Field label="Tipo">
                  <Select
                    value={tipo}
                    onChange={(event) => {
                      setTipo(event.target.value as "ATENDIMENTO" | "VACINACAO");
                      setAlvoId("");
                    }}
                  >
                    <option value="ATENDIMENTO">Atendimento</option>
                    <option value="VACINACAO">Vacinação</option>
                  </Select>
                </Field>
                <div>
                  <Field label="Pet">
                    <Select value={petId} onChange={(event) => setPetId(event.target.value)}>
                      <option value="">{pets.isLoading ? "Carregando…" : "Selecione"}</option>
                      {(pets.data ?? []).map((pet) => (
                        <option key={pet.id} value={pet.id}>
                          {pet.nome}
                          {pet.especie ? ` · ${pet.especie}` : ""}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <button
                    type="button"
                    className="mt-1.5 text-sm font-semibold text-brand hover:underline"
                    onClick={() => {
                      setCadastroErro("");
                      setCadastroAberto(true);
                    }}
                  >
                    {pets.data?.length ? "Cadastrar outro pet" : "Cadastrar pet"}
                  </button>
                </div>
                {tipo === "ATENDIMENTO" ? (
                  <Field label="Serviço" hint="Opcional">
                    <Select value={alvoId} onChange={(event) => setAlvoId(event.target.value)}>
                      <option value="">Sem serviço específico</option>
                      {(servicos.data ?? []).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nome}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <Field
                    label="Vacina"
                    hint={
                      vacinas.isLoading
                        ? "Carregando vacinas…"
                        : vacinas.data?.length
                          ? undefined
                          : "Esta clínica ainda não liberou vacinas para agendar."
                    }
                  >
                    <Select value={alvoId} onChange={(event) => setAlvoId(event.target.value)} required>
                      <option value="">{vacinas.isLoading ? "Carregando…" : "Selecione"}</option>
                      {(vacinas.data ?? []).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nome}
                          {item.fabricante ? ` · ${item.fabricante}` : ""}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                <p className="rounded-2xl bg-brand-soft/60 px-3 py-2 text-xs text-muted">
                  Profissional: qualquer da equipe (a clínica define na confirmação).
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">
                Entre como tutor para escolher o pet e enviar a solicitação.
              </p>
            )}
          </div>

          <div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-lg font-semibold text-ink">Horários</p>
                <p className="text-sm text-muted">
                  {new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                  {livres.length ? ` · ${livres.length} livres` : ""}
                </p>
              </div>
              {live && disponibilidade.isLoading ? <p className="text-xs text-muted">Atualizando agenda…</p> : null}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {slots.length ? (
                slots.map((item) => (
                  <SlotButton key={item.inicio} item={item} selected={slot === item.inicio} onSelect={setSlot} />
                ))
              ) : (
                <p className="col-span-full text-sm text-muted">
                  {escolhido?.estado === "SEM_EXPEDIENTE"
                    ? "A clínica não atende neste dia."
                    : "Nenhum horário livre neste dia."}
                </p>
              )}
            </div>

            {erro ? (
              <div className="mt-4">
                <ErrorState message={erro} />
              </div>
            ) : null}

            {!session && !preview ? (
              <p className="mt-4 text-sm text-muted">
                Para confirmar, entre como tutor. Você volta para este horário.{" "}
                <Link
                  to={`/login?next=${encodeURIComponent(`/clinica/${slug ?? ""}#agendar`)}`}
                  className="font-medium text-brand hover:underline"
                >
                  Entrar
                </Link>
              </p>
            ) : session && !tutor ? (
              <p className="mt-4 text-sm text-muted">O pedido de horário na página pública é feito pela conta do tutor.</p>
            ) : null}

            <Button
              className="mt-6 w-full rounded-2xl"
              size="lg"
              onClick={confirmar}
              busy={criar.isPending}
              busyLabel="Confirmando…"
            >
              <CalendarDays className="size-4" />
              Confirmar horário
            </Button>
          </div>
        </div>
      </div>

      {tutor && empresaId && !preview ? (
        <Modal
          open={cadastroAberto}
          title="Cadastrar pet"
          onClose={() => {
            setCadastroAberto(false);
            setCadastroErro("");
          }}
          footer={
            <Button type="submit" form="pet-clinica-form" busy={cadastrarPet.isPending} busyLabel="Cadastrando…">
              Cadastrar pet
            </Button>
          }
        >
          <CadastroPetNaClinica
            especies={especies.data ?? []}
            erro={cadastroErro}
            onSubmit={async (event) => {
              event.preventDefault();
              setCadastroErro("");
              const data = new FormData(event.currentTarget);
              try {
                await cadastrarPet.mutateAsync({
                  body: {
                    nome: String(data.get("nome")),
                    especieId: Number(data.get("especieId")),
                    sexo: String(data.get("sexo") || "I"),
                  },
                  foto: fileFromForm(data),
                });
              } catch (err) {
                setCadastroErro(err instanceof HttpError ? err.message : "Não foi possível cadastrar o pet");
              }
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}

function SlotButton({
  item,
  selected,
  onSelect,
}: {
  item: AgendaSlot;
  selected: boolean;
  onSelect: (inicio: string) => void;
}) {
  const livre = item.estado === "LIVRE";
  const hora = new Date(item.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <button
      type="button"
      disabled={!livre}
      onClick={() => onSelect(item.inicio)}
      className={`rounded-xl px-2 py-2 text-xs font-bold tracking-tight sm:text-sm ${
        selected && livre
          ? "bg-brand text-white shadow-sm"
          : livre
            ? "bg-white text-ink ring-1 ring-brand/15 hover:bg-brand-soft"
            : "cursor-not-allowed bg-white/50 text-zinc-400 ring-1 ring-brand/5 line-through"
      }`}
    >
      {hora}
      {item.vagas && item.vagas > 1 ? (
        <span className={`ml-1 text-[10px] font-semibold ${selected ? "text-white/80" : "text-brand"}`}>{item.vagas}</span>
      ) : null}
    </button>
  );
}

function CadastroPetNaClinica({
  especies,
  onSubmit,
  erro,
}: {
  especies: { id: number; nome: string }[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  erro: string;
}) {
  return (
    <form id="pet-clinica-form" onSubmit={onSubmit} className="grid gap-4">
      <p className="text-sm text-muted">O pet fica na sua conta e pode ser atendido em qualquer clínica da Flutz.</p>
      <Field label="Nome do pet">
        <Input name="nome" required />
      </Field>
      <Field label="Espécie">
        <Select name="especieId" required>
          <option value="">Selecione</option>
          {especies.map((item) => (
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
      <PhotoFileField label="Foto do pet" />
      {erro ? <ErrorState message={erro} /> : null}
    </form>
  );
}

function demoDias(cursor: Date): AgendaDia[] {
  const { de, ate } = monthBounds(cursor);
  const start = new Date(`${de}T12:00:00`);
  const end = new Date(`${ate}T12:00:00`);
  const out: AgendaDia[] = [];
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const data = isoDate(date);
    const weekday = date.getDay();
    const closed = weekday === 0;
    const slots: AgendaSlot[] = closed
      ? []
      : ["08:30", "09:00", "09:30", "10:00", "14:30", "15:00", "15:30", "16:00"].map((hora, index) => ({
          inicio: `${data}T${hora}:00`,
          fim: `${data}T${hora}:00`,
          estado: index % 5 === 3 ? "OCUPADO" : "LIVRE",
        }));
    out.push({
      data,
      estado: closed ? "SEM_EXPEDIENTE" : "DISPONIVEL",
      feriado: null,
      slots,
      nota: null,
    });
  }
  return out;
}

function rotuloEstado(estado?: string): string {
  if (estado === "FERIADO") return "Fechado (feriado)";
  if (estado === "SEM_EXPEDIENTE") return "Sem expediente";
  if (estado === "BLOQUEADO") return "Bloqueado";
  if (estado === "LOTADO") return "Lotado";
  if (estado === "PARCIAL") return "Alguns horários livres";
  if (estado === "DISPONIVEL") return "Horários livres";
  return "Escolha uma data com vagas";
}
