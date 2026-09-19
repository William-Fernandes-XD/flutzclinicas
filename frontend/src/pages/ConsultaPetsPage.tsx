import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  FileText,
  MoreVertical,
  PawPrint,
  Pencil,
  Search,
  ShieldCheck,
  ShieldAlert,
  Syringe,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PetPhoto } from "../components/clinic/PanelHero";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/EmptyState";
import { Field, FormSection, Input, Select } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import { PhotoFileField } from "../components/ui/PhotoFileField";
import { exportTable } from "../lib/export";
import { http, HttpError } from "../lib/http";
import { formatCpf, formatDate, idadeLabel, sexoLabel } from "../lib/pet-info";
import { fileFromForm, uploadPerfilFoto } from "../lib/perfil-foto";
import { isTutor } from "../lib/session";
import { useAuth } from "../providers/AuthProvider";
import { useToast } from "../providers/ToastProvider";
import { api, type ConsultaPet, type PetDetail } from "../services/api";

const PAGE_SIZE = 3;
const CLINIC_LIST_SIZE = 10;

export function ConsultaPetsPage() {
  const { session } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const tutor = isTutor(session);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [especieFiltro, setEspecieFiltro] = useState("");
  const [vacinaFiltro, setVacinaFiltro] = useState("");
  const [busca, setBusca] = useState(() => ({ nome: "", cpf: "" }));
  const [listaPagina, setListaPagina] = useState(0);
  const [petId, setPetId] = useState<number | null>(null);
  const [modo, setModo] = useState<"info" | "vacinas" | "editar" | null>(null);
  const [pagina, setPagina] = useState(0);
  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [cadastroErro, setCadastroErro] = useState("");
  const [especieId, setEspecieId] = useState("");
  const [editarErro, setEditarErro] = useState("");
  const [editarEspecieId, setEditarEspecieId] = useState("");

  const lista = useQuery({
    queryKey: ["consulta-pets", busca, listaPagina, tutor],
    enabled: busca != null,
    queryFn: () =>
      api.consultarPets({
        ...(busca ?? { nome: "", cpf: "" }),
        page: listaPagina,
        size: tutor ? 100 : CLINIC_LIST_SIZE,
      }),
  });
  const detalhe = useQuery({
    queryKey: ["pet", petId],
    enabled: petId != null && modo != null,
    queryFn: () => api.pet(petId!),
  });
  const especies = useQuery({
    queryKey: ["especies"],
    queryFn: () => http<{ id: number; nome: string }[]>("/api/catalogos/especies"),
    enabled: tutor,
  });
  const racas = useQuery({
    queryKey: ["racas", especieId],
    enabled: tutor && Boolean(especieId),
    queryFn: () => http<{ id: number; nome: string }[]>(`/api/catalogos/racas?especieId=${especieId}`),
  });
  const racasEdicao = useQuery({
    queryKey: ["racas", editarEspecieId],
    enabled: tutor && modo === "editar" && Boolean(editarEspecieId),
    queryFn: () => http<{ id: number; nome: string }[]>(`/api/catalogos/racas?especieId=${editarEspecieId}`),
  });
  const cadastrar = useMutation({
    mutationFn: async (payload: { body: Record<string, unknown>; foto: File | null }) => {
      const pet = await http<{ id: number }>("/api/pets", { method: "POST", json: payload.body });
      if (payload.foto) {
        try {
          await uploadPerfilFoto({ alvo: "pet", arquivo: payload.foto, petId: pet.id });
        } catch (err) {
          toast.push(
            err instanceof Error
              ? `Pet cadastrado, mas a foto não foi salva: ${err.message}`
              : "Pet cadastrado, mas a foto não foi salva. Edite o pet e envie de novo.",
          );
        }
      }
      return pet;
    },
    onSuccess: async () => {
      toast.push("Pet cadastrado na sua conta.");
      setCadastroAberto(false);
      setCadastroErro("");
      setEspecieId("");
      await queryClient.invalidateQueries({ queryKey: ["consulta-pets"] });
      await queryClient.invalidateQueries({ queryKey: ["pets"] });
    },
  });
  const editar = useMutation({
    mutationFn: async (payload: { id: number; body: Record<string, unknown>; foto: File | null }) => {
      await http(`/api/perfil/pets/${payload.id}`, { method: "PUT", json: payload.body });
      if (payload.foto) {
        await uploadPerfilFoto({ alvo: "pet", arquivo: payload.foto, petId: payload.id });
      }
    },
    onSuccess: async () => {
      toast.push("Dados do pet atualizados.");
      setEditarErro("");
      setModo(null);
      setPetId(null);
      setEditarEspecieId("");
      await queryClient.invalidateQueries({ queryKey: ["consulta-pets"] });
      await queryClient.invalidateQueries({ queryKey: ["pets"] });
      await queryClient.invalidateQueries({ queryKey: ["pet"] });
    },
  });

  const rows = lista.data?.items ?? [];
  const totalPets = lista.data?.total ?? rows.length;
  const totalListaPaginas = Math.max(1, lista.data?.totalPages ?? 1);
  const especiesDisponiveis = useMemo(() => {
    const set = new Set(rows.map((item) => item.especie).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);
  const filtrados = useMemo(() => {
    return rows.filter((item) => {
      if (especieFiltro && item.especie !== especieFiltro) return false;
      if (vacinaFiltro && (item.vacinasStatus ?? "SEM_REGISTRO") !== vacinaFiltro) return false;
      return true;
    });
  }, [especieFiltro, rows, vacinaFiltro]);
  const atendimentos = detalhe.data?.atendimentos ?? [];
  const totalPaginas = Math.max(1, Math.ceil(atendimentos.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const cards = useMemo(
    () => atendimentos.slice(paginaAtual * PAGE_SIZE, paginaAtual * PAGE_SIZE + PAGE_SIZE),
    [atendimentos, paginaAtual],
  );

  useEffect(() => {
    if (modo === "editar" && detalhe.data) {
      setEditarEspecieId(detalhe.data.especieId ? String(detalhe.data.especieId) : "");
    }
  }, [modo, detalhe.data]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    setListaPagina(0);
    setBusca({ nome: nome.trim(), cpf: cpf.replace(/\D/g, "") });
  }

  function limparFiltros() {
    setNome("");
    setCpf("");
    setEspecieFiltro("");
    setVacinaFiltro("");
    setListaPagina(0);
    setBusca({ nome: "", cpf: "" });
  }

  function abrirCadastro() {
    setCadastroErro("");
    setCadastroAberto(true);
  }

  function abrir(id: number, proximo: "info" | "vacinas" | "editar") {
    setPetId(id);
    setModo(proximo);
    setPagina(0);
    setEditarErro("");
  }

  function fechar() {
    setModo(null);
    setPetId(null);
    setPagina(0);
    setEditarErro("");
    setEditarEspecieId("");
  }

  const exportCols = [
    { header: "Pet", value: (row: ConsultaPet) => row.nome },
    { header: "Espécie", value: (row: ConsultaPet) => row.especie },
    { header: "Raça", value: (row: ConsultaPet) => row.raca ?? "" },
    { header: "Tutor", value: (row: ConsultaPet) => row.tutor },
    { header: "E-mail", value: (row: ConsultaPet) => row.tutorEmail ?? "" },
    { header: "Idade", value: (row: ConsultaPet) => idadeLabel(row.nascimento) ?? "Não informada" },
    { header: "Vacinas", value: (row: ConsultaPet) => vacinasLabel(row.vacinasStatus) },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={tutor ? "Família" : "Consulta"}
        title={
          <span className="inline-flex items-center gap-2">
            {tutor ? <PawPrint className="size-7 text-[#7828c8]" /> : null}
            {tutor ? "Meus pets" : "Consulta de pets"}
          </span>
        }
        description={
          tutor
            ? "Veja, edite e acompanhe os pets da sua conta, o prontuário e a vacinação."
            : "Pets com atendimento ou agendamento nesta clínica. Busque pelo nome ou CPF do tutor."
        }
        actions={
          tutor ? (
            <Button type="button" onClick={abrirCadastro} className="!rounded-full">
              <PawPrint className="size-4" />
              + Cadastrar pet
            </Button>
          ) : undefined
        }
      />

      <form
        onSubmit={onSearch}
        className="mb-6 grid gap-3 rounded-3xl border border-[#ebe4f4] bg-white p-4 shadow-sm sm:p-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto] md:items-end"
      >
        <label className="min-w-0">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[#8b7fa3]">
            <Search className="size-3.5" /> Nome do pet
          </span>
          <input
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            placeholder="Ex.: Thor"
            className="h-11 w-full rounded-xl border border-[#ebe4f4] bg-[#faf8fc] px-3 text-sm outline-none focus:border-[#7828c8]/40 focus:bg-white"
          />
        </label>

        {tutor ? (
          <label className="min-w-0">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[#8b7fa3]">
              <PawPrint className="size-3.5" /> Espécie
            </span>
            <select
              value={especieFiltro}
              onChange={(event) => setEspecieFiltro(event.target.value)}
              className="h-11 w-full rounded-xl border border-[#ebe4f4] bg-[#faf8fc] px-3 text-sm outline-none"
            >
              <option value="">Todas</option>
              {especiesDisponiveis.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-[#8b7fa3]">CPF do tutor</span>
            <input
              value={cpf}
              onChange={(event) => setCpf(formatCpf(event.target.value))}
              inputMode="numeric"
              placeholder="000.000.000-00"
              autoComplete="off"
              className="h-11 w-full rounded-xl border border-[#ebe4f4] bg-[#faf8fc] px-3 text-sm outline-none"
            />
          </label>
        )}

        {tutor ? (
          <label className="min-w-0">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[#8b7fa3]">
              <ShieldCheck className="size-3.5" /> Status de vacinação
            </span>
            <select
              value={vacinaFiltro}
              onChange={(event) => setVacinaFiltro(event.target.value)}
              className="h-11 w-full rounded-xl border border-[#ebe4f4] bg-[#faf8fc] px-3 text-sm outline-none"
            >
              <option value="">Todos</option>
              <option value="EM_DIA">Vacinas em dia</option>
              <option value="ATRASADA">Vacinas atrasadas</option>
              <option value="SEM_REGISTRO">Sem registro</option>
            </select>
          </label>
        ) : (
          <div className="hidden md:block" />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" busy={lista.isFetching} busyLabel="Buscando…" className="!rounded-full">
            <Search className="size-4" />
            Buscar
          </Button>
          <button type="button" onClick={limparFiltros} className="text-sm font-medium text-[#7828c8] hover:underline">
            Limpar
          </button>
        </div>
      </form>

      {lista.isError ? (
        <ErrorState message={lista.error instanceof HttpError ? lista.error.message : "Não foi possível consultar os pets"} />
      ) : null}

      {busca == null ? (
        <EmptyState
          title="Faça uma busca para começar"
          description="Informe o nome do pet ou o CPF do tutor e clique em Buscar."
        />
      ) : lista.isLoading ? (
        <LoadingState label="Buscando pets…" />
      ) : !rows.length && tutor ? (
        <PetsEmptyState onCadastrar={abrirCadastro} />
      ) : !filtrados.length ? (
        <EmptyState
          title="Nenhum resultado encontrado"
          description={
            tutor
              ? "Não encontramos pets com esses filtros. Tente ajustar ou limpar a pesquisa."
              : "Não encontramos pets com a busca informada. Tente outro nome ou confira o CPF digitado."
          }
          onClear={limparFiltros}
        />
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[#1f1630]">
              {tutor ? "Seus pets" : "Pets encontrados"} ({tutor ? filtrados.length : totalPets})
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className="!rounded-full"
                onClick={() =>
                  exportTable("excel", {
                    filename: tutor ? "meus-pets" : "consulta-pets",
                    title: tutor ? "Meus pets" : "Consulta de pets",
                    columns: exportCols,
                    rows: filtrados,
                  })
                }
              >
                <FileSpreadsheet className="size-4" />
                Excel
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="!rounded-full"
                onClick={() =>
                  exportTable("pdf", {
                    filename: tutor ? "meus-pets" : "consulta-pets",
                    title: tutor ? "Meus pets" : "Consulta de pets",
                    columns: exportCols,
                    rows: filtrados,
                  })
                }
              >
                <FileText className="size-4" />
                PDF
              </Button>
            </div>
          </div>

          <ul className="space-y-3">
            {filtrados.map((pet) => (
              <PetCard
                key={pet.id}
                pet={pet}
                tutorMode={tutor}
                onInfo={() => abrir(pet.id, "info")}
                onVacinas={() => abrir(pet.id, "vacinas")}
                onEditar={() => abrir(pet.id, "editar")}
              />
            ))}
          </ul>

          {!tutor && totalListaPaginas > 1 ? (
            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                disabled={listaPagina === 0 || lista.isFetching}
                onClick={() => setListaPagina((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="size-4" /> Anterior
              </Button>
              <p className="text-sm text-muted">
                Página {listaPagina + 1} de {totalListaPaginas}
              </p>
              <Button
                type="button"
                variant="ghost"
                disabled={listaPagina >= totalListaPaginas - 1 || lista.isFetching}
                onClick={() => setListaPagina((p) => Math.min(totalListaPaginas - 1, p + 1))}
              >
                Próxima <ChevronRight className="size-4" />
              </Button>
            </div>
          ) : null}
        </section>
      )}

      <Modal open={modo === "info"} title={detalhe.data?.nome ?? "Informações do pet"} onClose={fechar} wide>
        {detalhe.isLoading ? <LoadingState label="Carregando prontuário…" /> : null}
        {detalhe.error ? (
          <ErrorState message={detalhe.error instanceof HttpError ? detalhe.error.message : "Não foi possível abrir o pet"} />
        ) : null}
        {detalhe.data ? (
          <PetInfoModal data={detalhe.data} cards={cards} pagina={paginaAtual} totalPaginas={totalPaginas} onPage={setPagina} />
        ) : null}
      </Modal>

      <Modal
        open={modo === "editar"}
        title={`Editar · ${detalhe.data?.nome ?? "Pet"}`}
        onClose={fechar}
        footer={
          <Button type="submit" form="consulta-pet-editar" busy={editar.isPending} busyLabel="Salvando…">
            Salvar alterações
          </Button>
        }
      >
        {detalhe.isLoading ? <LoadingState label="Carregando pet…" /> : null}
        {detalhe.error ? (
          <ErrorState message={detalhe.error instanceof HttpError ? detalhe.error.message : "Não foi possível abrir o pet"} />
        ) : null}
        {detalhe.data ? (
          <form
            id="consulta-pet-editar"
            key={detalhe.data.id}
            className="grid gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const pesoRaw = String(data.get("peso") ?? "").trim();
              setEditarErro("");
              editar.mutate(
                {
                  id: detalhe.data!.id,
                  body: {
                    nome: String(data.get("nome")),
                    sexo: String(data.get("sexo")),
                    especieId: Number(data.get("especieId")),
                    racaId: data.get("racaId") ? Number(data.get("racaId")) : null,
                    dataAniversario: String(data.get("dataAniversario") || "") || null,
                    peso: pesoRaw ? Number(pesoRaw.replace(",", ".")) : null,
                  },
                  foto: fileFromForm(data),
                },
                {
                  onError: (err) => setEditarErro(err instanceof HttpError ? err.message : "Não foi possível salvar o pet"),
                },
              );
            }}
          >
            <FormSection title="Foto">
              <div className="flex items-center gap-4 sm:col-span-2">
                <PetPhoto
                  especie={detalhe.data.especie}
                  seed={detalhe.data.id}
                  src={detalhe.data.fotoUrl}
                  className="size-20 rounded-2xl"
                />
                <div className="min-w-0 flex-1">
                  <PhotoFileField label="Nova foto do pet" hint="Opcional. PNG, JPG ou WEBP até 2 MB." />
                </div>
              </div>
            </FormSection>
            <FormSection title="Dados do pet">
              <Field label="Nome">
                <Input name="nome" required defaultValue={detalhe.data.nome} />
              </Field>
              <Field label="Sexo">
                <Select name="sexo" defaultValue={detalhe.data.sexo || "I"}>
                  <option value="I">Indefinido</option>
                  <option value="M">Macho</option>
                  <option value="F">Fêmea</option>
                </Select>
              </Field>
              <Field label="Espécie">
                <Select
                  name="especieId"
                  required
                  value={editarEspecieId}
                  onChange={(event) => setEditarEspecieId(event.target.value)}
                >
                  <option value="">Selecione</option>
                  {(especies.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Raça">
                <Select
                  name="racaId"
                  defaultValue={detalhe.data.racaId ?? ""}
                  key={`raca-${editarEspecieId}-${detalhe.data.racaId ?? "x"}`}
                >
                  <option value="">Opcional</option>
                  {(racasEdicao.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Nascimento">
                <Input name="dataAniversario" type="date" defaultValue={detalhe.data.nascimento ?? ""} />
              </Field>
              <Field label="Peso (kg)">
                <Input
                  name="peso"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  defaultValue={detalhe.data.peso ?? ""}
                />
              </Field>
            </FormSection>
            {editarErro ? <ErrorState message={editarErro} /> : null}
          </form>
        ) : null}
      </Modal>

      <Modal
        open={cadastroAberto}
        title="Cadastrar pet"
        onClose={() => setCadastroAberto(false)}
        footer={
          <Button type="submit" form="consulta-pet-novo" busy={cadastrar.isPending} busyLabel="Salvando…">
            Salvar
          </Button>
        }
      >
        <form
          id="consulta-pet-novo"
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setCadastroErro("");
            cadastrar.mutate(
              {
                body: {
                  especieId: Number(data.get("especieId")),
                  racaId: data.get("racaId") ? Number(data.get("racaId")) : null,
                  nome: String(data.get("nome")),
                  sexo: String(data.get("sexo")),
                  dataAniversario: String(data.get("dataAniversario") || ""),
                },
                foto: fileFromForm(data),
              },
              {
                onError: (err) => setCadastroErro(err instanceof HttpError ? err.message : "Não foi possível cadastrar o pet"),
              },
            );
          }}
        >
          <FormSection title="Dados do pet">
            <Field label="Nome">
              <Input name="nome" required />
            </Field>
            <Field label="Sexo">
              <Select name="sexo" defaultValue="I">
                <option value="I">Indefinido</option>
                <option value="M">Macho</option>
                <option value="F">Fêmea</option>
              </Select>
            </Field>
            <Field label="Espécie">
              <Select name="especieId" required value={especieId} onChange={(event) => setEspecieId(event.target.value)}>
                <option value="">Selecione</option>
                {(especies.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Raça">
              <Select name="racaId">
                <option value="">Opcional</option>
                {(racas.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nascimento">
              <Input name="dataAniversario" type="date" />
            </Field>
            <div className="sm:col-span-2">
              <PhotoFileField label="Foto do pet" />
            </div>
          </FormSection>
          {cadastroErro ? <ErrorState message={cadastroErro} /> : null}
        </form>
      </Modal>

      <Modal open={modo === "vacinas"} title={`Vacinações · ${detalhe.data?.nome ?? "Pet"}`} onClose={fechar} wide>
        {detalhe.isLoading ? <LoadingState label="Carregando vacinações…" /> : null}
        {detalhe.error ? (
          <ErrorState message={detalhe.error instanceof HttpError ? detalhe.error.message : "Não foi possível abrir as vacinações"} />
        ) : null}
        {detalhe.data ? <VacinasModal data={detalhe.data} /> : null}
      </Modal>
    </div>
  );
}

function sexoSimbolo(sexo?: string | null): string {
  if (sexo === "M") return "♂";
  if (sexo === "F") return "♀";
  return "";
}

function vacinasLabel(status?: string | null): string {
  if (status === "EM_DIA") return "Vacinas em dia";
  if (status === "ATRASADA") return "Vacinas atrasadas";
  return "Sem registro de vacinas";
}

function PetsEmptyState({ onCadastrar }: { onCadastrar: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-[#d9cceb] bg-[#fbf8ff] px-6 py-12 text-center">
      <span className="inline-flex size-16 items-center justify-center rounded-full bg-white text-[#7828c8] shadow-sm ring-1 ring-[#ebe4f4]">
        <PawPrint className="size-8" />
      </span>
      <p className="mt-5 max-w-md text-sm leading-relaxed text-[#6e6680]">
        Você ainda não tem nenhum pet cadastrado. Clique no botão &quot;+ Cadastrar pet&quot; para adicionar seu primeiro amigo.
      </p>
      <Button type="button" onClick={onCadastrar} className="mt-6 !rounded-full">
        <PawPrint className="size-4" />
        + Cadastrar pet
      </Button>
    </div>
  );
}

function PetCard({
  pet,
  tutorMode,
  onInfo,
  onVacinas,
  onEditar,
}: {
  pet: ConsultaPet;
  tutorMode: boolean;
  onInfo: () => void;
  onVacinas: () => void;
  onEditar: () => void;
}) {
  const status = pet.vacinasStatus ?? "SEM_REGISTRO";
  const idade = idadeLabel(pet.nascimento) ?? "Não informada";
  const simbolo = sexoSimbolo(pet.sexo);

  return (
    <li className="rounded-3xl border border-[#ebe4f4] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center">
          <PetPhoto especie={pet.especie} seed={pet.id} src={pet.fotoUrl} className="size-20 shrink-0 rounded-full sm:size-24" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-[#1f1630]">
                {pet.nome}
                {simbolo ? <span className="ml-1 text-[#7828c8]">{simbolo}</span> : null}
              </h3>
              <span className="rounded-full bg-[#f3eafc] px-2.5 py-0.5 text-[11px] font-semibold text-[#7828c8]">
                {pet.especie}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-[#7a738c]">{pet.raca || "Raça não informada"}</p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="flex min-w-0 items-start gap-2 text-sm text-[#5c4d78]">
                <UserRound className="mt-0.5 size-4 shrink-0 text-[#9a90b0]" />
                <span className="min-w-0">
                  <span className="block font-medium text-[#1f1630]">{pet.tutor}</span>
                  <span className="block truncate text-xs text-[#8b7fa3]">{pet.tutorEmail || "Sem e-mail"}</span>
                </span>
              </div>
              <div className="flex items-start gap-2 text-sm text-[#5c4d78]">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-[#9a90b0]" />
                <span>
                  <span className="block text-xs text-[#8b7fa3]">Idade</span>
                  <span className="font-medium text-[#1f1630]">{idade}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end xl:flex-row">
          <VacinaBadge status={status} />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onInfo}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#e4dcf0] px-3 py-2 text-xs font-semibold text-[#5c4d78] hover:bg-[#faf8fc]"
            >
              <Eye className="size-3.5" />
              Ver prontuário
            </button>
            <button
              type="button"
              onClick={onVacinas}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#e4dcf0] px-3 py-2 text-xs font-semibold text-[#5c4d78] hover:bg-[#faf8fc]"
            >
              <Syringe className="size-3.5" />
              Vacinas
            </button>
            {tutorMode ? (
              <button
                type="button"
                onClick={onEditar}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#7828c8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#6a22b4]"
              >
                <Pencil className="size-3.5" />
                Editar
              </button>
            ) : null}
            <button type="button" aria-label="Mais opções" className="inline-flex size-9 items-center justify-center rounded-full text-[#9a90b0] hover:bg-[#f3eafc]">
              <MoreVertical className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function VacinaBadge({ status }: { status: string }) {
  if (status === "EM_DIA") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
        <ShieldCheck className="size-3.5" />
        Vacinas em dia
      </span>
    );
  }
  if (status === "ATRASADA") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
        <ShieldAlert className="size-3.5" />
        Vacinas atrasadas
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f1f0f4] px-3 py-1.5 text-xs font-semibold text-[#7a738c]">
      <ShieldCheck className="size-3.5" />
      Sem registro
    </span>
  );
}

function PetInfoModal({
  data,
  cards,
  pagina,
  totalPaginas,
  onPage,
}: {
  data: PetDetail;
  cards: PetDetail["atendimentos"];
  pagina: number;
  totalPaginas: number;
  onPage: (value: number) => void;
}) {
  const tags = [
    data.especie,
    data.raca,
    sexoLabel(data.sexo),
    data.peso != null ? `${data.peso} kg` : null,
    idadeLabel(data.nascimento),
  ].filter((item): item is string => Boolean(item));

  return (
    <div className="space-y-5">
      <section className="grid gap-4 rounded-3xl bg-[#faf7ff] p-4 ring-1 ring-violet-100 sm:grid-cols-[11rem_minmax(0,1fr)] dark:bg-zinc-950 dark:ring-zinc-800">
        <PetPhoto especie={data.especie} seed={data.id} src={data.fotoUrl} className="h-44 w-full rounded-2xl sm:h-full" />
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-brand uppercase">Prontuário</p>
          <h3 className="mt-1 text-2xl font-bold">{data.nome}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag} tone="brand">
                {tag}
              </Badge>
            ))}
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Info label="Nascimento" value={data.nascimento ? formatDate(data.nascimento) : "Não informado"} />
            <Info label="Tutor" value={data.tutor} />
            <Info label="E-mail" value={data.tutorEmail || "Não informado"} />
            <Info label="Telefone" value={data.tutorTelefone || "Não informado"} />
            {data.tutorCpf ? <Info label="CPF" value={formatCpf(data.tutorCpf)} /> : null}
          </dl>
        </div>
      </section>

      <section>
        <h3 className="font-semibold">Histórico de atendimentos</h3>
        {!data.atendimentos.length ? (
          <p className="mt-3 text-sm text-muted">Nenhuma visita registrada para este pet.</p>
        ) : (
          <>
            <ul className="mt-3 grid gap-3 sm:grid-cols-3">
              {cards.map((item) => (
                <li key={item.id} className="living-card p-4">
                  <p className="text-xs font-semibold tracking-wide text-brand uppercase">{item.titulo}</p>
                  <p className="mt-2 font-semibold">{formatDate(item.quando)}</p>
                  <p className="mt-2 text-sm text-muted">{item.detalhe || "Sem resumo registrado."}</p>
                </li>
              ))}
            </ul>
            {totalPaginas > 1 ? (
              <div className="mt-4 flex items-center justify-between">
                <Button type="button" variant="ghost" disabled={pagina === 0} onClick={() => onPage(pagina - 1)}>
                  <ChevronLeft className="size-4" /> Anterior
                </Button>
                <p className="text-sm text-muted">
                  {pagina + 1} de {totalPaginas}
                </p>
                <Button type="button" variant="ghost" disabled={pagina >= totalPaginas - 1} onClick={() => onPage(pagina + 1)}>
                  Próxima <ChevronRight className="size-4" />
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function VacinasModal({ data }: { data: PetDetail }) {
  if (!data.vacinacoes.length) {
    return <p className="text-sm text-muted">Nenhuma aplicação registrada para este pet.</p>;
  }
  return (
    <ul className="grid gap-3">
      {data.vacinacoes.map((item) => (
        <li key={item.id} className="living-card p-4">
          <p className="font-semibold">{item.vacina}</p>
          <p className="mt-1 text-sm text-muted">
            Aplicada em {formatDate(item.aplicacao)}
            {item.proxima ? ` · próxima ${formatDate(item.proxima)}` : ""}
          </p>
          {item.lote ? <p className="mt-1 text-xs text-muted">Lote {item.lote}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
