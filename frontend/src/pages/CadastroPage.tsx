import { Building2, PawPrint } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PaymentModal } from "../components/PaymentModal";
import { PageContainer } from "../components/layout/PageContainer";
import { Button } from "../components/ui/Button";
import { PhotoFileField } from "../components/ui/PhotoFileField";
import { http, HttpError } from "../lib/http";
import { fileFromForm, uploadPerfilFoto } from "../lib/perfil-foto";
import { isPlanId } from "../lib/plans";
import { UFS } from "../lib/ufs";
import { homeFor, type Session } from "../lib/session";
import { useAuth } from "../providers/AuthProvider";
import { api } from "../services/api";

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
        Tutores criam a conta de graça. Clínicas assinam o plano mensal da plataforma neste cadastro.
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
            Cadastre a empresa e assine o plano mensal do Flutz (R$ 149,90).
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const data = new FormData(event.currentTarget);
    setError("");
    setLoading(true);
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
        } catch {
          /* cadastro já concluído; a foto pode ser enviada depois */
        }
      }
      navigate(homeFor(session), { replace: true });
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Não foi possível concluir o cadastro.");
    } finally {
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
    </PageContainer>
  );
}

function ClinicSignup({ plan }: { plan: string }) {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");
  const [tokenHint, setTokenHint] = useState("");
  const [tokenPreview, setTokenPreview] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [created, setCreated] = useState<Session | null>(null);
  const [payerCpf, setPayerCpf] = useState("");

  async function conferirToken(codigo: string) {
    const valor = codigo.trim();
    if (!valor) {
      setTokenHint("");
      setTokenPreview("");
      return;
    }
    try {
      const preview = await api.validarToken(valor, plan.toUpperCase());
      setTokenHint("");
      setTokenPreview(
        `Token ${preview.codigo}: ${formatPercent(preview.percentualDesconto)} de desconto. De ${formatMoney(preview.valorBruto)} para ${formatMoney(preview.valor)}.`,
      );
    } catch (err) {
      setTokenPreview("");
      setTokenHint(err instanceof HttpError ? err.message : "Token inválido ou expirado");
    }
  }

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
          codigoToken: token.trim() || null,
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

      // Se o token zerar a fatura, o backend já marca como paga — segue para o app.
      // Caso contrário, abre o mesmo checkout de mensalidade (token + PIX/cartão).
      let precisaPagar = true;
      try {
        const fatura = await api.mensalidade();
        precisaPagar = Boolean(fatura.faturaId) && Number(fatura.valor ?? fatura.valorAPagar ?? 0) > 0;
      } catch {
        precisaPagar = true;
      }

      if (!precisaPagar) {
        navigate(homeFor(session), { replace: true });
        return;
      }

      setCreated(session);
      setPayerCpf(String(data.get("cpfResponsavel") ?? ""));
      setPayOpen(true);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Não foi possível concluir o cadastro.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer className="max-w-3xl py-12 sm:py-16">
      {payOpen && created ? (
        <PaymentModal
          initialCpf={payerCpf}
          onPaid={() => navigate(homeFor(created), { replace: true })}
          onClose={() => navigate("/app/assinatura/pagar", { replace: true })}
        />
      ) : null}
      <h1 className="text-3xl font-bold text-ink dark:text-white">Cadastro da clínica</h1>
      <p className="mt-2 text-sm text-muted">
        Plano mensal Flutz (R$ 149,90). Após criar a conta, você aplica token (se tiver) e paga a primeira fatura com PIX
        ou cartão.
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
        <label className="sm:col-span-2 block text-sm font-medium">
          Token de desconto (opcional)
          <input
            name="codigoToken"
            value={token}
            onChange={(event) => {
              setToken(event.target.value);
              setTokenHint("");
              setTokenPreview("");
            }}
            onBlur={() => conferirToken(token)}
            autoComplete="off"
            placeholder="Se você tiver um cupom, informe aqui"
            className="mt-1 w-full rounded-xl border border-line px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        {tokenPreview ? <p className="sm:col-span-2 text-sm text-brand">{tokenPreview}</p> : null}
        {tokenHint ? <p className="sm:col-span-2 text-sm text-danger">{tokenHint}</p> : null}
        {error ? <p className="sm:col-span-2 text-sm text-danger">{error}</p> : null}
        <div className="sm:col-span-2">
          <Button type="submit" busy={loading} busyLabel="Criando…">
            Criar clínica e pagar
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}

function formatMoney(value: number | string): string {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}

function formatPercent(value: number | string): string {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)}%`;
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
