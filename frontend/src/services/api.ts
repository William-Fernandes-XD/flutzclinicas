import { http } from "../lib/http";
import type { Session } from "../lib/session";
import type { CatalogItem, ClinicBrand, Point } from "../types/api";

export const api = {
  setContext: (empresaId: number | null) =>
    http<Session>("/api/auth/contexto", { method: "POST", json: { empresaId } }),
  clinicContext: () => http<ClinicBrand | null>("/api/contexto/clinica"),
  tutorClinics: () => http<TutorClinic[]>("/api/tutor/clinicas"),
  platformStats: (de?: string, ate?: string) => {
    const query = new URLSearchParams();
    if (de) query.set("de", de);
    if (ate) query.set("ate", ate);
    const suffix = query.toString() ? `?${query}` : "";
    return http<PlatformStats>(`/api/admin/indicadores${suffix}`);
  },
  adminClinics: (q?: string) => http<AdminClinic[]>(`/api/admin/clinicas${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  subscriptions: (status?: string) =>
    http<AdminSubscription[]>(`/api/admin/assinaturas${status ? `?status=${status}` : ""}`),
  invoices: () => http<AdminInvoice[]>("/api/admin/faturas"),
  faturamentoResumo: () => http<FaturamentoResumo>("/api/admin/faturamento/resumo"),
  faturamentoEmpresas: (status: "PAGA" | "PENDENTE" | "ATRASADA") =>
    http<FaturamentoEmpresaCard[]>(`/api/admin/faturamento/empresas?status=${status}`),
  faturamentoPagamentoManual: (empresaId: number) =>
    http<FaturamentoEmpresaCard>(`/api/admin/faturamento/empresas/${empresaId}/pagamento-manual`, {
      method: "POST",
    }),
  faturamentoTopVinculo: () => http<Point[]>("/api/admin/faturamento/top-vinculo"),
  faturamentoTopRendimento: () => http<Point[]>("/api/admin/faturamento/top-rendimento"),
  faturamentoEmpresasPage: (q?: string, page = 0, size = 15) => {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    query.set("page", String(page));
    query.set("size", String(size));
    return http<PaginaFaturamentoEmpresas>(`/api/admin/faturamento/empresas-page?${query}`);
  },
  faturamentoEmpresaDetalhes: (empresaId: number) =>
    http<FaturamentoMovimento[]>(`/api/admin/faturamento/empresas/${empresaId}/detalhes`),
  users: () => http<AdminUsers>("/api/admin/usuarios"),
  supportTickets: () => http<SupportTicket[]>("/api/admin/tickets"),
  atualizarStatusTicket: (id: number, status: string) =>
    http<SupportTicket>(`/api/admin/tickets/${id}/status`, { method: "POST", json: { status } }),
  responderTicket: (id: number, resposta: string, status?: "EM_ANDAMENTO" | "RESOLVIDO") =>
    http<SupportTicket>(`/api/admin/tickets/${id}/resposta`, { method: "POST", json: { resposta, status } }),
  meusTickets: () => http<MySupportTicket[]>("/api/suporte"),
  abrirTicket: (body: { motivo: string; mensagem: string }) =>
    http<MySupportTicket>("/api/suporte", { method: "POST", json: body }),
  editarTicket: (id: number, body: { motivo: string; mensagem: string }) =>
    http<MySupportTicket>(`/api/suporte/${id}`, { method: "PUT", json: body }),
  excluirTicket: (id: number) =>
    http<MySupportTicket>(`/api/suporte/${id}`, { method: "DELETE" }),
  lgpdSolicitacoes: () => http<SolicitacaoLgpd[]>("/api/lgpd/solicitacoes"),
  criarSolicitacaoLgpd: (body: { tipoSolicitacao: TipoSolicitacaoLgpd; detalhamento?: string }) =>
    http<ResultadoSolicitacaoLgpd>("/api/lgpd/solicitacoes", { method: "POST", json: body }),
  lgpdExportacao: () => http<PacotePortabilidade>("/api/lgpd/exportacao"),
  lgpdAcesso: () => http<PacotePortabilidade>("/api/lgpd/acesso"),
  adminLgpdSolicitacoes: () => http<SolicitacaoLgpd[]>("/api/admin/lgpd/solicitacoes"),
  atualizarStatusLgpd: (id: number, status: StatusLgpd, motivoNegativa?: string) =>
    http<SolicitacaoLgpd>(`/api/admin/lgpd/solicitacoes/${id}/status`, {
      method: "POST",
      json: { status, motivoNegativa },
    }),
  anonimizarLgpd: (id: number) =>
    http<SolicitacaoLgpd>(`/api/admin/lgpd/solicitacoes/${id}/anonimizar`, { method: "POST" }),
  adminCatalog: (tipo: string) => http<CatalogItem[]>(`/api/admin/catalogos/${tipo}`),
  setClinicStatus: (id: number, status: "ativo" | "inativo") =>
    http<AdminClinic>(`/api/admin/clinicas/${id}/status`, { method: "POST", json: { status } }),
  setUserStatus: (tipo: "colaborador" | "cliente", id: number, status: "ativo" | "inativo") =>
    http<AdminPerson>(`/api/admin/usuarios/${tipo}/${id}/status`, { method: "POST", json: { status } }),
  adminAvaliacoes: () => http<AdminAvaliacao[]>("/api/admin/avaliacoes"),
  setAdminAvaliacaoVisivel: (id: number, visivel: boolean) =>
    http<AdminAvaliacao>(`/api/admin/avaliacoes/${id}/visibilidade`, { method: "POST", json: { visivel } }),
  deleteAdminAvaliacao: (id: number) =>
    http<void>(`/api/admin/avaliacoes/${id}`, { method: "DELETE" }),
  createCatalog: (tipo: string, nome: string, especieId?: number) =>
    http<CatalogItem>(`/api/admin/catalogos/${tipo}`, { method: "POST", json: { nome, especieId } }),
  updateCatalog: (tipo: string, id: number, nome: string) =>
    http<CatalogItem>(`/api/admin/catalogos/${tipo}/${id}`, { method: "PUT", json: { nome } }),
  deleteCatalog: (tipo: string, id: number) =>
    http<void>(`/api/admin/catalogos/${tipo}/${id}`, { method: "DELETE" }),
  ofertaVacinaClinica: (id: number, oferecer: boolean) =>
    http<CatalogItem>(`/api/clinica/catalogos/vacinas/${id}/oferta`, {
      method: "POST",
      json: { oferecer },
    }),
  adminTokens: (page = 0, size = 10) =>
    http<AdminTokenPage>(`/api/admin/tokens?page=${page}&size=${size}`),
  createToken: (body: NovoToken) =>
    http<AdminToken>("/api/admin/tokens", { method: "POST", json: body }),
  deactivateToken: (id: number) =>
    http<void>(`/api/admin/tokens/${id}/desativar`, { method: "POST" }),
  validarToken: (codigo: string, codigoPlano: string) =>
    http<TokenPreview>("/api/public/tokens/validar", { method: "POST", json: { codigo, codigoPlano } }),
  mensalidade: () => http<Mensalidade>("/api/assinatura/mensalidade"),
  acessoAssinatura: () => http<AssinaturaAcesso>("/api/assinatura/acesso"),
  aplicarTokenAssinatura: (codigo: string) =>
    http<Mensalidade>("/api/assinatura/token", { method: "POST", json: { codigo } }),
  pagamentoConfig: () => http<{ publicKey: string | null }>("/api/assinatura/pagamento/config"),
  pagarPix: (body?: { deviceId?: string | null }) =>
    http<PaymentResult>("/api/assinatura/pagar/pix", { method: "POST", json: body ?? {} }),
  pagarCartao: (body: CardPaymentBody) =>
    http<PaymentResult>("/api/assinatura/pagar/cartao", { method: "POST", json: body }),
  statusPagamento: () => http<PaymentResult>("/api/assinatura/pagamento"),
  clinicStats: () => http<ClinicStats>("/api/indicadores/clinica"),
  relatorioVisaoGeral: (params: {
    de?: string;
    ate?: string;
    profissionalId?: number;
    servicoId?: number;
    status?: string;
  }) => {
    const query = new URLSearchParams();
    if (params.de) query.set("de", params.de);
    if (params.ate) query.set("ate", params.ate);
    if (params.profissionalId != null) query.set("profissionalId", String(params.profissionalId));
    if (params.servicoId != null) query.set("servicoId", String(params.servicoId));
    if (params.status) query.set("status", params.status);
    const suffix = query.toString() ? `?${query}` : "";
    return http<VisaoGeralReport>(`/api/clinica/relatorios/visao-geral${suffix}`);
  },
  pet: (id: number) => http<PetDetail>(`/api/pets/${id}`),
  consultarPets: (params: { nome?: string; cpf?: string; page?: number; size?: number }) => {
    const query = new URLSearchParams();
    if (params.nome?.trim()) query.set("nome", params.nome.trim());
    if (params.cpf?.replace(/\D/g, "")) query.set("cpf", params.cpf.replace(/\D/g, ""));
    if (params.page != null) query.set("page", String(params.page));
    if (params.size != null) query.set("size", String(params.size));
    const suffix = query.toString() ? `?${query}` : "";
    return http<ConsultaPetsPage>(`/api/consulta/pets${suffix}`);
  },
  vaccinations: () => http<VaccinationRow[]>("/api/vacinacoes"),
  tutorVaccinations: () => http<VaccinationRow[]>("/api/tutor/vacinacoes"),
  createVaccination: (body: Record<string, unknown>) =>
    http<VaccinationRow>("/api/vacinacoes", { method: "POST", json: body }),
  registrarWalkIn: (body: WalkInBody) =>
    http<WalkInResult>("/api/walk-in", { method: "POST", json: body }),
  cadastroTutorHistorico: (cpf: string) =>
    http<CadastroTutorHistorico>(
      `/api/public/cadastro-tutor/historico?cpf=${encodeURIComponent(cpf.replace(/\D/g, ""))}`,
    ),
  specialties: () => http<CatalogItem[]>("/api/especialidades"),
  offerSpecialty: (id: number) => http<CatalogItem>("/api/especialidades", { method: "POST", json: { id } }),
  pageConfig: () => http<PageEditor>("/api/pagina"),
  saveLayout: (secoes: PageSection[]) => http<void>("/api/pagina/layout", { method: "PUT", json: secoes }),
  saveSection: (tipo: string, visivel: boolean, ordem: number) =>
    http<void>("/api/pagina/secoes", { method: "PUT", json: { tipo, visivel, ordem } }),
  saveHero: (body: {
    titulo: string;
    subtitulo?: string;
    texto?: string;
    imagemFundoUrl?: string;
    imagemPosicaoId?: number | null;
    topicos?: { titulo: string; texto?: string }[];
  }) => http<void>("/api/pagina/hero", { method: "PUT", json: body }),
  saveIdentidade: (body: { logoUrl?: string; sobre?: string }) =>
    http<void>("/api/clinica/identidade", { method: "PUT", json: body }),
  saveEndereco: (body: PageAddress) => http<void>("/api/clinica/endereco", { method: "PUT", json: body }),
  saveContato: (body: { email: string; telefone?: string; redes: { tipoId: number; nome?: string; url: string }[] }) =>
    http<void>("/api/clinica/contato", { method: "PUT", json: body }),
  saveVisibilidade: (body: { tipo: string; id: number; visivel: boolean; ordem?: number; texto?: string }) =>
    http<void>("/api/pagina/visibilidade", { method: "PUT", json: body }),
  createDoacao: (body: { titulo: string; texto?: string; metaValor?: number; dataInicio?: string; dataFim?: string }) =>
    http<{ id: number; nome: string }>("/api/pagina/doacoes", { method: "POST", json: body }),
  uploadArquivo: (destino: "logo" | "hero" | "galeria", arquivo: File) => {
    const data = new FormData();
    data.append("destino", destino);
    data.append("arquivo", arquivo);
    return http<{ url: string; destino: string; nome: string }>("/api/arquivos", { method: "POST", body: data });
  },
  reviews: () => http<Review[]>("/api/avaliacoes"),
  chats: () => http<ChatSummary[]>("/api/chats"),
  tutorChats: () => http<TutorConversa[]>("/api/tutor/chats"),
  abrirTutorChat: (empresaId: number) =>
    http<TutorConversa>("/api/tutor/chats", { method: "POST", json: { empresaId } }),
  chat: (id: number) => http<ChatDetail>(`/api/chats/${id}`),
  openChat: (body: Record<string, unknown>) => http<ChatSummary>("/api/chats", { method: "POST", json: body }),
  sendChat: (id: number, texto: string) =>
    http<ChatMessage>(`/api/chats/${id}/mensagens`, { method: "POST", json: { texto } }),
  closeChat: (id: number, texto?: string) =>
    http<void>(`/api/chats/${id}/encerrar`, { method: "POST", json: { texto } }),
  notificacoes: () => http<AppNotification[]>("/api/notificacoes"),
  notificacoesNaoLidas: () => http<{ total: number }>("/api/notificacoes/nao-lidas"),
  marcarNotificacaoLida: (id: number) => http<AppNotification>(`/api/notificacoes/${id}/lida`, { method: "POST" }),
  marcarNotificacoesLidas: () => http<{ status: string }>("/api/notificacoes/lidas", { method: "POST" }),
  notificacaoLogs: () => http<NotificationLog[]>("/api/notificacoes/logs"),
  publicClinic: (slug: string) => http<PublicClinic>(`/api/public/clinicas/${slug}`),
  publicClinicDisponibilidade: (slug: string, de?: string, ate?: string) => {
    const query = new URLSearchParams();
    if (de) query.set("de", de);
    if (ate) query.set("ate", ate);
    const suffix = query.toString() ? `?${query}` : "";
    return http<AgendaDisponibilidade>(`/api/public/clinicas/${slug}/disponibilidade${suffix}`);
  },
  tutorLocation: () => http<TutorLocation>("/api/tutor/localizacao"),
  saveTutorLocation: (body: TutorLocation) =>
    http<TutorLocation>("/api/tutor/localizacao", { method: "POST", json: body }),
  agendaClinicas: (latitude?: number | null, longitude?: number | null) => {
    const query = new URLSearchParams();
    if (latitude != null && longitude != null) {
      query.set("latitude", String(latitude));
      query.set("longitude", String(longitude));
    }
    const suffix = query.toString() ? `?${query}` : "";
    return http<AgendaClinic[]>(`/api/agenda/clinicas${suffix}`);
  },
  clinicaAvaliacoes: (empresaId: number) => http<ClinicaAvaliacao[]>(`/api/clinicas/${empresaId}/avaliacoes`),
  avaliacoesPendentes: () => http<AvaliacaoPendente[]>("/api/tutor/avaliacoes/pendentes"),
  criarAvaliacao: (body: { origem: string; origemId: number; nota: number; comentario?: string }) =>
    http<ClinicaAvaliacao>("/api/tutor/avaliacoes", { method: "POST", json: body }),
  concluirAtendimento: (id: number) => http(`/api/atendimentos/${id}/concluir`, { method: "POST" }),
  agendaDisponibilidade: (empresaId: number, de?: string, ate?: string) => {
    const query = new URLSearchParams({ empresaId: String(empresaId) });
    if (de) query.set("de", de);
    if (ate) query.set("ate", ate);
    return http<AgendaDisponibilidade>(`/api/agenda/disponibilidade?${query}`);
  },
  agendaPets: (empresaId: number) => http<AgendaPet[]>(`/api/agenda/pets?empresaId=${empresaId}`),
  agendaServicos: (empresaId: number) => http<AgendaServico[]>(`/api/agenda/servicos?empresaId=${empresaId}`),
  agendaVacinas: (empresaId: number) => http<AgendaVacina[]>(`/api/agenda/vacinas?empresaId=${empresaId}`),
  agendaSolicitacoes: (params?: { status?: string; tipo?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.tipo) query.set("tipo", params.tipo);
    const suffix = query.toString() ? `?${query}` : "";
    return http<AgendaSolicitacao[]>(`/api/agenda/solicitacoes${suffix}`);
  },
  criarSolicitacao: (body: Record<string, unknown>) =>
    http<AgendaSolicitacao>("/api/agenda/solicitacoes", { method: "POST", json: body }),
  agendaAcao: (id: number, acao: string, body?: Record<string, unknown>) =>
    http<AgendaSolicitacao>(`/api/agenda/solicitacoes/${id}/${acao}`, { method: "POST", json: body ?? {} }),
  agendaConcluir: (id: number) =>
    http<AgendaSolicitacao>(`/api/agenda/solicitacoes/${id}/concluir`, { method: "POST" }),
  agendaCheckout: (id: number) => http<AgendaCheckout>(`/api/agenda/solicitacoes/${id}/checkout`),
  agendaAplicarCupom: (id: number, codigo: string) =>
    http<AgendaCheckout>(`/api/agenda/solicitacoes/${id}/cupom`, { method: "POST", json: { codigo } }),
  agendaRemoverCupom: (id: number) =>
    http<AgendaCheckout>(`/api/agenda/solicitacoes/${id}/cupom/remover`, { method: "POST" }),
  agendaPagamentoConfig: (id: number) =>
    http<{ publicKey: string | null }>(`/api/agenda/solicitacoes/${id}/pagamento/config`),
  agendaPagarPix: (id: number, body?: { deviceId?: string | null }) =>
    http<BookingPaymentResult>(`/api/agenda/solicitacoes/${id}/pagar/pix`, {
      method: "POST",
      json: body ?? {},
    }),
  agendaPagarCartao: (id: number, body: CardPaymentBody) =>
    http<BookingPaymentResult>(`/api/agenda/solicitacoes/${id}/pagar/cartao`, { method: "POST", json: body }),
  agendaStatusPagamento: (id: number) =>
    http<BookingPaymentResult>(`/api/agenda/solicitacoes/${id}/pagamento`),
  agendaVacinasGestao: () => http<VacinaGestao[]>("/api/agenda/vacinas/gestao"),
  agendaPrecoVacina: (id: number, preco: number) =>
    http<VacinaGestao>(`/api/agenda/vacinas/${id}/preco`, { method: "POST", json: { preco } }),
  clinicaRecebimento: () => http<ContaRecebimento>("/api/clinica/recebimento"),
  conectarMercadoPago: () =>
    http<{ authorizationUrl: string; expiresAt: string }>("/api/clinica/recebimento/mercadopago/connect"),
  desconectarClinicaRecebimento: () =>
    http<ContaRecebimento>("/api/clinica/recebimento/desconectar", { method: "POST" }),
  clinicaRecebimentos: () => http<RecebimentoClinica[]>("/api/clinica/recebimentos"),
  clinicaCupons: () => http<CupomClinica[]>("/api/clinica/cupons"),
  criarClinicaCupom: (body: {
    codigo: string;
    percentualDesconto: number;
    dataExpiracao: string;
    usosMaximos?: number | null;
  }) => http<CupomClinica>("/api/clinica/cupons", { method: "POST", json: body }),
  desativarClinicaCupom: (id: number) =>
    http<void>(`/api/clinica/cupons/${id}/desativar`, { method: "POST" }),
  agendaExpediente: () => http<AgendaFaixa[]>("/api/agenda/expediente"),
  saveExpediente: (body: AgendaFaixa[]) => http<AgendaFaixa[]>("/api/agenda/expediente", { method: "PUT", json: body }),
  agendaFeriados: () => http<AgendaFeriado[]>("/api/agenda/feriados"),
  criarFeriado: (body: Record<string, unknown>) =>
    http<AgendaFeriado>("/api/agenda/feriados", { method: "POST", json: body }),
  excluirFeriado: (id: number) => http<void>(`/api/agenda/feriados/${id}`, { method: "DELETE" }),
  agendaBloqueios: () => http<AgendaBloqueio[]>("/api/agenda/bloqueios"),
  criarBloqueio: (body: Record<string, unknown>) =>
    http<AgendaBloqueio>("/api/agenda/bloqueios", { method: "POST", json: body }),
  excluirBloqueio: (id: number) => http<void>(`/api/agenda/bloqueios/${id}`, { method: "DELETE" }),
  agendaConfig: () => http<AgendaConfig>("/api/agenda/config"),
  saveAgendaConfig: (body: AgendaConfig) => http<AgendaConfig>("/api/agenda/config", { method: "PUT", json: body }),
  equipeHorarios: (id: number) => http<AgendaFaixa[]>(`/api/equipe/${id}/horarios`),
  saveEquipeHorarios: (id: number, body: AgendaFaixa[]) =>
    http<AgendaFaixa[]>(`/api/equipe/${id}/horarios`, { method: "PUT", json: body }),
};

export type TutorClinic = ClinicBrand & {
  pets: number;
  atendimentos: number;
  ultimoAtendimento: string | null;
  proximoAgendamento: string | null;
};

export type PlatformStats = {
  mrr: number;
  arr: number;
  faturamentoMes: number;
  faturamentoPeriodo: number;
  inadimplencia: number;
  assinaturasAtivas: number;
  novasAssinaturas: number;
  cancelamentos: number;
  receitaMensal: Point[];
  assinaturasMes: Point[];
  receitaPorPlano: Point[];
  clinicasPorPlano: Point[];
  atividade: { clinica: string; status: string; plano: string; quando: string }[];
};

export type AdminClinic = {
  id: number;
  nome: string;
  cnpj: string;
  email: string;
  slug: string;
  logoUrl: string | null;
  cidade: string | null;
  uf: string | null;
  status: string;
  criadoEm: string | null;
  plano: string | null;
  statusAssinatura: string | null;
  colaboradores: number;
  clientes: number;
  pets: number;
};

export type AdminSubscription = {
  id: number;
  empresaId: number;
  clinica: string;
  plano: string;
  valorMensal: number;
  status: string;
  inicio: string;
  proximoVencimento: string | null;
  cancelamento: string | null;
};

export type AdminToken = {
  id: number;
  codigoToken: string;
  percentualDesconto: number;
  dataExpiracao: string;
  status: string;
  usosMaximosPorEmpresa: number | null;
};

export type AdminTokenPage = {
  items: AdminToken[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
};

export type NovoToken = {
  codigoToken: string;
  percentualDesconto: number;
  dataExpiracao: string;
  usosMaximosPorEmpresa?: number | null;
};

export type TokenPreview = {
  codigo: string;
  percentualDesconto: number;
  valorBruto: number;
  valor: number;
};

export type PagamentoHistorico = {
  faturaId: number;
  data: string;
  valor: number;
  metodo: string;
  provider?: string | null;
  providerPagamentoId?: string | null;
};

export type Mensalidade = {
  plano: string;
  codigoPlano?: string | null;
  valorMensal: number;
  statusAssinatura: string;
  proximoVencimento: string | null;
  diasTolerancia?: number;
  dataLimiteAcesso?: string | null;
  faturaId: number | null;
  valorBruto: number | null;
  valor: number | null;
  valorAPagar?: number | null;
  statusFatura: string | null;
  codigoTokenAplicado: string | null;
  percentualDescontoAplicado: number | null;
  vencimentoFatura: string | null;
  competencia?: string | null;
  ultimoPagamento?: PagamentoHistorico | null;
  historico?: PagamentoHistorico[];
};

export type AssinaturaAcesso = {
  statusAssinatura: string;
  dataLimiteAcesso: string | null;
  podeOperar: boolean;
};

export type CardPaymentBody = {
  token: string;
  paymentMethodId: string;
  installments: number;
  issuerId?: string | null;
  payerEmail?: string;
  payerName?: string;
  payerCpf: string;
  deviceId?: string | null;
};

export type PaymentResult = {
  faturaId: number;
  amount: number;
  status: string;
  paid: boolean;
  mercadopagoPaymentId: string | null;
  method: string | null;
  pixQrCode: string | null;
  pixQrCodeBase64: string | null;
  pixExpiration: string | null;
};

/** Pagamento de agendamento — espelha PaymentResult com agendamentoId. */
export type BookingPaymentResult = {
  agendamentoId: number;
  amount: number;
  status: string;
  paid: boolean;
  mercadopagoPaymentId: string | null;
  method: string | null;
  pixQrCode: string | null;
  pixQrCodeBase64: string | null;
  pixExpiration: string | null;
  /** Campos nativos da API (quando o backend usa nomes em português). */
  valor?: number;
  pago?: boolean;
  metodo?: string | null;
  pixCopiaECola?: string | null;
  detalhe?: string | null;
};

export type ContaRecebimento = {
  id: number | null;
  provider: string;
  accountId: string | null;
  status: string;
  publicKey: string | null;
  publicKeyMascarada: string | null;
  nomeExibicao: string | null;
  conectadaEm: string | null;
  conectada: boolean;
  authMode?: string | null;
  providerUserId?: string | null;
  oauthDisponivel?: boolean;
};

export type RecebimentoClinica = {
  id: number;
  descricao: string | null;
  valor: number;
  status: string;
  metodo: string | null;
  pagoEm: string | null;
};

export type CupomClinica = {
  id: number;
  codigo: string;
  percentualDesconto: number;
  dataExpiracao: string;
  status: string;
  usosMaximos: number | null;
  usosRealizados: number;
};

export type AgendaCheckout = {
  agendamentoId: number;
  statusCodigo: string;
  clinica: string;
  pet: string;
  tipo: string;
  item: string | null;
  inicio: string;
  valorServico: number;
  valorDesconto: number;
  valorCobrado: number;
  codigoCupom: string | null;
  contaRecebimentoOk: boolean;
  publicKey: string | null;
  podePagar: boolean;
};

export type AdminInvoice = {
  id: number;
  clinica: string;
  competencia: string;
  valorBruto: number;
  valor: number;
  moeda: string;
  status: string;
  vencimento: string;
  pagamento: string | null;
};

export type FaturamentoResumo = {
  pagoMes: number;
  pendente: number;
  atrasado: number;
  empresasPagoMes: number;
  empresasPendente: number;
  empresasAtrasado: number;
};

export type FaturamentoEmpresaCard = {
  empresaId: number;
  nome: string;
  telefone: string | null;
  email: string | null;
  logoUrl: string | null;
  statusAssinatura: string | null;
  total: number;
};

export type FaturamentoEmpresaLinha = {
  empresaId: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  logoUrl: string | null;
  statusAssinatura: string | null;
  lucroMes: number;
  lucroAno: number;
};

export type PaginaFaturamentoEmpresas = {
  items: FaturamentoEmpresaLinha[];
  total: number;
  page: number;
  size: number;
};

export type FaturamentoMovimento = {
  id: number;
  categoria: string;
  descricao: string;
  pet: string | null;
  tutor: string | null;
  valor: number;
  pagoEm: string | null;
  status: string;
};

export type AdminUsers = {
  administradores: AdminPerson[];
  colaboradores: AdminPerson[];
  clientes: AdminPerson[];
};

export type AdminPerson = {
  id: number;
  nome: string;
  identificador: string;
  status: string;
  clinica: string | null;
  fotoUrl?: string | null;
};

export type SupportTicket = {
  id: number;
  origem: string;
  nome: string;
  email: string;
  clinica: string | null;
  motivo: string;
  mensagem: string;
  status: string;
  criadoEm: string;
  resposta: string | null;
  respondidoEm: string | null;
};

export type MySupportTicket = {
  id: number;
  motivo: string;
  mensagem: string;
  status: string;
  criadoEm: string;
  resposta: string | null;
  respondidoEm: string | null;
};

export type TipoSolicitacaoLgpd =
  | "ACESSO"
  | "CORRECAO"
  | "ANONIMIZACAO"
  | "EXCLUSAO"
  | "PORTABILIDADE"
  | "REVOGACAO_CONSENTIMENTO";

export type StatusLgpd = "ABERTA" | "EM_ANDAMENTO" | "CONCLUIDA" | "NEGADA";

export type SolicitacaoLgpd = {
  id: number;
  empresaId: number | null;
  titularTipo: string;
  titularId: number;
  tipoSolicitacao: TipoSolicitacaoLgpd;
  status: StatusLgpd;
  detalhamento: string | null;
  motivoNegativa: string | null;
  dataSolicitacao: string;
  dataConclusao: string | null;
  prazoLimite: string;
};

export type PacotePortabilidade = {
  geradoEm: string;
  titularTipo: string;
  perfil: Record<string, unknown>;
  pets: Record<string, unknown>[];
  agendamentos: Record<string, unknown>[];
  vacinacoes: Record<string, unknown>[];
  chats: Record<string, unknown>[];
  papeis: Record<string, unknown>[];
};

export type ResultadoSolicitacaoLgpd = {
  solicitacao: SolicitacaoLgpd;
  dados: PacotePortabilidade | null;
};

export type AdminAvaliacao = {
  id: number;
  clinica: string;
  tutor: string;
  pet: string | null;
  texto: string;
  nota: number;
  visivel: boolean;
  autorizado: boolean;
  status: string;
  data: string | null;
};

export type ClinicStats = {
  atendimentosHoje: number;
  emAndamento: number;
  finalizadosHoje: number;
  agendaHoje: number;
  agendaAmanha: number;
  agendaPendentes: number;
  pets: number;
  tutores: number;
  vacinasAplicadas: number;
  vacinasProximas: number;
  vacinasAtrasadas: number;
  atendimentosPorDia: Point[];
  motivosAbertura: Point[];
  encerramento: Point[];
  avaliacoes: Point[];
};

export type ReportPointDto = { rotulo: string; valor: number | string };

export type VisaoGeralKpis = {
  faturamento: number | string;
  atendimentos: number;
  novosTutores: number;
  novosPets: number;
  cancelamentos: number;
  faltas: number;
  retornos: number;
  ticketMedio: number | string;
  ocupacaoPercentual: number | string;
};

export type VisaoGeralReport = {
  clinica: string;
  periodoDe: string;
  periodoAte: string;
  periodoAnteriorDe: string;
  periodoAnteriorAte: string;
  kpis: VisaoGeralKpis;
  kpisAnterior: VisaoGeralKpis;
  deltas: {
    faturamento: number | string;
    atendimentos: number | string;
    novosTutores: number | string;
    novosPets: number | string;
    cancelamentos: number | string;
    faltas: number | string;
    retornos: number | string;
    ticketMedio: number | string;
  };
  faturamentoSerie: ReportPointDto[];
  atendimentosSerie: ReportPointDto[];
  porStatus: ReportPointDto[];
  servicosVolume: ReportPointDto[];
  servicosReceita: ReportPointDto[];
  ocupacaoSerie: ReportPointDto[];
};

export type ConsultaPet = {
  id: number;
  nome: string;
  fotoUrl?: string | null;
  sexo?: string | null;
  especie: string;
  raca?: string | null;
  nascimento: string | null;
  tutor: string;
  tutorEmail: string | null;
  vacinasStatus?: "EM_DIA" | "ATRASADA" | "SEM_REGISTRO" | string | null;
};

export type ConsultaPetsPage = {
  items: ConsultaPet[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
};

export type PetDetail = {
  id: number;
  nome: string;
  sexo: string;
  nascimento: string | null;
  peso: number | null;
  especieId?: number | null;
  especie: string;
  racaId?: number | null;
  raca: string | null;
  clienteId: number;
  tutor: string;
  empresaId: number;
  fotoUrl?: string | null;
  tutorEmail?: string | null;
  tutorTelefone?: string | null;
  tutorCpf?: string | null;
  vacinacoes: VaccinationRow[];
  doencas: { id: number; quando: string; titulo: string; detalhe: string | null }[];
  atendimentos: { id: number; quando: string; titulo: string; detalhe: string | null }[];
};

export type VaccinationRow = {
  id: number;
  petId: number;
  pet: string;
  fotoUrl?: string | null;
  sexo?: string | null;
  especie?: string | null;
  raca?: string | null;
  vacina: string;
  aplicacao: string;
  proxima: string | null;
  lote: string | null;
};

export type WalkInBody = {
  tipo: "ATENDIMENTO" | "VACINACAO";
  cpf: string;
  nomeTutor: string;
  telefone?: string;
  email?: string;
  nomePet: string;
  especieId: number;
  racaId?: number;
  sexo?: string;
  peso?: number;
  dataAniversario?: string;
  servicoId?: number;
  resumo?: string;
  detalhes?: string;
  data?: string;
  vacinaId?: number;
  dataAplicacao?: string;
  dataProximaDose?: string;
  lote?: string;
  observacoes?: string;
};

export type WalkInResult = {
  clienteId: number;
  provisorio: boolean;
  petId: number;
  pet: string;
  tutor: string;
  tipo: string;
  atendimentoId: number | null;
  vacinacaoId: number | null;
};

export type CadastroTutorHistorico = {
  temHistorico: boolean;
  qtdPets: number;
  qtdAtendimentos: number;
  qtdVacinas: number;
};

export type PageSection = { tipo: string; ordem: number; visivel: boolean };
export type PageAddress = {
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
};
export type PageHero = {
  titulo: string;
  subtitulo: string | null;
  texto: string | null;
  imagemFundoUrl: string | null;
  imagemPosicaoId: number | null;
  posicao: string | null;
  topicos: { id: number; titulo: string; texto: string | null; iconeUrl: string | null; ordem: number }[];
};
export type PageItem = {
  id: number;
  nome: string;
  preco: number | null;
  visivel: boolean;
  autorizado: boolean | null;
  texto?: string | null;
  cargo?: string | null;
  fotoUrl?: string | null;
  icone?: string | null;
};
export type PublicMembro = { nome: string; cargo: string | null; fotoUrl: string | null };
export type PageGalleryItem = { id: number; url: string; alt: string | null; ordem: number; visivel: boolean };
export type PageDonation = {
  id: number;
  titulo: string;
  texto: string | null;
  metaValor: number | null;
  dataInicio: string | null;
  dataFim: string | null;
  visivelPagina: boolean;
};
export type PageReview = Review;
export type PageSocial = { tipoId: number; nome: string; url: string };

export type PageEditor = {
  secoes: PageSection[];
  identidade: {
    nome: string;
    slug: string;
    logoUrl: string | null;
    sobre: string | null;
    email: string | null;
    telefone: string | null;
  };
  endereco: PageAddress;
  hero: PageHero | null;
  servicos: PageItem[];
  especialidades: PageItem[];
  equipe: PageItem[];
  avaliacoes: PageReview[];
  galeria: PageGalleryItem[];
  doacoes: PageDonation[];
  redes: PageSocial[];
  posicoes: CatalogItem[];
  tiposRede: CatalogItem[];
  permiteDoacoes: boolean;
  vacinas?: { id: number; nome: string }[];
};

export type PageConfig = PageEditor;

export type Review = {
  id: number;
  tutor: string;
  pet: string | null;
  texto: string;
  nota: number;
  visivel: boolean;
  autorizado: boolean;
  data?: string | null;
  email?: string | null;
  tutorFotoUrl?: string | null;
  petFotoUrl?: string | null;
  raca?: string | null;
  idadeAnos?: number | null;
  servico?: string | null;
  servicoIcone?: string | null;
};

export type ChatSummary = {
  id: number;
  tutor: string;
  fotoUrl?: string | null;
  pet: string | null;
  motivo: string | null;
  status: string;
  criadoEm: string;
  preview?: string | null;
  ultimaAtividade?: string | null;
  /** Último remetente da conversa: CLIENTE | COLABORADOR | SISTEMA */
  ultimoRemetente?: string | null;
};

export type TutorConversa = {
  empresaId: number;
  clinica: string;
  logoUrl: string | null;
  chatId: number | null;
  status: string | null;
  preview: string | null;
  ultimaAtividade: string | null;
};

export type ChatMessage = {
  id: number;
  remetente: string;
  remetenteNome?: string | null;
  remetenteFoto?: string | null;
  texto: string;
  quando: string;
};
export type ChatDetail = { chat: ChatSummary; mensagens: ChatMessage[] };

export type AppNotification = {
  id: number;
  tipo: string;
  titulo: string;
  corpo: string;
  linkPath: string;
  referenciaTipo: string | null;
  referenciaId: number | null;
  lida: boolean;
  quando: string;
  fotoUrl?: string | null;
  atorNome?: string | null;
};

export type NotificationLog = {
  id: number;
  tipo: string;
  titulo: string;
  corpo: string;
  linkPath: string;
  destinatarioId?: number | null;
  destinatario: string;
  destinatarioFotoUrl?: string | null;
  destinatarioEmail?: string | null;
  destinatarioCargo?: string | null;
  quando: string;
  visualizacoes: {
    colaboradorId: number | null;
    nome: string | null;
    fotoUrl?: string | null;
    email?: string | null;
    cargo?: string | null;
    quando: string | null;
  }[];
};

export type TutorLocation = { latitude: number | null; longitude: number | null };

export type AgendaClinic = {
  id: number;
  nome: string;
  slug: string;
  logoUrl: string | null;
  endereco: string;
  cidade: string | null;
  uf: string | null;
  sobre: string | null;
  distanciaKm: number | null;
  aberta: boolean;
  servicos: string[];
  especialidades?: string[];
  notaMedia?: number | null;
  totalAvaliacoes?: number;
  horariosHoje?: string[];
};

export type ClinicaAvaliacao = {
  id: number;
  nota: number;
  comentario: string | null;
  quando: string;
  tutor: string;
  fotoUrl?: string | null;
};

export type AvaliacaoPendente = {
  origemId: number;
  origem: "ATENDIMENTO" | "VACINACAO" | string;
  empresaId: number;
  clinica: string;
  petId: number;
  pet: string;
  quando: string | null;
};

export type AgendaSlot = { inicio: string; fim: string; estado: string; vagas?: number | null };
export type AgendaDia = { data: string; estado: string; feriado: string | null; slots: AgendaSlot[]; nota: string | null };
export type AgendaDisponibilidade = { empresaId: number; dias: AgendaDia[] };
export type AgendaPet = {
  id: number;
  nome: string;
  especie: string;
  fotoUrl?: string | null;
  raca?: string | null;
  sexo?: string | null;
  nascimento?: string | null;
};
export type AgendaServico = { id: number; nome: string; duracaoMinutos: number | null; preco: number | null };
export type AgendaVacina = {
  id: number;
  nome: string;
  descricao: string | null;
  fabricante: string | null;
  preco?: number | null;
};
export type VacinaGestao = {
  id: number;
  nome: string;
  descricao: string | null;
  fabricante: string | null;
  visivelAgendamento: boolean;
  idadeMinimaMeses: number | null;
  idadeMaximaMeses: number | null;
  intervaloDosesDias: number | null;
  observacoes: string | null;
  preco: number | null;
};
export type AgendaSolicitacao = {
  id: number;
  empresaId: number;
  clinica: string;
  clienteId: number;
  tutor: string;
  petId: number;
  pet: string;
  especie?: string | null;
  fotoUrl?: string | null;
  tipo: string;
  statusCodigo: string;
  status: string;
  servico: string | null;
  vacina: string | null;
  colaboradorId: number | null;
  colaborador: string | null;
  inicio: string;
  fim: string | null;
  observacoes: string | null;
  motivoStatus: string | null;
  propostaInicio: string | null;
  propostaFim: string | null;
  empresaServicoId?: number | null;
  valorServico?: number | null;
  valorDesconto?: number | null;
  valorCobrado?: number | null;
  codigoCupom?: string | null;
};
export type AgendaFaixa = { id?: number | null; diaSemana: number; inicio: string; fim: string };
export type AgendaFeriado = {
  id?: number;
  data: string;
  nome: string;
  atende: boolean;
  inicio: string | null;
  fim: string | null;
};
export type AgendaBloqueio = { id?: number; inicio: string; fim: string; motivo: string };
export type AgendaConfig = {
  latitude: number | null;
  longitude: number | null;
  cancelamentoAntecedenciaMinutos: number | null;
};

export type PublicClinic = {
  clinica: {
    id?: number | null;
    nome: string;
    slug: string;
    logoUrl: string | null;
    sobre: string | null;
    email: string | null;
    telefone: string | null;
  };
  endereco: PageAddress;
  secoes: PageSection[];
  hero: PageHero | null;
  servicos: PageItem[];
  equipe: PublicMembro[];
  especialidades: string[];
  avaliacoes: Review[];
  galeria: PageGalleryItem[];
  redes: PageSocial[];
  doacoes: PageDonation[];
  vacinas?: { id: number; nome: string }[];
};
