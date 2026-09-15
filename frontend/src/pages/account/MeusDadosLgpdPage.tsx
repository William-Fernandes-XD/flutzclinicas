import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BellOff,
  CheckCircle2,
  Download,
  Eye,
  FilePenLine,
  Shield,
  Trash2,
  UserRoundX,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ErrorState, LoadingState } from "../../components/ui/EmptyState";
import { Field, Surface, Textarea } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { HttpError } from "../../lib/http";
import { useToast } from "../../providers/ToastProvider";
import {
  api,
  type PacotePortabilidade,
  type SolicitacaoLgpd,
  type TipoSolicitacaoLgpd,
} from "../../services/api";

const DIREITOS: {
  tipo: TipoSolicitacaoLgpd;
  titulo: string;
  descricao: string;
  Icon: LucideIcon;
  download?: "acesso" | "portabilidade";
  alerta?: boolean;
}[] = [
  { tipo: "ACESSO", titulo: "Confirmar acesso", descricao: "Veja quais categorias de dados tratamos.", Icon: Eye, download: "acesso" },
  { tipo: "PORTABILIDADE", titulo: "Baixar meus dados", descricao: "Receba uma cópia estruturada em JSON.", Icon: Download, download: "portabilidade" },
  { tipo: "CORRECAO", titulo: "Pedir correção", descricao: "Informe o dado que precisa ser corrigido.", Icon: FilePenLine },
  { tipo: "REVOGACAO_CONSENTIMENTO", titulo: "Revogar notificações", descricao: "Interrompa comunicações não essenciais.", Icon: BellOff },
  { tipo: "ANONIMIZACAO", titulo: "Solicitar anonimização", descricao: "Peça a remoção dos seus identificadores.", Icon: UserRoundX, alerta: true },
  { tipo: "EXCLUSAO", titulo: "Solicitar exclusão", descricao: "A exclusão é atendida por anonimização dos registros.", Icon: Trash2, alerta: true },
];

export function MeusDadosLgpdPage() {
  const toast = useToast();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [selecionado, setSelecionado] = useState<(typeof DIREITOS)[number] | null>(null);
  const [detalhamento, setDetalhamento] = useState("");
  const [erro, setErro] = useState("");
  const solicitacoes = useQuery({ queryKey: ["lgpd", "solicitacoes"], queryFn: api.lgpdSolicitacoes });

  const criar = useMutation({
    mutationFn: () =>
      api.criarSolicitacaoLgpd({
        tipoSolicitacao: selecionado!.tipo,
        detalhamento: detalhamento.trim() || undefined,
      }),
    meta: { skipErrorToast: true },
    onSuccess: async () => {
      toast.push("Solicitação LGPD registrada.");
      setSelecionado(null);
      setDetalhamento("");
      setErro("");
      await queryClient.invalidateQueries({ queryKey: ["lgpd", "solicitacoes"] });
    },
    onError: (error) => setErro(error instanceof HttpError ? error.message : "Não foi possível registrar a solicitação."),
  });

  const baixar = useMutation({
    mutationFn: async (tipo: "acesso" | "portabilidade") => ({
      tipo,
      dados: tipo === "acesso" ? await api.lgpdAcesso() : await api.lgpdExportacao(),
    }),
    onSuccess: async ({ tipo, dados }) => {
      downloadJson(dados, tipo === "acesso" ? "acesso-aos-meus-dados.json" : "portabilidade-flutz.json");
      toast.push("Arquivo JSON preparado.");
      await queryClient.invalidateQueries({ queryKey: ["lgpd", "solicitacoes"] });
    },
  });

  const configuracoes = location.pathname.startsWith("/cliente") ? "/cliente/configuracoes" : "/app/configuracoes";

  return (
    <div className="space-y-7">
      <PageHeader
        title="Meus dados (LGPD)"
        description="Consulte, corrija, exporte ou solicite a anonimização dos seus dados pessoais."
      />

      <Surface className="bg-gradient-to-br from-brand-soft/80 to-white dark:to-zinc-950">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white">
            <Shield className="size-6" />
          </span>
          <div>
            <h2 className="font-semibold text-ink dark:text-white">Você controla seus dados</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Pela LGPD, você pode confirmar o tratamento, acessar, corrigir, portar, anonimizar ou revogar
              consentimentos. Pedidos que exigem análise são respondidos em até 15 dias.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm font-medium text-brand">
              <Link to="/privacidade" className="hover:underline">Política de Privacidade</Link>
              <Link to={configuracoes} className="hover:underline">Corrigir meus dados na conta</Link>
            </div>
          </div>
        </div>
      </Surface>

      <section>
        <h2 className="mb-3 text-sm font-bold tracking-wide text-muted uppercase">Exerça seus direitos</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {DIREITOS.map((item) => (
            <button
              key={item.tipo}
              type="button"
              className="living-card group p-5 text-left transition hover:border-brand/40"
              onClick={() => {
                if (item.download) baixar.mutate(item.download);
                else {
                  setErro("");
                  setDetalhamento("");
                  setSelecionado(item);
                }
              }}
            >
              <span className={`flex size-11 items-center justify-center rounded-xl ${item.alerta ? "bg-red-50 text-red-600 dark:bg-red-950/40" : "bg-brand-soft text-brand"}`}>
                <item.Icon className="size-5" />
              </span>
              <p className="mt-4 font-semibold text-ink group-hover:text-brand dark:text-white">{item.titulo}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{item.descricao}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="living-card overflow-hidden">
        <div className="border-b border-line px-5 py-4 dark:border-zinc-800">
          <h2 className="font-semibold">Solicitações anteriores</h2>
          <p className="mt-1 text-sm text-muted">Acompanhe o status e o prazo de cada protocolo.</p>
        </div>
        <div className="p-5">
          {solicitacoes.isLoading ? (
            <LoadingState label="Carregando solicitações…" />
          ) : solicitacoes.isError ? (
            <ErrorState message="Não foi possível carregar suas solicitações." />
          ) : !(solicitacoes.data ?? []).length ? (
            <div className="py-8 text-center text-sm text-muted">
              <CheckCircle2 className="mx-auto mb-3 size-8 text-brand" />
              Nenhuma solicitação registrada.
            </div>
          ) : (
            <ul className="divide-y divide-line dark:divide-zinc-800">
              {(solicitacoes.data ?? []).map((item) => <SolicitacaoCard key={item.id} item={item} />)}
            </ul>
          )}
        </div>
      </section>

      <Modal open={selecionado != null} title={selecionado?.titulo ?? "Solicitação LGPD"} onClose={() => setSelecionado(null)}>
        {selecionado ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (selecionado.tipo === "CORRECAO" && !detalhamento.trim()) {
                setErro("Descreva o dado que precisa ser corrigido.");
                return;
              }
              criar.mutate();
            }}
          >
            <p className="text-sm leading-relaxed text-muted">{selecionado.descricao}</p>
            <Field label={selecionado.tipo === "CORRECAO" ? "Detalhamento" : "Detalhamento (opcional)"}>
              <Textarea
                value={detalhamento}
                onChange={(event) => setDetalhamento(event.target.value)}
                maxLength={4000}
                rows={5}
                required={selecionado.tipo === "CORRECAO"}
                placeholder="Inclua somente as informações necessárias para analisar o pedido."
              />
            </Field>
            {selecionado.alerta ? (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                Esta ação pode impedir novos acessos à conta depois de concluída pela administração.
              </p>
            ) : null}
            {erro ? <ErrorState message={erro} /> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setSelecionado(null)}>Cancelar</Button>
              <Button type="submit" busy={criar.isPending} busyLabel="Enviando…">Enviar solicitação</Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}

function SolicitacaoCard({ item }: { item: SolicitacaoLgpd }) {
  const status = {
    ABERTA: { label: "Aberta", tone: "warn" as const },
    EM_ANDAMENTO: { label: "Em andamento", tone: "info" as const },
    CONCLUIDA: { label: "Concluída", tone: "ok" as const },
    NEGADA: { label: "Negada", tone: "danger" as const },
  }[item.status];
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{labelTipo(item.tipoSolicitacao)} <span className="text-xs text-muted">#{item.id}</span></p>
          <p className="mt-1 text-xs text-muted">
            Solicitada em {formatarData(item.dataSolicitacao)} · Prazo {formatarData(item.prazoLimite)}
          </p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      {item.detalhamento ? <p className="mt-2 text-sm whitespace-pre-wrap text-muted">{item.detalhamento}</p> : null}
      {item.motivoNegativa ? <p className="mt-2 text-sm text-red-700">Motivo: {item.motivoNegativa}</p> : null}
    </li>
  );
}

function labelTipo(tipo: TipoSolicitacaoLgpd) {
  return DIREITOS.find((item) => item.tipo === tipo)?.titulo ?? tipo;
}

function formatarData(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

function downloadJson(dados: PacotePortabilidade, nome: string) {
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = nome;
  anchor.click();
  URL.revokeObjectURL(url);
}
