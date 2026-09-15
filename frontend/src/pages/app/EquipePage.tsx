import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/EmptyState";
import { Field, FormSection, Input, Select, Surface } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { PhotoFileField } from "../../components/ui/PhotoFileField";
import { http, HttpError } from "../../lib/http";
import { fileFromForm, uploadPerfilFoto } from "../../lib/perfil-foto";
import { DIAS_SEMANA } from "../../lib/agenda";
import { useToast } from "../../providers/ToastProvider";
import { api, type AgendaFaixa } from "../../services/api";

type Membro = {
  id: number;
  nome: string;
  email: string;
  cargo: string | null;
  fotoUrl?: string | null;
  papel?: string | null;
  exibirPagina?: boolean;
};
type Papel = { id: number; nome: string };

const ROTULO_PAPEL: Record<string, string> = {
  administrador: "Administrador",
  veterinario: "Veterinário",
  recepcao: "Recepção",
};

function rotuloPapel(valor: string | null | undefined): string {
  if (!valor) return "—";
  return valor
    .split(",")
    .map((parte) => ROTULO_PAPEL[parte.trim().toLowerCase()] ?? parte.trim())
    .join(", ");
}

export function EquipePage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [gradeId, setGradeId] = useState<number | null>(null);
  const [paginaConfirm, setPaginaConfirm] = useState<{ membro: Membro; exibir: boolean } | null>(null);
  const [error, setError] = useState("");
  const lista = useQuery({ queryKey: ["equipe"], queryFn: () => http<Membro[]>("/api/equipe") });
  const papeis = useQuery({ queryKey: ["papeis"], queryFn: () => http<Papel[]>("/api/catalogos/papeis") });
  const criar = useMutation({
    mutationFn: async (payload: { body: Record<string, string>; foto: File | null }) => {
      const membro = await http<Membro>("/api/equipe", { method: "POST", json: payload.body });
      if (payload.foto) {
        try {
          await uploadPerfilFoto({ alvo: "colaborador", arquivo: payload.foto, colaboradorId: membro.id });
        } catch {
          /* colaborador já criado */
        }
      }
      return membro;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipe"] });
      setOpen(false);
      toast.push("Colaborador cadastrado.");
    },
  });

  const paginaPublica = useMutation({
    mutationFn: ({ id, exibir }: { id: number; exibir: boolean }) =>
      api.saveVisibilidade({ tipo: "EQUIPE", id, visivel: exibir }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["equipe"] });
      queryClient.invalidateQueries({ queryKey: ["pagina"] });
      setPaginaConfirm(null);
      toast.push(vars.exibir ? "Colaborador exibido na página pública." : "Colaborador removido da página pública.");
    },
    onError: (err) => {
      toast.push(err instanceof HttpError ? err.message : "Não foi possível atualizar a página pública.", "danger");
    },
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    try {
      await criar.mutateAsync({
        body: {
          nome: String(data.get("nome")),
          cpf: String(data.get("cpf")),
          email: String(data.get("email")),
          telefone: String(data.get("telefone")),
          senha: String(data.get("senha")),
          cargo: String(data.get("cargo")),
          papel: String(data.get("papel")),
        },
        foto: fileFromForm(data),
      });
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Falha ao cadastrar colaborador");
    }
  }

  if (lista.isLoading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Equipe e horários"
        description="Cada profissional tem a própria grade. Use o botão da página pública para exibir o colaborador no site da clínica."
        actions={<Button onClick={() => setOpen(true)}>+ Novo colaborador</Button>}
      />
      {!lista.data?.length ? (
        <EmptyState
          title="Nenhum colaborador além do cadastro inicial"
          description="Convide a equipe para dividir agenda e atendimentos."
          action={<Button onClick={() => setOpen(true)}>Cadastrar</Button>}
        />
      ) : (
        <DataTable
          rows={lista.data}
          exportTitle="Equipe da clínica"
          exportColumns={[
            { header: "Nome", value: (row) => row.nome },
            { header: "E-mail", value: (row) => row.email },
            { header: "Cargo", value: (row) => row.cargo },
            { header: "Papel", value: (row) => rotuloPapel(row.papel) },
            { header: "Página pública", value: (row) => (row.exibirPagina ? "Sim" : "Não") },
          ]}
          columns={[
            {
              key: "nome",
              header: "Colaborador",
              cell: (row) => (
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={row.nome} src={row.fotoUrl} />
                  <div className="min-w-0">
                    <p className="font-medium">{row.nome}</p>
                    <p className="truncate text-xs text-muted">{row.email}</p>
                  </div>
                </div>
              ),
            },
            { key: "cargo", header: "Cargo", cell: (row) => row.cargo || "—" },
            { key: "papel", header: "Papel", cell: (row) => rotuloPapel(row.papel) },
            {
              key: "pagina",
              header: "Site público",
              cell: (row) => (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    row.exibirPagina ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {row.exibirPagina ? "Na página" : "Fora da página"}
                </span>
              ),
            },
            {
              key: "acoes",
              header: "Ações",
              cell: (row) => (
                <div className="flex flex-wrap gap-2 whitespace-nowrap">
                  <Button onClick={() => setPaginaConfirm({ membro: row, exibir: !row.exibirPagina })}>
                    {row.exibirPagina ? "Tirar do site" : "Colocar no site"}
                  </Button>
                  <Button variant="secondary" onClick={() => setGradeId(row.id)}>
                    Horários
                  </Button>
                </div>
              ),
            },
          ]}
          mobile={(row) => (
            <Surface>
              <div className="flex items-center gap-3">
                <Avatar name={row.nome} src={row.fotoUrl} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{row.nome}</p>
                  <p className="text-sm text-muted">
                    {row.email}
                    {row.cargo ? ` · ${row.cargo}` : ""}
                    {row.papel ? ` · ${rotuloPapel(row.papel)}` : ""}
                  </p>
                  <p className={`mt-1 text-xs font-semibold ${row.exibirPagina ? "text-emerald-700" : "text-amber-800"}`}>
                    {row.exibirPagina ? "Já está na página pública" : "Ainda não aparece no site"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => setPaginaConfirm({ membro: row, exibir: !row.exibirPagina })}>
                  {row.exibirPagina ? "Tirar do site" : "Colocar no site"}
                </Button>
                <Button variant="secondary" onClick={() => setGradeId(row.id)}>
                  Definir horários
                </Button>
              </div>
            </Surface>
          )}
        />
      )}
      <Modal
        open={open}
        title="Novo colaborador"
        onClose={() => setOpen(false)}
        footer={
          <Button type="submit" form="equipe-form" busy={criar.isPending} busyLabel="Cadastrando…">
            Cadastrar
          </Button>
        }
      >
        <form id="equipe-form" onSubmit={onSubmit} className="grid gap-5">
          <FormSection title="Dados">
            <Field label="Nome">
              <Input name="nome" required />
            </Field>
            <Field label="CPF">
              <Input name="cpf" required />
            </Field>
            <Field label="E-mail de acesso">
              <Input name="email" type="email" required />
            </Field>
            <Field label="Telefone">
              <Input name="telefone" />
            </Field>
          </FormSection>
          <FormSection title="Função">
            <Field label="Cargo" hint="Ex.: Veterinário clínico, Recepcionista">
              <Input name="cargo" />
            </Field>
            <Field label="Papel de acesso" hint="Define o que a pessoa pode fazer no sistema">
              <Select name="papel" required disabled={papeis.isLoading || !(papeis.data ?? []).length}>
                <option value="">
                  {papeis.isLoading
                    ? "Carregando papéis…"
                    : !(papeis.data ?? []).length
                      ? "Nenhum papel disponível"
                      : "Selecione o papel"}
                </option>
                {(papeis.data ?? []).map((papel) => (
                  <option key={papel.id} value={papel.nome}>
                    {rotuloPapel(papel.nome)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Senha">
              <Input name="senha" type="password" required minLength={8} />
            </Field>
            <div className="sm:col-span-2">
              <PhotoFileField label="Foto do colaborador" />
            </div>
          </FormSection>
          {error ? <ErrorState message={error} /> : null}
        </form>
      </Modal>

      <Modal
        open={!!paginaConfirm}
        title={paginaConfirm?.exibir ? "Exibir na página pública?" : "Remover da página pública?"}
        onClose={() => setPaginaConfirm(null)}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setPaginaConfirm(null)} disabled={paginaPublica.isPending}>
              Cancelar
            </Button>
            <Button
              busy={paginaPublica.isPending}
              busyLabel="Salvando…"
              onClick={() => {
                if (!paginaConfirm) return;
                paginaPublica.mutate({ id: paginaConfirm.membro.id, exibir: paginaConfirm.exibir });
              }}
            >
              {paginaConfirm?.exibir ? "Sim, exibir" : "Sim, remover"}
            </Button>
          </div>
        }
      >
        {paginaConfirm ? (
          <p className="text-sm text-[#4a4258]">
            {paginaConfirm.exibir ? (
              <>
                Confirma exibir <strong>{paginaConfirm.membro.nome}</strong> na seção de equipe da página pública da
                clínica? Nome, cargo e foto ficarão visíveis para visitantes.
              </>
            ) : (
              <>
                Confirma remover <strong>{paginaConfirm.membro.nome}</strong> da página pública? A pessoa continua na
                equipe interna, só deixa de aparecer no site.
              </>
            )}
          </p>
        ) : null}
      </Modal>

      {gradeId ? (
        <GradeModal
          colaboradorId={gradeId}
          nome={lista.data?.find((item) => item.id === gradeId)?.nome ?? "Profissional"}
          onClose={() => setGradeId(null)}
        />
      ) : null}
    </div>
  );
}

function GradeModal({ colaboradorId, nome, onClose }: { colaboradorId: number; nome: string; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [faixas, setFaixas] = useState<AgendaFaixa[] | null>(null);
  const [erro, setErro] = useState("");
  const atual = useQuery({
    queryKey: ["equipe-horarios", colaboradorId],
    queryFn: () => api.equipeHorarios(colaboradorId),
  });
  const visiveis = faixas ?? atual.data ?? [];
  const salvar = useMutation({
    mutationFn: (body: AgendaFaixa[]) => api.saveEquipeHorarios(colaboradorId, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["equipe-horarios", colaboradorId] });
      toast.push("Grade salva. A agenda do tutor usa estes horários.");
      onClose();
    },
  });

  return (
    <Modal
      open
      title={`Horários de ${nome}`}
      onClose={onClose}
      footer={
        <Button
          onClick={() => {
            setErro("");
            salvar.mutate(
              visiveis.map((item) => ({
                diaSemana: Number(item.diaSemana),
                inicio: item.inicio.length === 5 ? `${item.inicio}:00` : item.inicio,
                fim: item.fim.length === 5 ? `${item.fim}:00` : item.fim,
              })),
            );
          }}
          busy={salvar.isPending}
          busyLabel="Salvando…"
        >
          Salvar grade
        </Button>
      }
    >
      <p className="mb-4 text-sm text-muted">
        Segunda = 1 … domingo = 7. Se ninguém tiver grade neste dia, o tutor não vê horários.
      </p>
      <Button
        variant="secondary"
        className="mb-3"
        onClick={() => setFaixas([...visiveis, { diaSemana: 1, inicio: "08:00", fim: "18:00" }])}
      >
        + Faixa
      </Button>
      {visiveis.map((faixa, index) => (
        <div key={`${faixa.diaSemana}-${index}`} className="mb-2 grid gap-2 sm:grid-cols-[1fr_7rem_7rem_auto]">
          <select
            className="rounded-xl border border-line px-3 py-2 text-sm"
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
          <Button variant="ghost" onClick={() => setFaixas(visiveis.filter((_, i) => i !== index))}>
            Remover
          </Button>
        </div>
      ))}
      {erro || salvar.error instanceof HttpError ? (
        <ErrorState message={erro || (salvar.error instanceof HttpError ? salvar.error.message : "")} />
      ) : null}
    </Modal>
  );
}
