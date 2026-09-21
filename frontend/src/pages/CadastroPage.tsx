import { Building2, PawPrint } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PageContainer } from "../components/layout/PageContainer";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { PhotoFileField } from "../components/ui/PhotoFileField";
import { http, HttpError } from "../lib/http";
import { fileFromForm, uploadPerfilFoto } from "../lib/perfil-foto";
import { isPlanId } from "../lib/plans";
import { UFS } from "../lib/ufs";
import { homeFor, type Session } from "../lib/session";
import { useAuth } from "../providers/AuthProvider";
import { api, type Mensalidade } from "../services/api";

export function CadastroPage() {
  const [params] = useSearchParams();
  const tipo = params.get("tipo");
  const rawPlan = params.get("plano");
  const plan = isPlanId(rawPlan) ? rawPlan : null;
  const clinicPath = tipo === "clinica" || Boolean(plan);

  if (tipo === "tutor") {
    return <TutorSignup />;
  }

  if (clinicPath && plan) {
    return <ClinicSignup plan={plan} />;
  }

  if (clinicPath) {
    return <ClinicSignup plan="flutz" />;
  }

  return (
    <PageContainer className="max-w-3xl py-12 sm:py-16">
      <h1 className="text-3xl font-bold text-ink dark:text-white">Como você quer entrar no Flutz?</h1>
      <p className="mt-2 text-sm text-muted">
        Tutores criam a conta de graça. Clínicas começam com um período de testes e depois assinam o plano mensal.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          to="/cadastro?tipo=tutor"
          className="flex min-w-0 flex-col rounded-2xl border border-line bg-white p-6 hover:border-brand/40 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <PawPrint className="size-8 text-brand" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-semibold text-ink dark:text-white">Sou tutor</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Cadastro com CPF e senha. Depois você encontra clínicas e pede horários.
          </p>
        </Link>
        <Link
          to="/cadastro?tipo=clinica&plano=flutz"
          className="flex min-w-0 flex-col rounded-2xl border border-brand/30 bg-brand-soft p-6 hover:border-brand dark:border-brand/40 dark:bg-brand/10"
        >
          <Building2 className="size-8 text-brand" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-semibold text-ink dark:text-white">Sou uma clínica</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Cadastre a empresa e teste o Flutz por 14 dias antes da cobrança da assinatura.
          </p>
        </Link>
      </div>
      <p className="mt-8 text-sm text-muted">
        Já tem conta?{" "}
        <Link to="/login" className="font-medium text-brand hover:underline">
          Entrar
        </Link>
      </p>
    </PageContainer>
  );
}

function TutorSignup() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [pendingForm, setPendingForm] = useState<FormData | null>(null);
  const [historicoInfo, setHistoricoInfo] = useState<{
    qtdPets: number;
    qtdAtendimentos: number;
    qtdVacinas: number;
  } | null>(null);

  async function concluirCadastro(data: FormData) {
    setLoading(true);
    setError("");
    try {
      const session = await http<Session>("/api/public/cadastro-tutor", {
        method: "POST",
        json: {
          nome: data.get("nome"),
          cpf: data.get("cpf"),
          email: data.get("email"),
          telefone: data.get("telefone"),
          senha: data.get("senha"),
        },
      });
      await refresh();
      const foto = fileFromForm(data);
      if (foto) {
        try {
          await uploadPerfilFoto({ alvo: "tutor", arquivo: foto });
        } catch (err) {
          console.warn("Foto de perfil não enviada no cadastro", err);
        }
      }
      navigate(homeFor(session), { replace: true });
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Não foi possível concluir o cadastro.");
    } finally {
      setLoading(false);
      setHistoricoOpen(false);
      setPendingForm(null);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const data = new FormData(event.currentTarget);
    setError("");
    setLoading(true);
    try {
      const cpf = String(data.get("cpf") || "");
      const hist = await api.cadastroTutorHistorico(cpf);
      if (hist.temHistorico) {
        setHistoricoInfo({
          qtdPets: hist.qtdPets,
          qtdAtendimentos: hist.qtdAtendimentos,
          qtdVacinas: hist.qtdVacinas,
        });
        setPendingForm(data);
        setHistoricoOpen(true);
        setLoading(false);
        return;
      }
      await concluirCadastro(data);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Não foi possível concluir o cadastro.");
      setLoading(false);
    }
  }

  return (
    <PageContainer className="max-w-lg py-12 sm:py-16">
      <h1 className="text-3xl font-bold text-ink dark:text-white">Cadastro do tutor</h1>
      <p className="mt-2 text-sm text-muted">
        Sem mensalidade da plataforma. Depois de entrar, encontre clínicas próximas e peça um horário.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Field name="nome" label="Seu nome" required />
        <Field name="cpf" label="CPF" required autoComplete="username" />
        <Field name="email" label="E-mail" type="email" autoComplete="email" />
        <Field name="telefone" label="Telefone" />
        <Field name="senha" label="Senha" type="password" required autoComplete="new-password" minLength={8} />
        <div className="sm:col-span-2">
          <PhotoFileField label="Foto de perfil" />
        </div>
        <p className="text-xs text-muted">A senha precisa ter pelo menos 8 caracteres.</p>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" className="w-full" busy={loading} busyLabel="Criando…">
          Criar conta e entrar
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        Já tem cadastro?{" "}
        <Link to="/login" className="font-medium text-brand hover:underline">
          Entrar
        </Link>
        {" · "}
        <Link to="/cadastro?tipo=clinica" className="font-medium text-brand hover:underline">
          Sou uma clínica
        </Link>
      </p>

      <Modal
        open={historicoOpen}
        title="Histórico encontrado"
        onClose={() => {
          if (loading) return;
          setHistoricoOpen(false);
          setPendingForm(null);
        }}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => {
                setHistoricoOpen(false);
                setPendingForm(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              busy={loading}
              busyLabel="Criando…"
              onClick={() => {
                if (pendingForm) void concluirCadastro(pendingForm);
              }}
            >
              Trazer para minha conta
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-ink dark:text-zinc-100">
          Você ainda não possui cadastro, mas há atendimentos realizados com o seu CPF. Gostaria de trazer essas
          informações para sua conta?
        </p>
        {historicoInfo ? (
          <ul className="mt-4 space-y-1 text-sm text-muted">
            <li>Pets: {historicoInfo.qtdPets}</li>
            <li>Atendimentos: {historicoInfo.qtdAtendimentos}</li>
            <li>Vacinas: {historicoInfo.qtdVacinas}</li>
          </ul>
        ) : null}
      </Modal>
    </PageContainer>
  );
}

function ClinicSignup({ plan }: { plan: string }) {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [trialOpen, setTrialOpen] = useState(false);
  const [created, setCreated] = useState<Session | null>(null);
  const [trialInfo, setTrialInfo] = useState<{ valor: number; vencimento: string | null } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const data = new FormData(event.currentTarget);
    setError("");
    setLoading(true);
    try {
      const session = await http<Session>("/api/public/cadastro-clinica", {
        method: "POST",
        json: {
          nomeEmpresa: data.get("nomeEmpresa"),
          razaoSocial: data.get("razaoSocial"),
          cnpj: data.get("cnpj"),
          emailClinica: data.get("emailClinica"),
          telefone: data.get("telefone"),
          cidade: data.get("cidade"),
          uf: data.get("uf"),
          descricao: data.get("descricao"),
          codigoPlano: plan.toUpperCase(),
          nomeResponsavel: data.get("nomeResponsavel"),
          cpfResponsavel: data.get("cpfResponsavel"),
          emailResponsavel: data.get("emailResponsavel"),
          telefoneResponsavel: data.get("telefoneResponsavel"),
          senha: data.get("senha"),
          codigoToken: null,
        },
      });
      await refresh();
      const foto = fileFromForm(data);
      if (foto) {
        try {
          await uploadPerfilFoto({ alvo: "clinica", arquivo: foto });
        } catch {
          /* clínica já criada; a logo pode ser enviada depois */
        }
      }

      let mensalidade: Mensalidade | null = null;
      try {
        mensalidade = await api.mensalidade();
      } catch {
        /* ainda mostramos o modal com fallback */
      }
      const valor =
        Number(mensalidade?.valorAPagar ?? mensalidade?.valor ?? mensalidade?.valorMensal ?? 149.9) || 149.9;
      const vencimento =
        mensalidade?.proximoVencimento ??
        mensalidade?.vencimentoFatura ??
        mensalidade?.dataLimiteAcesso ??
        null;

      setCreated(session);
      setTrialInfo({ valor, vencimento });
      setTrialOpen(true);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Não foi possível concluir o cadastro.");
    } finally {
      setLoading(false);
    }
  }

  function entrarNoPainel() {
    setTrialOpen(false);
    if (created) {
      navigate(homeFor(created), { replace: true });
    }
  }

  return (
    <PageContainer className="max-w-3xl py-12 sm:py-16">
      <h1 className="text-3xl font-bold text-ink dark:text-white">Cadastro da clínica</h1>
      <p className="mt-2 text-sm text-muted">
        Crie a conta da empresa e comece com 14 dias gratuitos para testar o Flutz.
      </p>
      <form onSubmit={onSubmit} className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field name="nomeEmpresa" label="Nome da clínica" required className="sm:col-span-2" />
        <Field name="razaoSocial" label="Razão social" />
        <Field name="cnpj" label="CNPJ" required />
        <Field name="emailClinica" label="E-mail da clínica" type="email" required />
        <Field name="telefone" label="Telefone" />
        <Field name="cidade" label="Cidade" />
        <label className="block text-sm font-medium">
          UF
          <select
            name="uf"
            defaultValue=""
            className="mt-1 w-full rounded-xl border border-line px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Selecione</option>
            {UFS.map((item) => (
              <option key={item.sigla} value={item.sigla}>
                {item.sigla} — {item.nome}
              </option>
            ))}
          </select>
        </label>
        <Field name="descricao" label="Sobre a clínica" className="sm:col-span-2" />
        <div className="sm:col-span-2">
          <PhotoFileField name="foto" label="Logo da clínica" />
        </div>
        <Field name="nomeResponsavel" label="Nome do responsável" required />
        <Field name="cpfResponsavel" label="CPF do responsável" required />
        <Field name="emailResponsavel" label="E-mail de acesso" type="email" required />
        <Field name="telefoneResponsavel" label="Telefone do responsável" />
        <Field name="senha" label="Senha" type="password" required className="sm:col-span-2" minLength={8} />
        {error ? <p className="sm:col-span-2 text-sm text-danger">{error}</p> : null}
        <div className="sm:col-span-2">
          <Button type="submit" busy={loading} busyLabel="Criando…">
            Criar conta
          </Button>
        </div>
      </form>

      <Modal
        open={trialOpen}
        onClose={entrarNoPainel}
        title="Bem-vindo ao Flutz"
        footer={
          <div className="flex justify-end">
            <Button type="button" onClick={entrarNoPainel}>
              Começar a explorar
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="flex justify-center">
            <img
              src="/login-pets.png"
              alt=""
              className="h-36 w-auto max-w-full object-contain sm:h-44"
              draggable={false}
            />
          </div>
          <div className="space-y-3 text-center">
            <p className="text-base font-semibold text-ink dark:text-white">
              Você ganhou 14 dias gratuitos para testar o sistema
            </p>
            <p className="text-sm leading-relaxed text-muted">
              Aproveite o período de avaliação com acesso completo. Depois disso, o sistema fica bloqueado até o
              pagamento de{" "}
              <span className="font-semibold text-ink dark:text-zinc-100">
                {formatMoney(trialInfo?.valor ?? 149.9)}
              </span>{" "}
              da assinatura, a partir de{" "}
              <span className="font-semibold text-ink dark:text-zinc-100">
                {formatDateBr(trialInfo?.vencimento)}
              </span>
              .
            </p>
          </div>
          <div className="rounded-2xl border border-brand/20 bg-brand-soft/60 px-4 py-3 text-center dark:border-brand/30 dark:bg-brand/10">
            <p className="text-xs font-medium uppercase tracking-wide text-brand">Período de testes</p>
            <p className="mt-1 text-sm text-ink dark:text-zinc-200">
              14 dias · cobrança a partir de {formatDateBr(trialInfo?.vencimento)}
            </p>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}

function formatMoney(value: number | string): string {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}

function formatDateBr(iso: string | null | undefined) {
  if (!iso) return "—";
  const raw = iso.slice(0, 10);
  const [y, m, d] = raw.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function Field({
  name,
  label,
  type = "text",
  required,
  className = "",
  autoComplete,
  minLength,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  className?: string;
  autoComplete?: string;
  minLength?: number;
}) {
  return (
    <label className={`block text-sm font-medium ${className}`.trim()}>
      {label}
      <input
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        className="mt-1 w-full rounded-xl border border-line px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />
    </label>
  );
}
